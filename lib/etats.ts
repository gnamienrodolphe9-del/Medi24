// États d'une demande et règles simples qui en découlent.

export type EtatDemande =
  | "creee"
  | "envoyee"
  | "vue"
  | "confirmee"
  | "prete"
  | "en_livraison"
  | "remise"
  | "annulee"
  | "expiree"
  | "repli";

// La demande cherche encore une pharmacie : la cascade d'alertes travaille.
export const ETATS_RECHERCHE: EtatDemande[] = ["creee", "envoyee", "vue"];

// Une pharmacie a pris la demande en charge.
export const ETATS_EN_COURS: EtatDemande[] = ["confirmee", "prete", "en_livraison"];

// Plus rien à faire sur cette demande.
export const ETATS_TERMINES: EtatDemande[] = ["remise", "annulee", "expiree", "repli"];

export function estEnRecherche(etat: EtatDemande): boolean {
  return ETATS_RECHERCHE.includes(etat);
}

export function estTermine(etat: EtatDemande): boolean {
  return ETATS_TERMINES.includes(etat);
}

const LIBELLES: Record<EtatDemande, string> = {
  creee: "Demande créée",
  envoyee: "Pharmacies alertées",
  vue: "Une pharmacie regarde votre demande",
  confirmee: "Une pharmacie a répondu",
  prete: "Commande prête",
  en_livraison: "Livraison en cours",
  remise: "Remise effectuée",
  annulee: "Demande annulée",
  expiree: "Demande expirée",
  repli: "Appelez directement une pharmacie",
};

export function libelleEtat(etat: EtatDemande): string {
  return LIBELLES[etat] ?? etat;
}
