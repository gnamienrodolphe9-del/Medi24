// Garde dans le téléphone le lien de la dernière demande, pour la retrouver depuis l'accueil.
const CLE = "medi24-derniere-demande";

export function memoriserDemande(jeton: string) {
  try {
    localStorage.setItem(CLE, JSON.stringify({ jeton, le: Date.now() }));
  } catch {
    // Mémoire indisponible : on continue sans.
  }
}

export function lireDemandeMemorisee(): string | null {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return null;
    const donnees = JSON.parse(brut) as { jeton?: string; le?: number };
    // Au-delà de 24 heures, la demande n'est plus proposée.
    if (!donnees.jeton || !donnees.le || Date.now() - donnees.le > 24 * 3600 * 1000) return null;
    return donnees.jeton;
  } catch {
    return null;
  }
}

export function oublierDemande() {
  try {
    localStorage.removeItem(CLE);
  } catch {
    // Rien à faire.
  }
}
