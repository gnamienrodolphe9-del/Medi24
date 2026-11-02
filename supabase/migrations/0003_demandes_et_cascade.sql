-- Medi24 : demandes, alertes en cascade, réponses, livraison (semaines 3 à 10)
-- À exécuter dans l'éditeur SQL de Supabase APRÈS 0001 et 0002.
-- Peut être relancé sans danger (idempotent).

-- ---------------------------------------------------------------
-- Colonnes complémentaires
-- ---------------------------------------------------------------

-- Lien permanent de gestion de la pharmacie (planning de garde, historique).
alter table pharmacies
  add column if not exists jeton_gestion text default encode(gen_random_bytes(24), 'hex');
update pharmacies set jeton_gestion = encode(gen_random_bytes(24), 'hex')
  where jeton_gestion is null;
alter table pharmacies alter column jeton_gestion set not null;
create unique index if not exists pharmacies_jeton_gestion_idx on pharmacies (jeton_gestion);

alter table gardes add column if not exists confirmee_le timestamptz;
alter table gardes add column if not exists rappel_envoye_le timestamptz;

alter table demandes add column if not exists retenue_le timestamptz;
alter table demandes add column if not exists mode_choisi_le timestamptz;
alter table demandes add column if not exists remise_le timestamptz;
alter table demandes add column if not exists essais_code integer not null default 0;
alter table demandes add column if not exists rappel_envoye boolean not null default false;
alter table demandes add column if not exists repli_fait boolean not null default false;
alter table demandes add column if not exists cascade_verrou_le timestamptz;
alter table demandes add column if not exists sms_envoyes integer not null default 0;

alter table alertes add column if not exists rappel_le timestamptz;
alter table alertes add column if not exists sms_erreur text;

alter table reponses add column if not exists mis_a_jour_le timestamptz not null default now();

create index if not exists demandes_cree_le_idx on demandes (cree_le);
create index if not exists demandes_telephone_idx on demandes (telephone_patient, cree_le);

-- ---------------------------------------------------------------
-- Vérification du numéro du patient par code SMS
-- ---------------------------------------------------------------
create table if not exists verifications_telephone (
  id bigserial primary key,
  telephone text not null,
  code_hash text not null,
  expire_le timestamptz not null,
  essais integer not null default 0,
  utilise boolean not null default false,
  cree_le timestamptz not null default now()
);
create index if not exists verifications_telephone_idx
  on verifications_telephone (telephone, cree_le);

alter table verifications_telephone enable row level security;
drop policy if exists admin_tout on verifications_telephone;
create policy admin_tout on verifications_telephone
  for all using (est_admin()) with check (est_admin());

