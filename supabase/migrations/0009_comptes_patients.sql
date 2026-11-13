-- Medi24 : compte patient (connexion mémorisée sur l'appareil) et historique
-- À exécuter dans l'éditeur SQL de Supabase APRÈS 0008. Peut être relancé sans danger.
--
-- Le numéro de téléphone vérifié identifie le patient. Après un premier code reçu par SMS,
-- l'appareil garde une « session » : le patient ne ressaisit plus de code et retrouve ses demandes.
-- Seul l'empreinte (hash) du jeton de session est conservée ici ; le jeton lui-même reste dans un
-- cookie du téléphone (illisible par les scripts de la page).

create table if not exists sessions_patient (
  id bigint generated always as identity primary key,
  telephone text not null,
  jeton_hash text not null unique,
  cree_le timestamptz not null default now(),
  derniere_utilisation_le timestamptz not null default now(),
  expire_le timestamptz not null
);

create index if not exists sessions_patient_telephone on sessions_patient (telephone);
create index if not exists sessions_patient_expire on sessions_patient (expire_le);

-- Accès réservé au serveur (clé secrète), comme abonnements_push.
alter table sessions_patient enable row level security;
revoke all on sessions_patient from public, anon, authenticated;
grant all on sessions_patient to service_role;
grant usage, select on all sequences in schema public to service_role;
