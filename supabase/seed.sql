-- Données de TEST uniquement : pharmacies fictives autour de Yopougon.
-- Ne jamais exécuter ce fichier sur le projet de production.
-- Les noms, numéros et positions sont inventés pour essayer l'annuaire.

with nouvelles as (
  insert into pharmacies (nom, adresse, repere, position, telephone_alerte_1, telephone_public, validee)
  values
    ('Pharmacie Test 1', '[Adresse test 1]', 'Près du carrefour test',
      st_setsrid(st_makepoint(-4.0830, 5.3350), 4326)::geography, '+2250000000001', '+2250000000001', true),
    ('Pharmacie Test 2', '[Adresse test 2]', 'Près du marché test',
      st_setsrid(st_makepoint(-4.0700, 5.3400), 4326)::geography, '+2250000000002', '+2250000000002', true),
    ('Pharmacie Test 3', '[Adresse test 3]', 'Près de la gare test',
      st_setsrid(st_makepoint(-4.0950, 5.3300), 4326)::geography, '+2250000000003', '+2250000000003', true)
  returning id
)
insert into gardes (pharmacie_id, debut, fin, confirmee)
select id, now() - interval '1 hour', now() + interval '12 hours', true
from nouvelles;

insert into structures_sante (nom, type, adresse, telephone, position, ouvert_la_nuit)
values
  ('[Structure test]', 'Centre de santé', '[Adresse test]', '+2250000000010',
    st_setsrid(st_makepoint(-4.0800, 5.3380), 4326)::geography, true);
