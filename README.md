# Medi24

Plateforme web qui aide un patient à trouver, la nuit, une pharmacie de garde à Yopougon (Abidjan) et son médicament. Ce dépôt contient le **MVP complet** décrit dans le cahier des charges : espace Urgence, demande (nom, ordonnance, symptômes), alertes SMS en cascade aux pharmacies, réponse de la pharmacie par lien, suivi du patient, retrait ou livraison avec code, page livreur, évaluation, et administration.

Sous Windows PowerShell, si `npm` est bloqué, utiliser `npm.cmd` à la place (par exemple `npm.cmd install`).

## Ce qu'il faut sur votre ordinateur

- Node.js 20 ou plus récent, Git
- Un compte gratuit sur [supabase.com](https://supabase.com) et sur [vercel.com](https://vercel.com)

## 1. Installer

```
npm install
npm run typecheck
npm test
```

`npm test` vérifie la logique (cascade, validation, totaux, SMS) : 55 tests doivent réussir.

## 2. Base de données (Supabase, projet d'essai)

Dans l'éditeur SQL, exécuter dans cet ordre (`0001` et `0002` sont déjà faits si vous avez suivi les semaines 1 et 2) :

1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_admin_et_annuaire.sql`
3. **`supabase/migrations/0003_demandes_et_cascade.sql`** (nouveau : cascade, réponses, indicateurs, stockage privé des ordonnances)
4. **`supabase/migrations/0005_admin_details.sql`** (indicateurs détaillés de l'administration)
5. **`supabase/migrations/0006_notifications_push.sql`** (nouveau : appareils abonnés aux notifications)
6. **`supabase/migrations/0007_appareils_push_admin.sql`** (nouveau : l'admin voit les appareils abonnés)
7. **`supabase/migrations/0008_service_de_jour.sql`** (nouveau : demandes aussi en journée)
8. `supabase/seed.sql` (pharmacies fictives, **jamais en production**)

Si Supabase affiche l'avertissement sur la sécurité (RLS) : cliquer « Exécuter et activer RLS ».

Vérification : `select id, nom from pharmacies;` doit montrer vos pharmacies, et Storage doit contenir un espace **ordonnances** (privé).

## 3. Réglages (`.env.local`)

Copier `.env.example` en `.env.local` et remplir. En local, laisser `SMS_FOURNISSEUR=console` : **aucun vrai SMS n'est envoyé**, le texte du SMS s'affiche dans le terminal où tourne `npm run dev`, et le code de vérification s'affiche aussi à l'écran (mode test). Relancer `npm run dev` après chaque modification de `.env.local`.

## 4. Tester toute la chaîne en local (sans payer de SMS)

Ouvrir trois fenêtres du navigateur (une normale, deux en navigation privée) et garder le terminal visible.

1. **Administration** (`/admin`) : créer une pharmacie avec **votre** numéro, la valider, lui ajouter une garde « Cette nuit ». (Les pharmacies fictives du seed sont déjà de garde.)
2. **Patient** (`/demande`) : choisir « Un médicament », écrire un produit, « Utiliser ma position » (ou un repère), saisir un numéro, « Recevoir un code » (le code s'affiche), cocher, envoyer.
3. Dans le **terminal**, vous voyez les SMS simulés avec les liens `/p/...` envoyés aux pharmacies. Copier un lien dans la fenêtre 2 (c'est la **pharmacie**) : répondre « Disponible » ou « Partiel » avec des prix.
4. La page de suivi du patient (fenêtre 1) se met à jour toute seule : choisir retrait ou livraison, répondre aux alternatives, confirmer. Le code à 4 chiffres s'affiche.
5. Côté pharmacie (fenêtre 2) : « Commande prête ». **Retrait** : saisir le code du patient. **Livraison** : saisir un numéro de livreur, le lien `/l/...` apparaît dans le terminal ; l'ouvrir dans la fenêtre 3 (livreur), « Je pars », puis saisir le code.
6. Le patient voit « Remise effectuée » et peut donner son avis (`/evaluation/...`).

Pour la cascade (rappel à 2 min, vague suivante à 4 min, liste d'appel à 6 min, expiration à 30 min), ne répondez pas : la page de suivi fait avancer la cascade à chaque lecture. En production, la tâche planifiée s'en charge (voir ci-dessous).

## 5. Mise en ligne

1. Enregistrer le dossier dans un dépôt Git (GitHub), l'importer dans Vercel.
2. Dans Vercel, ajouter **toutes** les variables de `.env.example` (valeurs du projet Supabase de production quand vous y serez). `NEXT_PUBLIC_SITE_URL` = l'adresse publique du site, sans `/` final.
3. Choisir un `CRON_SECRET` long et aléatoire.
4. Dans Supabase, activer les extensions **pg_cron** et **pg_net** (Database, Extensions), puis ouvrir `supabase/migrations/0004_planification.sql`, **remplacer** l'adresse du site et le secret, et l'exécuter. Cela planifie :
   - toutes les minutes : la cascade d'alertes ;
   - 16 h 30 : SMS de confirmation de garde aux pharmacies ;
   - 7 h 30 : rapport de la nuit (journal + SMS à `ADMIN_TELEPHONE`) ;
   - 3 h : purge (ordonnances de plus de 90 jours, positions de livreurs, codes expirés).
5. Choisir le fournisseur de SMS (voir plus bas) et passer `SMS_FOURNISSEUR`.

## Notifications push et installation de l'application

En plus des SMS, la pharmacie, le patient et le livreur peuvent recevoir des **notifications** sur leur téléphone ou leur ordinateur, **même quand la page est fermée**. Elles sont gratuites, arrivent en une seconde, et s'ajoutent aux SMS : le SMS reste le filet de sécurité (téléphone en économie de batterie, sans internet, notifications coupées).

**Mise en place (une seule fois)**

1. Installer les nouvelles dépendances : `npm.cmd install`.
2. Générer les clés : `npx.cmd web-push generate-vapid-keys`. Mettre la clé publique dans `NEXT_PUBLIC_VAPID_PUBLIC_KEY` et la clé privée (secrète) dans `VAPID_PRIVATE_KEY`, dans `.env.local` **et** dans Vercel. Sans ces clés, les notifications sont simplement désactivées.
3. Exécuter `0006_notifications_push.sql` dans Supabase.
4. Redéployer.

**Ce que voit chaque personne** : un encart « Installer et activer les alertes » (page de gestion de la pharmacie, page de réponse à une alerte, suivi du patient, page du livreur). Un seul bouton propose l'installation de l'application sur l'appareil, puis demande l'autorisation des notifications. Sur iPhone, l'encart explique les trois gestes (Partager, « Sur l'écran d'accueil », puis rouvrir l'application) : les notifications n'y marchent qu'une fois l'application installée. Le bouton « Essayer » envoie une notification d'essai.

**Qui est prévenu, et quand**

| Événement | Notification à | SMS |
| --- | --- | --- |
| Nouvelle demande, rappel à 2 min | Pharmacie | Oui (alerte) ; rappel selon `SMS_RAPPEL` |
| Garde du soir (16 h 30) | Pharmacie | Selon `SMS_GARDE_SOIR` |
| Une pharmacie répond | Patient | Selon `SMS_PATIENT` |
| Le patient confirme retrait ou livraison | Pharmacie | Selon `SMS_CONFIRMATION_PHARMACIE` |
| Commande prête | Patient, et livreur si livraison | Patient selon `SMS_PATIENT` |
| Course à faire | — (le livreur n'a pas encore ouvert son lien) | Oui |

**QR code des pharmacies** : Admin, Pharmacies, « Afficher le QR code ». La pharmacie le scanne, sa page de gestion s'ouvre, elle touche « Installer et activer les alertes ». Ce QR code donne accès à la pharmacie : le montrer sur votre écran, ne pas l'imprimer.

**Lien du livreur** : si le SMS n'arrive pas, la page de la pharmacie affiche le lien avec « WhatsApp » et « Copier le lien ».

## Espace de la pharmacie et demandes en journée

**Mon espace** (`/pharmacie/gardes?j=...`, ouvert par le QR code) est la seule page dont la pharmacie a besoin :

1. un encart « Installer, puis activer les alertes » (une seule fois) ;
2. les **demandes des patients**, qui arrivent toutes seules (relecture toutes les 5 secondes, bip et vibration à chaque nouvelle demande, compteur dans le titre de l'onglet) avec un bouton « Répondre » ; la notification et le SMS partent en même temps, pour le cas où l'écran est verrouillé ;
3. l'interrupteur **Demandes en journée** ;
   (une pharmacie peut avoir **plusieurs demandes en même temps** : chacune a sa carte et sa notification, la plus ancienne en premier) ;
4. ses gardes (confirmation).

**Demandes en journée** (migration `0008`) : en plus des pharmacies de garde, toute pharmacie validée reçoit les demandes de **7 h à 20 h** (heure d'Abidjan), même sans garde enregistrée. Elle peut se mettre en pause depuis « Mon espace ». Les gardes de nuit et le SMS de 16 h 30 ne changent pas. Pour changer les horaires d'une pharmacie, dans Supabase : `update pharmacies set jour_debut = '08:00', jour_fin = '19:00' where nom = '...';`. Pour désactiver le service de jour partout : `update pharmacies set service_jour = false;`.

## Changer les couleurs de chaque espace

Tout se règle dans **`app/globals.css`** (aucun autre fichier à toucher) :

1. **Espace patient** (accueil, demande, suivi, urgence, avis) : le bloc `@theme` en haut. Changez la valeur d'une couleur, par exemple `--color-vert: #0a6847;`.
2. **Pharmacie, livreur, admin** : plus bas, section « COULEURS PAR ESPACE ». Chaque espace a son bloc (`[data-espace="pharmacie"]`, `"livreur"`, `"admin"`) avec des lignes en commentaire. Retirez le commentaire d'une ligne et changez la couleur : seul cet espace change.

Les noms de couleurs : `vert` (boutons, onglet actif), `vert-clair` (messages, onglets inactifs), `vert-fonce` (texte sur vert-clair), `fond` (fond de page), `encre` (texte), `discret` (texte secondaire), `trait` (bordures claires), `bordure` (bordure des champs), `rouge`, `rouge-clair`, `rouge-fonce` (erreurs), `ambre`, `ambre-fonce` (avertissements). Le nom « vert » est historique : il désigne la couleur principale, quelle qu'elle soit.

Après modification : enregistrer, `git push`, attendre le déploiement. En local, la page se met à jour toute seule. Pour choisir des couleurs bien lisibles, garder un bon contraste entre `vert` et le blanc (texte des boutons) ; un outil gratuit de contraste (« WebAIM contrast checker ») aide. Deux endroits restent écrits en dur : la couleur de la barre du navigateur (`themeColor` dans `app/layout.tsx` et `theme_color` dans `public/manifest.webmanifest`) et les icônes dans `public/icons`.

## Mode test (vos essais, sans les journaux de Vercel)

Avec `MODE_TEST=oui` : le code de vérification s'affiche à l'écran (seulement avec `SMS_FOURNISSEUR=console`) et **Admin, Messages** liste chaque SMS et chaque notification avec son texte et son lien cliquable (« Ouvrir la page »). **À retirer avant le vrai pilote** : ce mode garde les numéros et les liens dans le journal. Avec un vrai fournisseur SMS (`smspro`), le code n'est jamais affiché à l'écran.

## Fournisseur SMS

L'application parle à un « fournisseur » par une interface unique (`lib/sms/types.ts`). Fournis : `console` (test), `smspro` (SMS Pro Africa) et `twilio`. Pour un opérateur ou agrégateur local, copier `lib/sms/twilio.ts`, adapter l'appel HTTP à sa documentation, puis l'ajouter dans `lib/sms/index.ts`. Demander des devis à plusieurs fournisseurs : les prix de l'ordre de grandeur cités pendant le cadrage sont indicatifs. Les SMS sont écrits **sans accents** exprès (160 caractères par SMS au lieu de 70).

### Maîtriser le coût des SMS

Par défaut, seuls trois SMS partent : le **code de vérification**, les **alertes aux pharmacies** et le **lien du livreur**. Tout le reste se passe dans l'application : la page du patient et celle de la pharmacie se mettent à jour toutes seules, vibrent et changent de titre à chaque événement. Quatre interrupteurs (variables d'environnement, valeur `oui` ou `non`) permettent de réactiver les SMS facultatifs :

