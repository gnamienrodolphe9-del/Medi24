-- Medi24 : planification des tâches automatiques (cascade, rappels de garde, rapport, purge)
-- À exécuter UNE FOIS, après avoir déployé le site en ligne (Vercel).
--
-- AVANT D'EXÉCUTER, remplacer dans ce fichier :
--   https://VOTRE-SITE.vercel.app   par l'adresse publique du site
--   VOTRE_CRON_SECRET               par la même valeur que la variable CRON_SECRET du site
--
-- Prérequis : Supabase, Database > Extensions : activer "pg_cron" et "pg_net".
-- Les heures de cron sont en UTC, soit l'heure d'Abidjan.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Retire d'anciennes versions des tâches (évite les doublons si on relance ce fichier).
select cron.unschedule(jobname) from cron.job where jobname like 'medi24-%';

-- Cascade des alertes : toutes les minutes.
select cron.schedule('medi24-cascade', '* * * * *', $$
  select net.http_post(
    url := 'https://VOTRE-SITE.vercel.app/api/cron/cascade',
    headers := jsonb_build_object('Authorization', 'Bearer VOTRE_CRON_SECRET')
  );
$$);

-- Confirmation des gardes du soir : tous les jours à 16 h 30.
select cron.schedule('medi24-gardes-soir', '30 16 * * *', $$
  select net.http_post(
    url := 'https://VOTRE-SITE.vercel.app/api/cron/gardes-soir',
    headers := jsonb_build_object('Authorization', 'Bearer VOTRE_CRON_SECRET')
  );
$$);

-- Rapport du matin : tous les jours à 7 h 30.
select cron.schedule('medi24-rapport-matin', '30 7 * * *', $$
  select net.http_post(
    url := 'https://VOTRE-SITE.vercel.app/api/cron/matin',
    headers := jsonb_build_object('Authorization', 'Bearer VOTRE_CRON_SECRET')
  );
$$);

-- Purge (ordonnances de plus de 90 jours, positions de livreurs, codes expirés) : tous les jours à 3 h.
select cron.schedule('medi24-purge', '0 3 * * *', $$
  select net.http_post(
    url := 'https://VOTRE-SITE.vercel.app/api/cron/purge',
    headers := jsonb_build_object('Authorization', 'Bearer VOTRE_CRON_SECRET')
  );
$$);

-- Pour vérifier : select jobname, schedule from cron.job;
-- Pour voir les exécutions : select * from cron.job_run_details order by start_time desc limit 20;
