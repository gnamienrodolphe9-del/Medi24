// Les jetons secrets des liens (suivi, pharmacie, livreur) sont 24 octets en hexadécimal.
// Vérifier le format évite d'interroger la base avec n'importe quoi.
export function jetonValide(valeur: unknown): valeur is string {
  return typeof valeur === "string" && /^[0-9a-f]{48}$/.test(valeur);
}
