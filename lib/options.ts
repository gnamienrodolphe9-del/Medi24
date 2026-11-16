// Interrupteurs des SMS facultatifs, pour maîtriser le coût du pilote.
// Chacun se règle par une variable d'environnement ("oui" ou "non") sans toucher au code.
//
// Toujours envoyés (indispensables, non réglables) :
//   - le code de vérification du patient ;
//   - les alertes aux pharmacies (première vague, puis vagues suivantes si personne ne répond) ;
//   - le lien envoyé au livreur.

function actif(nom: string, parDefaut: boolean): boolean {
  const valeur = process.env[nom];
  if (valeur === undefined || valeur.trim() === "") return parDefaut;
  return ["1", "oui", "true", "on", "yes"].includes(valeur.trim().toLowerCase());
}

export const options = {
  // SMS au patient quand une pharmacie répond et quand la commande est prête.
  // Désactivé : le patient suit tout dans l'application (la page vibre à chaque changement).
  smsPatient: () => actif("SMS_PATIENT", false),
  // Rappel aux pharmacies qui n'ont pas répondu à 2 minutes.
  smsRappel: () => actif("SMS_RAPPEL", false),
  // SMS à la pharmacie quand le patient a confirmé son choix (retrait ou livraison).
  // Désactivé : la page de la pharmacie se met à jour toute seule.
  smsConfirmationPharmacie: () => actif("SMS_CONFIRMATION_PHARMACIE", false),
  // SMS de 16 h 30 qui demande aux pharmacies de confirmer leur garde.
  smsGardeSoir: () => actif("SMS_GARDE_SOIR", true),
  // Résumé de remise montré au livreur après le code du patient : noms des produits.
  // Activé par défaut : le livreur doit pouvoir vérifier que le sachet qu'il tient est bien la commande
  // qu'il livre. Désactivé (« non ») : il ne voit que le nombre d'articles et le total.
  resumeLivreurProduits: () => actif("RESUME_LIVREUR_PRODUITS", true),
  // Mode test : réservé à vos essais, jamais pendant le vrai pilote.
  //  - le code de vérification s'affiche à l'écran (seulement si SMS_FOURNISSEUR=console) ;
  //  - la page Admin > Messages montre chaque SMS et chaque notification avec son lien cliquable,
  //    sans passer par les journaux de Vercel.
  modeTest: () => actif("MODE_TEST", false),
};
