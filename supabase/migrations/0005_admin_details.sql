-- Medi24 : indicateurs détaillés pour l'administration
-- À exécuter dans l'éditeur SQL de Supabase APRÈS 0003. Peut être relancé sans danger.

-- Indicateurs : ajoute l'identifiant des pharmacies (pour ouvrir leur détail)
-- et la répartition par type de demande.
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
    'par_type', coalesce((
      select jsonb_object_agg(type, n) from (
        select type::text as type, count(*) as n
          from demandes where cree_le >= v_debut group by type
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
          'id', p.id,
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

-- Position d'une demande (latitude, longitude), lisible seulement par un administrateur.
create or replace function admin_position_demande(p_demande uuid)
returns table (latitude double precision, longitude double precision)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select st_y(d.position::geometry), st_x(d.position::geometry)
    from demandes d
   where est_admin() and d.id = p_demande and d.position is not null;
$$;

revoke all on function admin_indicateurs(integer) from public, anon;
grant execute on function admin_indicateurs(integer) to authenticated;
revoke all on function admin_position_demande(uuid) from public, anon;
grant execute on function admin_position_demande(uuid) to authenticated;
