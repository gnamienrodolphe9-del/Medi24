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
};
