-- Medi24 : semaine 2 (annuaire et administration)
-- À exécuter dans l'éditeur SQL de Supabase APRÈS 0001_schema.sql.

-- ---------------------------------------------------------------
-- Correctif de robustesse : les fonctions ci-dessous cherchent aussi dans le schéma
-- "extensions", où Supabase installe parfois PostGIS et pgcrypto.
-- ---------------------------------------------------------------
create or replace function pharmacies_de_garde(
  lat double precision,
  lng double precision,
  limite integer default 10
)
returns table (
  id uuid,
  nom text,
  adresse text,
  repere text,
  telephone_public text,
  latitude double precision,
  longitude double precision,
  distance_m double precision,
  garde_fin timestamptz,
  garde_confirmee boolean
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    p.id,
    p.nom,
    p.adresse,
    p.repere,
    p.telephone_public,
    st_y(p.position::geometry) as latitude,
    st_x(p.position::geometry) as longitude,
    st_distance(p.position, st_setsrid(st_makepoint(lng, lat), 4326)::geography) as distance_m,
    g.fin as garde_fin,
    g.confirmee as garde_confirmee
  from pharmacies p
  join gardes g on g.pharmacie_id = p.id
  where p.validee
    and not p.suspendue
    and now() between g.debut and g.fin
  order by distance_m
  limit limite;
$$;

grant execute on function pharmacies_de_garde(double precision, double precision, integer)
  to anon, authenticated;

-- ---------------------------------------------------------------
-- Savoir si la personne connectée est administrateur (pour afficher ou non l'administration).
-- ---------------------------------------------------------------
create or replace function suis_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select est_admin();
$$;

revoke all on function suis_admin() from public, anon;
grant execute on function suis_admin() to authenticated;

-- ---------------------------------------------------------------
-- Administration des pharmacies : lecture avec latitude et longitude.
-- Si la personne n'est pas administrateur, la fonction ne renvoie aucune ligne.
-- ---------------------------------------------------------------
create or replace function admin_lister_pharmacies()
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
  longitude double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    p.id,
    p.nom,
    p.adresse,
    p.repere,
    p.numero_ordre,
    p.telephone_alerte_1,
    p.telephone_alerte_2,
    p.telephone_public,
    p.validee,
    p.suspendue,
    st_y(p.position::geometry) as latitude,
    st_x(p.position::geometry) as longitude
  from pharmacies p
  where est_admin()
  order by p.nom;
$$;

revoke all on function admin_lister_pharmacies() from public, anon;
grant execute on function admin_lister_pharmacies() to authenticated;

-- ---------------------------------------------------------------
-- Administration des pharmacies : création. Une pharmacie créée n'est PAS validée :
-- l'administrateur doit la valider après avoir vérifié son numéro d'ordre.
-- ---------------------------------------------------------------
create or replace function admin_creer_pharmacie(
  p_nom text,
  p_adresse text,
  p_repere text,
  p_latitude double precision,
  p_longitude double precision,
  p_telephone_alerte_1 text,
  p_telephone_alerte_2 text,
  p_telephone_public text,
  p_numero_ordre text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if not est_admin() then
    raise exception 'Accès réservé aux administrateurs' using errcode = '42501';
  end if;

  insert into pharmacies (
    nom, adresse, repere, position,
    telephone_alerte_1, telephone_alerte_2, telephone_public, numero_ordre
  )
  values (
    p_nom,
    nullif(p_adresse, ''),
    nullif(p_repere, ''),
    st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography,
    p_telephone_alerte_1,
    nullif(p_telephone_alerte_2, ''),
    nullif(p_telephone_public, ''),
    nullif(p_numero_ordre, '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function admin_creer_pharmacie(
  text, text, text, double precision, double precision, text, text, text, text
) from public, anon;
grant execute on function admin_creer_pharmacie(
  text, text, text, double precision, double precision, text, text, text, text
) to authenticated;

-- ---------------------------------------------------------------
-- COMMENT CRÉER UN ADMINISTRATEUR (à faire une seule fois, à la main) :
-- 1. Dans Supabase : Authentication > Users > Add user, avec votre e-mail et un mot de passe.
-- 2. Dans l'éditeur SQL, en remplaçant l'adresse e-mail par la vôtre :
--
--    insert into admins (user_id)
--    select id from auth.users where email = 'votre@email.com';
-- ---------------------------------------------------------------
