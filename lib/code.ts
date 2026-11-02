// Code de remise à 4 chiffres : saisi par le pharmacien (retrait) ou le livreur (livraison).
export const ESSAIS_CODE_MAX = 5;

export function codeValide(saisie: string): boolean {
  return /^\d{4}$/.test(saisie);
}

// Comparaison sans arrêt anticipé, pour ne rien révéler par le temps de réponse.
export function codesIdentiques(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
