-- Medi24 : notifications push (pharmacies, patients, livreurs)
-- À exécuter dans l'éditeur SQL de Supabase APRÈS 0005. Peut être relancé sans danger.
--
-- Un appareil (téléphone ou ordinateur) s'abonne en cliquant sur « Activer les alertes ».
-- Il peut être abonné à plusieurs cibles à la fois (par exemple, vos essais : le même
-- téléphone joue la pharmacie ET le patient).
--   cible_type = 'pharmacie'  -> cible_id = id de la pharmacie (toutes ses alertes)
--   cible_type = 'demande'    -> cible_id = id de la demande (le patient)
--   cible_type = 'livraison'  -> cible_id = id de la livraison (le livreur)

create table if not exists abonnements_push (
  id bigint generated always as identity primary key,
  cible_type text not null check (cible_type in ('pharmacie', 'demande', 'livraison')),
  cible_id uuid not null,
  endpoint text not null,
  cle_p256dh text not null,
  cle_auth text not null,
  cree_le timestamptz not null default now(),
  dernier_envoi_le timestamptz,
  unique (cible_type, cible_id, endpoint)
);

create index if not exists abonnements_push_cible on abonnements_push (cible_type, cible_id);
create index if not exists abonnements_push_cree on abonnements_push (cree_le);

-- Accès réservé au serveur (clé secrète). Ni le public ni les comptes connectés n'y touchent :
-- les clés d'un abonnement permettent d'envoyer des notifications à l'appareil.
alter table abonnements_push enable row level security;

revoke all on abonnements_push from public, anon, authenticated;
grant all on abonnements_push to service_role;
grant usage, select on all sequences in schema public to service_role;