| Variable | Défaut | Effet |
| --- | --- | --- |
| `SMS_PATIENT` | non | SMS au patient quand une pharmacie répond et quand la commande est prête |
| `SMS_RAPPEL` | non | Rappel aux pharmacies silencieuses à 2 minutes |
| `SMS_CONFIRMATION_PHARMACIE` | non | SMS à la pharmacie quand le patient a confirmé son choix |
| `SMS_GARDE_SOIR` | oui | SMS de 16 h 30 pour confirmer la garde (environ 1 SMS par pharmacie et par jour) |

Contrepartie : un patient ou une pharmacie qui ferme la page ne reçoit plus d'avis. Le patient retrouve sa demande depuis l'accueil (24 heures), la pharmacie rouvre le lien de l'alerte.

## Comment ça marche

| Écran | Adresse | Qui |
| --- | --- | --- |
| Accueil, Urgence, pharmacies de garde | `/`, `/urgence`, `/pharmacies-de-garde` | Public |
| Demande | `/demande` | Patient |
| Suivi (temps réel par relecture toutes les 4 s) | `/suivi/[jeton]` | Patient, par lien secret |
| Évaluation | `/evaluation/[jeton]` | Patient, après remise |
| Réponse à une demande | `/p/[jeton]` | Pharmacie, par SMS (valable 12 h) |
| Planning de garde, historique | `/pharmacie/gardes?j=…`, `/pharmacie/historique?j=…` | Pharmacie, lien de gestion donné par l'admin |
| Course | `/l/[jeton]` | Livreur, par SMS |
| Administration | `/admin/...` | Vous (compte Supabase) |

