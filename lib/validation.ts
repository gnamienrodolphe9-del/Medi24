// Validation et nettoyage d'une demande de patient (côté navigateur ET côté serveur :
// le serveur ne fait jamais confiance au navigateur).

import { normaliserTelephoneCi } from "./telephone";

export type TypeDemande = "medicament" | "ordonnance" | "symptomes";

export type EntreeDemande = {
  type: unknown;
  telephone: unknown;
  produits: unknown; // une chaîne par produit
  texteLibre: unknown;
  age: unknown;
  poidsKg: unknown;
  grossesse: unknown;
  allergies: unknown;
  traitements: unknown;
  consentement: unknown;
  latitude: unknown;
  longitude: unknown;
  repere: unknown;
  avecOrdonnance: boolean; // une photo d'ordonnance accompagne la demande
};

export type LigneDemandeValide = { produit: string; quantite: number };

export type DemandeValide = {
  type: TypeDemande;
  telephone: string;
  lignes: LigneDemandeValide[];
  texteLibre: string | null;
  age: string | null;
  poidsKg: number | null;
  grossesse: boolean;
  allergies: string | null;
  traitements: string | null;
  latitude: number | null;
  longitude: number | null;
  repere: string | null;
};

export const LIMITES = {
  produitsMax: 10,
  produitMin: 2,
  produitMax: 120,
  symptomesMin: 10,
  symptomesMax: 600,
  champCourtMax: 300,
  repereMax: 200,
} as const;

// Produits qui ne peuvent pas être demandés sur Medi24 (stupéfiants et opioïdes forts).
// Liste de départ à faire relire par un pharmacien avant le lancement.
const PRODUITS_EXCLUS = [
  "morphine",
  "fentanyl",
  "oxycodone",
  "methadone",
  "pethidine",
  "tramadol",
  "codeine",
  "heroine",
  "cocaine",
  "cannabis",
  "opium",
  "buprenorphine",
];