-- ---------------------------------------------------------------
-- Stockage privé des ordonnances (aucune règle publique : seul le serveur y accède)
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('ordonnances', 'ordonnances', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- Choix des pharmacies à alerter : de garde, validées, non suspendues,
-- pas encore alertées pour cette demande. Les gardes confirmées passent d'abord,
-- puis les plus proches du patient.
-- ---------------------------------------------------------------
create or replace function choisir_pharmacies_alerte(p_demande uuid, p_limite integer)
returns table (
  id uuid,
  nom text,
  telephone_alerte_1 text,
  telephone_alerte_2 text,
  distance_m double precision,
  garde_confirmee boolean
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with d as (
    select coalesce(
      position,
      st_setsrid(st_makepoint(-4.0867, 5.3364), 4326)::geography
    ) as pos
    from demandes where demandes.id = p_demande
  )
  select
    p.id,
    p.nom,
    p.telephone_alerte_1,
    p.telephone_alerte_2,
    st_distance(p.position, d.pos) as distance_m,
    bool_or(g.confirmee) as garde_confirmee
  from pharmacies p
  join gardes g on g.pharmacie_id = p.id
  cross join d
  where p.validee
    and not p.suspendue
    and now() between g.debut and g.fin
    and not exists (
      select 1 from alertes a where a.demande_id = p_demande and a.pharmacie_id = p.id
    )
  group by p.id, p.nom, p.telephone_alerte_1, p.telephone_alerte_2, p.position, d.pos
  order by bool_or(g.confirmee) desc, st_distance(p.position, d.pos)
  limit p_limite;
$$;

-- ---------------------------------------------------------------
-- Verrou de la cascade : évite que deux traitements simultanés
-- (tâche planifiée et page de suivi) envoient les mêmes SMS.
-- Renvoie vrai si le verrou a été obtenu. Il expire seul après 60 secondes.
-- ---------------------------------------------------------------
create or replace function reserver_cascade(p_demande uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nb integer;
begin
  update demandes
     set cascade_verrou_le = now()
   where id = p_demande
     and (cascade_verrou_le is null or cascade_verrou_le < now() - interval '60 seconds');
  get diagnostics v_nb = row_count;
  return v_nb = 1;
end;
$$;

create or replace function liberer_cascade(p_demande uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update demandes set cascade_verrou_le = null where id = p_demande;
$$;

-- ---------------------------------------------------------------
-- Réponse d'une pharmacie, de façon atomique.
-- Règles :
--  * la première réponse "disponible" ou "partiel" retient la demande ;
--  * une réponse "partiel" peut être remplacée par un "disponible" venu d'une autre
--    pharmacie dans les 3 minutes, tant que le patient n'a pas validé son choix ;
--  * "indisponible" ne retient jamais la demande.
-- p_lignes : [{ "produit": "...", "disponible": true, "substitut": "...", "prix_fcfa": 1500 }]
-- ---------------------------------------------------------------
create or replace function enregistrer_reponse(
  p_jeton_alerte text,
  p_statut statut_reponse,
  p_avis text,
  p_retrait boolean,
  p_livraison boolean,
  p_lignes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  a alertes%rowtype;
  d demandes%rowtype;
  v_reponse uuid;
  v_ligne jsonb;
  v_statut_retenue statut_reponse;
  v_retient boolean := false;
  v_raison text := null;
begin
  select * into a from alertes where jeton = p_jeton_alerte;
  if not found or a.expire_le < now() then
    return jsonb_build_object('ok', false, 'raison', 'lien_expire');
  end if;

  -- Verrouille la demande : deux pharmacies ne peuvent pas la retenir en même temps.
  select * into d from demandes where id = a.demande_id for update;

  if d.etat not in ('creee', 'envoyee', 'vue', 'confirmee') then
    return jsonb_build_object('ok', false, 'raison', 'demande_close', 'etat', d.etat);
  end if;

  if a.resultat is not null then
    return jsonb_build_object('ok', false, 'raison', 'deja_repondu');
  end if;

  insert into reponses (demande_id, pharmacie_id, statut, avis, retrait_possible, livraison_possible)
  values (d.id, a.pharmacie_id, p_statut, nullif(trim(p_avis), ''), p_retrait, p_livraison)
  on conflict (demande_id, pharmacie_id) do nothing
  returning id into v_reponse;

  if v_reponse is null then
    return jsonb_build_object('ok', false, 'raison', 'deja_repondu');
  end if;

  if p_statut <> 'indisponible' and p_lignes is not null then
    for v_ligne in select * from jsonb_array_elements(p_lignes)
    loop
      insert into lignes_reponse (reponse_id, produit, disponible, substitut, prix_fcfa)
      values (
        v_reponse,
        left(v_ligne ->> 'produit', 200),
        coalesce((v_ligne ->> 'disponible')::boolean, true),
        nullif(left(coalesce(v_ligne ->> 'substitut', ''), 200), ''),
        nullif(v_ligne ->> 'prix_fcfa', '')::integer
      );
    end loop;
  end if;

  update alertes set resultat = p_statut::text where id = a.id;

  if p_statut <> 'indisponible' then
    if d.pharmacie_retenue_id is null then
      v_retient := true;
    elsif d.pharmacie_retenue_id <> a.pharmacie_id then
      select r.statut into v_statut_retenue
        from reponses r
       where r.demande_id = d.id and r.pharmacie_id = d.pharmacie_retenue_id;
      if v_statut_retenue = 'partiel'
         and p_statut = 'disponible'
         and d.mode is null
         and d.retenue_le > now() - interval '3 minutes' then
        v_retient := true;
      else
        v_raison := 'deja_prise';
      end if;
    end if;

    if v_retient then
      update demandes
         set pharmacie_retenue_id = a.pharmacie_id,
             retenue_le = now(),
             etat = 'confirmee',
             mis_a_jour_le = now()
       where id = d.id;
    end if;
  end if;

  insert into journal_alertes (demande_id, evenement, detail)
  values (d.id, 'reponse', jsonb_build_object(
    'pharmacie_id', a.pharmacie_id, 'statut', p_statut, 'retenue', v_retient
  ));

  return jsonb_build_object('ok', true, 'retenue', v_retient, 'raison', v_raison);
end;
$$;

-- ---------------------------------------------------------------
-- Indicateurs pour l'administration (jours = période regardée)
-- ---------------------------------------------------------------
create or replace function admin_indicateurs(p_jours integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_debut timestamptz := now() - make_interval(days => greatest(p_jours, 1));
  v_resultat jsonb;
begin
  if not est_admin() then
    raise exception 'Accès réservé aux administrateurs' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'jours', p_jours,
    'total', (select count(*) from demandes where cree_le >= v_debut),
    'par_etat', coalesce((
      select jsonb_object_agg(etat, n) from (
        select etat::text as etat, count(*) as n
          from demandes where cree_le >= v_debut group by etat
      ) t
    ), '{}'::jsonb),
    'avec_reponse_positive', (
      select count(*) from demandes
       where cree_le >= v_debut and pharmacie_retenue_id is not null
    ),
    'remises', (
      select count(*) from demandes where cree_le >= v_debut and etat = 'remise'
    ),
    'delai_median_secondes', (
      select percentile_cont(0.5) within group (order by extract(epoch from (d.retenue_le - d.cree_le)))
        from demandes d
       where d.cree_le >= v_debut and d.retenue_le is not null
    ),
    'sms_envoyes', (
      select coalesce(sum(sms_envoyes), 0) from demandes where cree_le >= v_debut
    ),
    'note_moyenne', (
      select round(avg(note)::numeric, 2) from evaluations where cree_le >= v_debut
    ),
    'nb_evaluations', (
      select count(*) from evaluations where cree_le >= v_debut
    ),
    'pharmacies', coalesce((
      select jsonb_agg(l order by (l ->> 'alertes')::int desc) from (
        select jsonb_build_object(
          'nom', p.nom,
          'alertes', count(a.id),
          'reponses', count(a.resultat),
          'positives', count(*) filter (where a.resultat in ('disponible', 'partiel'))
        ) as l
        from pharmacies p
        join alertes a on a.pharmacie_id = p.id and a.cree_le >= v_debut
        group by p.id, p.nom
      ) x
    ), '[]'::jsonb)
  ) into v_resultat;

  return v_resultat;
end;
$$;

-- ---------------------------------------------------------------
-- Pharmacies pour l'administration : ajoute le lien de gestion.
-- ---------------------------------------------------------------
drop function if exists admin_lister_pharmacies();
create function admin_lister_pharmacies()
returns table (
  id uuid,
  nom text,
  adresse text,
  repere text,
  numero_ordre text,
  telephone_alerte_1 text,
  telephone_alerte_2 text,
  telephone_public text,
  validee boolean,
  suspendue boolean,
  latitude double precision,
  longitude double precision,
  jeton_gestion text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    p.id, p.nom, p.adresse, p.repere, p.numero_ordre,
    p.telephone_alerte_1, p.telephone_alerte_2, p.telephone_public,
    p.validee, p.suspendue,
    st_y(p.position::geometry) as latitude,
    st_x(p.position::geometry) as longitude,
    p.jeton_gestion
  from pharmacies p
  where est_admin()
  order by p.nom;
$$;

revoke all on function admin_lister_pharmacies() from public, anon;
grant execute on function admin_lister_pharmacies() to authenticated;

-- ---------------------------------------------------------------
-- Droits : les fonctions de la cascade ne sont appelables que par le serveur
-- (clé de service). Ni le public ni les comptes connectés ne peuvent les appeler.
-- ---------------------------------------------------------------
revoke all on function choisir_pharmacies_alerte(uuid, integer) from public, anon, authenticated;
revoke all on function reserver_cascade(uuid) from public, anon, authenticated;
revoke all on function liberer_cascade(uuid) from public, anon, authenticated;
revoke all on function enregistrer_reponse(text, statut_reponse, text, boolean, boolean, jsonb)
  from public, anon, authenticated;
grant execute on function choisir_pharmacies_alerte(uuid, integer) to service_role;
grant execute on function reserver_cascade(uuid) to service_role;
grant execute on function liberer_cascade(uuid) to service_role;
grant execute on function enregistrer_reponse(text, statut_reponse, text, boolean, boolean, jsonb)
  to service_role;

revoke all on function admin_indicateurs(integer) from public, anon;
grant execute on function admin_indicateurs(integer) to authenticated;

-- ---------------------------------------------------------------
-- Lecture des coordonnées (les colonnes "geography" sont illisibles telles quelles
-- depuis l'application : ces fonctions renvoient latitude et longitude).
-- Réservées au serveur.
-- ---------------------------------------------------------------
create or replace function coordonnees_demande(p_demande uuid)
returns table (latitude double precision, longitude double precision)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select st_y(d.position::geometry), st_x(d.position::geometry)
    from demandes d
   where d.id = p_demande and d.position is not null;
$$;

create or replace function coordonnees_pharmacie(p_pharmacie uuid)
returns table (latitude double precision, longitude double precision)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select st_y(p.position::geometry), st_x(p.position::geometry)
    from pharmacies p
   where p.id = p_pharmacie;
$$;

create or replace function derniere_position_livreur(p_livraison uuid)
returns table (latitude double precision, longitude double precision, cree_le timestamptz)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select st_y(l.position::geometry), st_x(l.position::geometry), l.cree_le
    from positions_livreur l
   where l.livraison_id = p_livraison
   order by l.id desc
   limit 1;
$$;

revoke all on function coordonnees_demande(uuid) from public, anon, authenticated;
revoke all on function coordonnees_pharmacie(uuid) from public, anon, authenticated;
revoke all on function derniere_position_livreur(uuid) from public, anon, authenticated;
grant execute on function coordonnees_demande(uuid) to service_role;
grant execute on function coordonnees_pharmacie(uuid) to service_role;
grant execute on function derniere_position_livreur(uuid) to service_role;
