// Contenu de l'espace Urgence.
// À VÉRIFIER avant le lancement public : numéros saisis de mémoire.
export const NUMERO_SAMU = "185";
export const NUMERO_POMPIERS = "180";

// Signes de gravité : si UN SEUL est présent, on appelle le SAMU tout de suite.
export const SIGNES_GRAVES: { id: string; libelle: string }[] = [
  { id: "respiration", libelle: "Difficulté à respirer, étouffement" },
  { id: "conscience", libelle: "Perte de connaissance, ne répond plus, malaise grave" },
  { id: "thorax", libelle: "Douleur forte dans la poitrine" },
  { id: "saignement", libelle: "Saignement abondant qui ne s'arrête pas" },
  { id: "convulsions", libelle: "Convulsions" },
  { id: "avc", libelle: "Visage qui s'affaisse, bras faible, parole difficile" },
  { id: "empoisonnement", libelle: "Empoisonnement ou médicaments avalés en excès" },
  { id: "grossesse", libelle: "Femme enceinte avec saignement ou fortes douleurs" },
  { id: "nourrisson", libelle: "Nourrisson très mou, fièvre avec pleurs inhabituels" },
  { id: "brulure", libelle: "Brûlure étendue ou accident grave" },
];

// Message à envoyer à un proche pour partager sa position.
export function messagePosition(latitude: number, longitude: number): string {
  const lien = `https://www.google.com/maps?q=${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  return `URGENCE : j'ai besoin d'aide. Voici ma position : ${lien}`;
}
