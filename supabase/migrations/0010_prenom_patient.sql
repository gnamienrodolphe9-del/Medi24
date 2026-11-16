-- Medi24 : prénom du patient (obligatoire dans le formulaire)
-- À exécuter dans l'éditeur SQL de Supabase APRÈS 0009. Peut être relancé sans danger.
--
-- Le prénom s'affiche dans le résumé de remise : le pharmacien ou le livreur peut s'assurer que la
-- commande correspond bien à la personne qui se présente. Les anciennes demandes n'en ont pas (colonne vide).

alter table demandes add column if not exists prenom_patient text;
