// Calcul du total d'une réponse de pharmacie.
// Un produit disponible compte son prix. Un produit indisponible compte le prix
// de son substitut seulement si le patient l'a accepté.

export type LigneReponse = {
  id: string;
  produit: string;
  disponible: boolean;
  substitut: string | null;
  prix_fcfa: number | null;
  substitut_accepte: boolean | null;
};

export function totalLignes(lignes: LigneReponse[]): { total: number; prixManquant: boolean } {
  let total = 0;
  let prixManquant = false;
  for (const l of lignes) {
    const compte = l.disponible || (l.substitut && l.substitut_accepte === true);
    if (!compte) continue;
    if (l.prix_fcfa == null) prixManquant = true;
    else total += l.prix_fcfa;
  }
  return { total, prixManquant };
}

// Substituts proposés auxquels le patient n'a pas encore répondu.
export function substitutsEnAttente(lignes: LigneReponse[]): LigneReponse[] {
  return lignes.filter((l) => !l.disponible && l.substitut && l.substitut_accepte === null);
}

export function formaterFcfa(montant: number): string {
  return `${Math.round(montant).toLocaleString("fr-FR")} FCFA`;
}
