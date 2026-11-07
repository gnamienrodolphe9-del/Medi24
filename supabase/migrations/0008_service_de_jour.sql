-- Medi24 : les pharmacies peuvent aussi recevoir des demandes en journée (hors garde de nuit)
-- À exécuter dans l'éditeur SQL de Supabase APRÈS 0007. Peut être relancé sans danger.
--
-- Une pharmacie validée avec service_jour = vrai reçoit les demandes entre jour_debut et jour_fin
-- (heure d'Abidjan), même sans garde enregistrée. La pharmacie peut couper ce service depuis son
-- espace (« pause »). Les gardes de nuit et la confirmation de 16 h 30 ne changent pas.
-- Abidjan est à l'heure UTC, sans changement d'heure.

alter table pharmacies add column if not exists service_jour boolean not null default true;
alter table pharmacies add column if not exists jour_debut time not null default '07:00';
alter table pharmacies add column if not exists jour_fin time not null default '20:00';

-- Choix des pharmacies à alerter : gardes en cours OU service de jour actif.
-- Ordre : d'abord les pharmacies sûres (garde confirmée ou service de jour actif), puis les gardes
-- non confirmées ; à rang égal, la plus proche du patient.
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
    (coalesce(bool_or(g.confirmee), false) or j.en_service) as garde_confirmee
  from pharmacies p
  cross join d
  cross join lateral (
    select (
      p.service_jour
      and (now() at time zone 'Africa/Abidjan')::time between p.jour_debut and p.jour_fin
    ) as en_service
  ) j
  left join gardes g on g.pharmacie_id = p.id and now() between g.debut and g.fin
  where p.validee
    and not p.suspendue
    and (g.id is not null or j.en_service)
    and not exists (
      select 1 from alertes a where a.demande_id = p_demande and a.pharmacie_id = p.id
    )
  group by p.id, p.nom, p.telephone_alerte_1, p.telephone_alerte_2, p.position, d.pos, j.en_service
  order by (coalesce(bool_or(g.confirmee), false) or j.en_service) desc, st_distance(p.position, d.pos)
  limit p_limite;
$$;

revoke all on function choisir_pharmacies_alerte(uuid, integer) from public, anon, authenticated;
grant execute on function choisir_pharmacies_alerte(uuid, integer) to service_role;

-- Liste admin des pharmacies : ajoute le service de jour (la liste de colonnes change : on la recrée).
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
  jeton_gestion text,
  service_jour boolean,
  jour_debut text,
  jour_fin text
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
    p.jeton_gestion,
    p.service_jour,
    to_char(p.jour_debut, 'HH24:MI') as jour_debut,
    to_char(p.jour_fin, 'HH24:MI') as jour_fin
  from pharmacies p
  where est_admin()
  order by p.nom;
$$;
revoke all on function admin_lister_pharmacies() from public, anon;
grant execute on function admin_lister_pharmacies() to authenticated;
