-- Medi24 : l'administration voit combien d'appareils de chaque pharmacie reçoivent les alertes.
-- À exécuter dans l'éditeur SQL de Supabase APRÈS 0006. Peut être relancé sans danger.
-- Les clés des appareils restent invisibles : on ne renvoie que des nombres.

create or replace function admin_appareils_push()
returns table (pharmacie_id uuid, appareils bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not est_admin() then
    raise exception 'Accès réservé aux administrateurs' using errcode = '42501';
  end if;
  return query
    select a.cible_id, count(*)
    from abonnements_push a
    where a.cible_type = 'pharmacie'
    group by a.cible_id;
end;
$$;

revoke all on function admin_appareils_push() from public, anon;
grant execute on function admin_appareils_push() to authenticated;
