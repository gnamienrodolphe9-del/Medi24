-- Medi24 : schéma initial de la base de données (semaine 1)
-- À exécuter dans l'éditeur SQL de Supabase, ou avec la commande : supabase db push

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------
-- Types énumérés
-- ---------------------------------------------------------------
create type type_demande as enum ('medicament', 'ordonnance', 'symptomes');

create type etat_demande as enum (
  'creee', 'envoyee', 'vue', 'confirmee', 'prete',
  'en_livraison', 'remise', 'annulee', 'expiree', 'repli'
);

create type statut_reponse as enum ('disponible', 'indisponible', 'partiel');
create type canal_alerte as enum ('sms', 'web');
create type etat_livraison as enum ('creee', 'parti', 'arrive', 'remis');
create type mode_remise as enum ('retrait', 'livraison');

-- ---------------------------------------------------------------
-- Pharmacies et gardes
-- ---------------------------------------------------------------
create table pharmacies (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  adresse text,
  repere text,
  position geography(point, 4326) not null,
  numero_ordre text,
  telephone_alerte_1 text not null,
  telephone_alerte_2 text,
  telephone_public text,
  validee boolean not null default false,
  suspendue boolean not null default false,
  cree_le timestamptz not null default now()
);

create table gardes (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references pharmacies (id) on delete cascade,
  debut timestamptz not null,
  fin timestamptz not null,
  confirmee boolean not null default false,
  cree_le timestamptz not null default now(),
  check (fin > debut)
);

-- ---------------------------------------------------------------
-- Demandes des patients
-- ---------------------------------------------------------------
create table demandes (
  id uuid primary key default gen_random_uuid(),
  -- Le jeton secret remplace le compte : il est placé dans l'adresse de la page de suivi.
  jeton text not null unique default encode(gen_random_bytes(24), 'hex'),
  type type_demande not null,
  telephone_patient text not null,
  telephone_verifie boolean not null default false,
  position geography(point, 4326),
  repere text,
  texte_libre text,
  age_texte text,
  poids_kg numeric(5, 1),
  grossesse boolean not null default false,
  allergies text,
  traitements text,
  etat etat_demande not null default 'creee',
  mode mode_remise,
  -- Code à 4 chiffres : saisi par le pharmacien (retrait) ou par le livreur (livraison).
  code_remise text not null default lpad((floor(random() * 10000))::int::text, 4, '0'),
  pharmacie_retenue_id uuid references pharmacies (id),
  consentement boolean not null check (consentement),
  cree_le timestamptz not null default now(),
  mis_a_jour_le timestamptz not null default now()
);

create table lignes_demande (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid not null references demandes (id) on delete cascade,
  produit text not null,
  quantite integer not null default 1 check (quantite > 0)
);

create table ordonnances (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid not null references demandes (id) on delete cascade,
  chemin_fichier text not null,
  -- 90 jours après la remise ; la suppression automatique est mise en place en semaine 9.
  supprimer_apres timestamptz,
  cree_le timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Alertes aux pharmacies et réponses
-- ---------------------------------------------------------------
create table alertes (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid not null references demandes (id) on delete cascade,
  pharmacie_id uuid not null references pharmacies (id),
  canal canal_alerte not null default 'sms',
  -- Lien de réponse de la pharmacie : jeton secret valable 12 heures.
  jeton text not null unique default encode(gen_random_bytes(24), 'hex'),
  vague integer not null default 1,
  envoyee_le timestamptz,
  ouverte_le timestamptz,
  expire_le timestamptz not null default (now() + interval '12 hours'),
  resultat text,
  cree_le timestamptz not null default now()
);

create table reponses (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid not null references demandes (id) on delete cascade,
  pharmacie_id uuid not null references pharmacies (id),
  statut statut_reponse not null,
  avis text,
  retrait_possible boolean not null default true,
  livraison_possible boolean not null default false,
  cree_le timestamptz not null default now(),
  unique (demande_id, pharmacie_id)
);

create table lignes_reponse (
  id uuid primary key default gen_random_uuid(),
  reponse_id uuid not null references reponses (id) on delete cascade,
  produit text not null,
  disponible boolean not null default true,
  substitut text,
  prix_fcfa integer check (prix_fcfa >= 0),
  -- null tant que le patient n'a pas répondu ; décidé produit par produit.
  substitut_accepte boolean
);

-- ---------------------------------------------------------------
-- Livraison
-- ---------------------------------------------------------------
create table livraisons (
  id uuid primary key default gen_random_uuid(),
  reponse_id uuid not null references reponses (id) on delete cascade,
  telephone_livreur text not null,
  jeton text not null unique default encode(gen_random_bytes(24), 'hex'),
  etat etat_livraison not null default 'creee',
  remis_le timestamptz,
  cree_le timestamptz not null default now()
);

-- Supprimées après la course (règle RG11).
create table positions_livreur (
  id bigserial primary key,
  livraison_id uuid not null references livraisons (id) on delete cascade,
  position geography(point, 4326) not null,
  cree_le timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Évaluations, urgences, supervision
-- ---------------------------------------------------------------
create table evaluations (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid not null unique references demandes (id) on delete cascade,
  note integer not null check (note between 1 and 5),
  commentaire text,
  cree_le timestamptz not null default now()
);

create table structures_sante (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  type text,
  adresse text,
  telephone text,
  position geography(point, 4326),
  ouvert_la_nuit boolean not null default true
);

create table journal_alertes (
  id bigserial primary key,
  demande_id uuid references demandes (id) on delete set null,
  evenement text not null,
  detail jsonb,
  cree_le timestamptz not null default now()
);

-- Administrateurs : comptes Supabase Auth autorisés à tout gérer.
create table admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- ---------------------------------------------------------------
-- Index
-- ---------------------------------------------------------------
create index pharmacies_position_idx on pharmacies using gist (position);
create index gardes_periode_idx on gardes (pharmacie_id, debut, fin);
create index demandes_etat_idx on demandes (etat);
create index alertes_demande_idx on alertes (demande_id);
create index reponses_demande_idx on reponses (demande_id);
create index positions_livreur_livraison_idx on positions_livreur (livraison_id, cree_le);

-- ---------------------------------------------------------------
-- Droits d'accès (règles de sécurité par ligne)
-- Principe : aucune table n'est lisible par le public. Les pages patient, pharmacie
-- et livreur passent par des fonctions serveur qui vérifient le jeton secret.
-- Seuls l'annuaire des pharmacies de garde et la liste des structures ouvertes
-- la nuit sont publics.
-- ---------------------------------------------------------------
create or replace function est_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

do $$
declare
  nom_table text;
begin
  foreach nom_table in array array[
    'pharmacies', 'gardes', 'demandes', 'lignes_demande', 'ordonnances',
    'alertes', 'reponses', 'lignes_reponse', 'livraisons', 'positions_livreur',
    'evaluations', 'structures_sante', 'journal_alertes', 'admins'
  ]
  loop
    execute format('alter table %I enable row level security', nom_table);
    execute format('drop policy if exists admin_tout on %I', nom_table);
    execute format(
      'create policy admin_tout on %I for all using (est_admin()) with check (est_admin())',
      nom_table
    );
  end loop;
end
$$;

drop policy if exists structures_publiques on structures_sante;
create policy structures_publiques on structures_sante
  for select using (ouvert_la_nuit);

-- ---------------------------------------------------------------
-- Annuaire public : pharmacies de garde en ce moment, de la plus proche à la plus loin.
-- Ne renvoie que des informations publiques (jamais les numéros d'alerte).
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
