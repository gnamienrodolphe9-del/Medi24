// Aides communes aux pages de détail de l'administration.
import type { EtatDemande } from "@/lib/etats";

// PostgREST renvoie parfois un objet, parfois une liste d'un élément, pour une relation.
export function un<T>(valeur: T | T[] | null | undefined): T | null {
  if (valeur === null || valeur === undefined) return null;
  return Array.isArray(valeur) ? (valeur[0] ?? null) : valeur;
}

export const TYPES_LIBELLES: Record<string, string> = {
  medicament: "Par nom",
  ordonnance: "Ordonnance",
  symptomes: "Symptômes",
};

export const ETATS_TOUS: EtatDemande[] = [
  "creee", "envoyee", "vue", "confirmee", "prete", "en_livraison", "remise", "annulee", "expiree", "repli",
];

// 95 s devient "1 min 35 s", 4 000 s devient "1 h 07 min".
export function formaterDuree(secondes: number | null | undefined): string {
  if (secondes === null || secondes === undefined || !Number.isFinite(secondes)) return "—";
  const s = Math.max(0, Math.round(secondes));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} min`;
}

export function ecartSecondes(debutIso: string | null | undefined, finIso: string | null | undefined): number | null {
  if (!debutIso || !finIso) return null;
  return (new Date(finIso).getTime() - new Date(debutIso).getTime()) / 1000;
}

// Début de la période choisie (null = depuis toujours).
export function depuisJours(jours: number): string | null {
  return jours > 0 ? new Date(Date.now() - jours * 86400 * 1000).toISOString() : null;
}

// +2250700000000 devient +225 07 00 00 00 00 pour la lecture.
export function afficherTelephone(telephone: string | null | undefined): string {
  if (!telephone) return "—";
  const m = telephone.match(/^\+225(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  return m ? `+225 ${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}` : telephone;
}

// Cellule de fichier CSV : guillemets doublés, protection contre les formules de tableur.
export function celluleCsv(valeur: unknown): string {
  let texte = valeur === null || valeur === undefined ? "" : String(valeur);
  if (/^[=+\-@]/.test(texte)) texte = `'${texte}`;
  return `"${texte.replace(/"/g, '""')}"`;
}

export function telechargerCsv(nomFichier: string, lignes: unknown[][]) {
  const contenu = "﻿" + lignes.map((l) => l.map(celluleCsv).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8" }));
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}

export function lireParametre(nom: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(nom);
}