export function sansAccents(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function contientProduitExclu(texte: string): boolean {
  const net = sansAccents(texte).toLowerCase();
  return PRODUITS_EXCLUS.some((p) => net.includes(p));
}

function texte(valeur: unknown, max: number): string | null {
  if (typeof valeur !== "string") return null;
  const net = valeur.replace(/\s+/g, " ").trim();
  if (!net) return null;
  return net.slice(0, max);
}

// "Doliprane 1000 x2" donne { produit: "Doliprane 1000", quantite: 2 }.
export function lireLigneProduit(brut: string): LigneDemandeValide | null {
  const net = brut.replace(/\s+/g, " ").trim();
  if (!net) return null;
  const m = net.match(/^(.*?)\s*[x×]\s*(\d{1,2})$/i);
  if (m && m[1].trim().length >= 1) {
    const quantite = Number(m[2]);
    if (quantite >= 1) return { produit: m[1].trim(), quantite };
  }
  return { produit: net, quantite: 1 };
}

export function validerDemande(
  e: EntreeDemande
): { ok: true; valeur: DemandeValide } | { ok: false; erreurs: string[] } {
  const erreurs: string[] = [];

  const type: TypeDemande | null =
    e.type === "medicament" || e.type === "ordonnance" || e.type === "symptomes"
      ? e.type
      : null;
  if (!type) erreurs.push("Type de demande inconnu.");

  const telephone =
    typeof e.telephone === "string" ? normaliserTelephoneCi(e.telephone) : null;
  if (!telephone) erreurs.push("Le numéro de téléphone doit avoir 10 chiffres.");

  if (e.consentement !== true) {
    erreurs.push("Vous devez accepter l'utilisation de vos informations pour continuer.");
  }

  // Produits
  const lignes: LigneDemandeValide[] = [];
  if (Array.isArray(e.produits)) {
    for (const brut of e.produits) {
      if (typeof brut !== "string") continue;
      const ligne = lireLigneProduit(brut);
      if (!ligne) continue;
      if (ligne.produit.length < LIMITES.produitMin) {
        erreurs.push(`« ${ligne.produit} » est trop court.`);
        continue;
      }
      if (ligne.produit.length > LIMITES.produitMax) {
        erreurs.push(`« ${ligne.produit.slice(0, 20)}… » est trop long.`);
        continue;
      }
      lignes.push(ligne);
    }
  }
  if (lignes.length > LIMITES.produitsMax) {
    erreurs.push(`Pas plus de ${LIMITES.produitsMax} produits par demande.`);
  }
  if (lignes.some((l) => contientProduitExclu(l.produit))) {
    erreurs.push(
      "Ce produit ne peut pas être demandé sur Medi24. Rendez-vous directement en pharmacie."
    );
  }

  const texteLibre = texte(e.texteLibre, LIMITES.symptomesMax);
  const age = texte(e.age, 40);
  const allergies = texte(e.allergies, LIMITES.champCourtMax);
  const traitements = texte(e.traitements, LIMITES.champCourtMax);

  if (type === "medicament" && lignes.length === 0) {
    erreurs.push("Indiquez au moins un médicament.");
  }
  if (type === "ordonnance" && !e.avecOrdonnance) {
    erreurs.push("Ajoutez la photo de l'ordonnance.");
  }
  if (type === "symptomes") {
    if (!texteLibre || texteLibre.length < LIMITES.symptomesMin) {
      erreurs.push("Décrivez les symptômes en quelques mots (10 caractères au moins).");
    }
    if (!age) erreurs.push("Indiquez l'âge de la personne malade.");
    if (texteLibre && contientProduitExclu(texteLibre)) {
      erreurs.push("Cette demande ne peut pas être traitée sur Medi24.");
    }
  }

  let poidsKg: number | null = null;
  if (e.poidsKg !== undefined && e.poidsKg !== null && e.poidsKg !== "") {
    const n = Number(String(e.poidsKg).replace(",", "."));
    if (!Number.isFinite(n) || n < 1 || n > 300) {
      erreurs.push("Le poids doit être compris entre 1 et 300 kg.");
    } else {
      poidsKg = Math.round(n * 10) / 10;
    }
  }

  // Position : GPS ou repère écrit. Au moins l'un des deux.
  let latitude: number | null = null;
  let longitude: number | null = null;
  if (
    e.latitude !== undefined && e.latitude !== null && e.latitude !== "" &&
    e.longitude !== undefined && e.longitude !== null && e.longitude !== ""
  ) {
    const lat = Number(e.latitude);
    const lng = Number(e.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      latitude = lat;
      longitude = lng;
    } else {
      erreurs.push("La position envoyée est invalide.");
    }
  }
  const repere = texte(e.repere, LIMITES.repereMax);
  if (latitude === null && (!repere || repere.length < 3)) {
    erreurs.push("Partagez votre position ou indiquez un repère (quartier, carrefour…).");
  }

  if (erreurs.length > 0 || !type || !telephone) return { ok: false, erreurs };

  return {
    ok: true,
    valeur: {
      type,
      telephone,
      lignes,
      texteLibre,
      age,
      poidsKg,
      grossesse: e.grossesse === true,
      allergies,
      traitements,
      latitude,
      longitude,
      repere,
    },
  };
}

// Photo d'ordonnance : le navigateur la compresse avant l'envoi, le serveur revérifie.
export const ORDONNANCE = {
  tailleMaxOctets: 3 * 1024 * 1024,
  typesAcceptes: ["image/jpeg", "image/png", "image/webp"],
} as const;

export function validerFichierOrdonnance(type: string, taille: number): string | null {
  if (!(ORDONNANCE.typesAcceptes as readonly string[]).includes(type)) {
    return "La photo doit être au format JPEG, PNG ou WebP.";
  }
  if (taille <= 0) return "La photo est vide.";
  if (taille > ORDONNANCE.tailleMaxOctets) return "La photo est trop lourde (3 Mo au maximum).";
  return null;
}
