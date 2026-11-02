// Règles de la cascade d'alertes aux pharmacies (cahier des charges, architecture §6).
// Cette fonction ne touche ni la base ni les SMS : elle décide seulement quoi faire,
// ce qui permet de la tester à fond. L'exécution est dans lib/serveur/cascade.ts.

import { estEnRecherche, type EtatDemande } from "./etats";

export const CASCADE = {
  tailleVague: 3, // pharmacies alertées à chaque vague
  rappelSecondes: 120, // rappel aux pharmacies qui n'ont pas répondu
  vague2Secondes: 240, // vague suivante si personne n'a répondu positivement
  repliSecondes: 360, // liste d'appel directe affichée au patient
  expireSecondes: 1800, // la demande expire
  plafondSms: 9, // maximum de SMS d'alerte par demande
  maxVagues: 3,
} as const;

export type EntreeCascade = {
  etat: EtatDemande;
  ageSecondes: number;
  vaguesEnvoyees: number;
  rappelEnvoye: boolean;
  repliFait: boolean;
  // Pharmacies de garde pas encore alertées pour cette demande.
  pharmaciesRestantes: number;
  // Pharmacies alertées qui n'ont pas encore répondu.
  sansReponse: number;
  smsEnvoyes: number;
};

export type ActionCascade =
  | { type: "expirer" }
  | { type: "envoyer_vague"; vague: number; nombre: number }
  | { type: "rappel"; nombre: number }
  // Affiche la liste d'appel directe. "aucune" : aucune pharmacie n'a pu être alertée.
  | { type: "repli"; aucune: boolean };

export function decider(e: EntreeCascade): ActionCascade[] {
  if (!estEnRecherche(e.etat)) return [];
  if (e.ageSecondes >= CASCADE.expireSecondes) return [{ type: "expirer" }];

  const actions: ActionCascade[] = [];
  let sms = e.smsEnvoyes;
  let restantes = e.pharmaciesRestantes;
  let vagues = e.vaguesEnvoyees;
  let sansReponse = e.sansReponse;

  const envoyerVague = () => {
    const place = CASCADE.plafondSms - sms;
    const nombre = Math.min(CASCADE.tailleVague, restantes, place);
    if (nombre <= 0) return false;
    vagues += 1;
    actions.push({ type: "envoyer_vague", vague: vagues, nombre });
    sms += nombre;
    restantes -= nombre;
    sansReponse += nombre;
    return true;
  };

  // 1. Première vague.
  if (vagues === 0) {
    if (!envoyerVague()) {
      return [{ type: "repli", aucune: true }];
    }
  } else {
    // 2. Rappel aux pharmacies silencieuses.
    if (
      !e.rappelEnvoye &&
      e.ageSecondes >= CASCADE.rappelSecondes &&
      sansReponse > 0
    ) {
      const nombre = Math.min(sansReponse, CASCADE.plafondSms - sms);
      if (nombre > 0) {
        actions.push({ type: "rappel", nombre });
        sms += nombre;
      }
    }

    // 3. Vague suivante : à l'heure prévue, ou tout de suite si toutes les pharmacies
    //    alertées ont déjà répondu "indisponible".
    const toutesRepondu = sansReponse === 0;
    const heureVague2 = vagues === 1 && e.ageSecondes >= CASCADE.vague2Secondes;
    if (
      vagues < CASCADE.maxVagues &&
      restantes > 0 &&
      (toutesRepondu || heureVague2)
    ) {
      envoyerVague();
    }
  }

  // 4. Liste d'appel directe : au bout de 6 minutes, ou quand plus personne ne peut répondre.
  if (!e.repliFait) {
    const plusPersonne = sansReponse === 0 && restantes === 0;
    const plafondAtteint = sms >= CASCADE.plafondSms && sansReponse === 0;
    if (e.ageSecondes >= CASCADE.repliSecondes || plusPersonne || plafondAtteint) {
      actions.push({ type: "repli", aucune: false });
    }
  }

  return actions;
}