Dans l'administration, **chaque indicateur est cliquable** : les tuiles ouvrent la liste détaillée (demandes, avis, journal des SMS), une demande ouvre sa fiche complète (patient, pharmacies alertées, réponses, prix, livraison, avis, chronologie), une pharmacie ouvre ses statistiques et son historique. Les listes de demandes et d'avis s'exportent en CSV **sans numéro de patient**, pour servir de preuve.

Règles appliquées par le code :
- La première réponse « disponible » ou « partiel » retient la demande, de façon atomique (une seule pharmacie). Un « partiel » peut être remplacé par un « disponible » d'une autre pharmacie dans les 3 minutes, tant que le patient n'a pas confirmé.
- Cascade : 3 pharmacies les plus proches (gardes confirmées d'abord) ; rappel à 2 min ; 3 suivantes à 4 min (ou tout de suite si toutes ont répondu « indisponible ») ; liste d'appel directe à 6 min ; expiration à 30 min ; **9 SMS d'alerte au maximum** par demande. Si aucun SMS ne part, la liste d'appel s'affiche aussitôt et vous êtes prévenu par SMS.
- Code de remise à 4 chiffres, 5 essais au maximum, saisi par le pharmacien (retrait) ou le livreur (livraison).
- Le numéro du patient n'est visible que par la pharmacie retenue (après son choix) et par le livreur pendant la course. La position du livreur est supprimée à la remise. L'ordonnance est effacée 90 jours après la remise.
- Limites : 3 codes SMS par heure et par numéro, 3 demandes par heure et par numéro. Produits stupéfiants refusés (liste de départ dans `lib/validation.ts`, **à faire relire par un pharmacien**).
- Aucun accès aux tables depuis le navigateur sauf l'annuaire de garde et les structures ouvertes la nuit : tout le reste passe par le serveur, qui vérifie le jeton.

## Organisation des dossiers

| Dossier | Contenu |
| --- | --- |
| `app/` | Pages et routes du serveur (`app/api/...`) |
| `components/` | Éléments d'interface (formulaire de demande, cartes, éléments communs) |
| `lib/` | Logique pure testée (`cascade.ts`, `validation.ts`, `totaux.ts`, `messages.ts`, `etats.ts`, `code.ts`) |
| `lib/serveur/` | Code qui touche la base et les SMS (cascade, suivi, vue pharmacie, tâches) |
| `lib/client/` | Aides du navigateur (appels, position, compression de photo) |
| `lib/sms/` | Fournisseurs de SMS |
| `supabase/migrations/` | Tables, sécurité, fonctions, planification |
| `tests/` | Tests de la logique |

## Limites connues de cette version

- Le suivi en direct relit le serveur toutes les 4 à 6 secondes (plus simple et plus sûr que Realtime pour le pilote).
- Pas de limitation par adresse IP : activer le pare-feu de Vercel si besoin.
- La carte utilise les serveurs publics d'OpenStreetMap, suffisant pour le pilote.
- Paiement en espèces seulement.

## À faire avant le lancement public

- Vérifier les numéros d'urgence dans `lib/urgence.ts` (185 SAMU et 180 pompiers saisis de mémoire) et remplir la liste des structures de santé dans l'administration.
- Faire valider avec l'Ordre des pharmaciens et l'ARTCI les points de conformité du cahier des charges, et relire le texte de consentement du formulaire.
- Faire relire la liste de produits exclus par un pharmacien.
- Choisir le fournisseur SMS, faire un test réel avec 2 ou 3 pharmacies amies et votre propre téléphone, sur une connexion mobile lente.
- Supprimer les pharmacies fictives du seed.
- Vérifier que le projet Supabase de production a une sauvegarde automatique (plan payant) ou faire un export régulier.
