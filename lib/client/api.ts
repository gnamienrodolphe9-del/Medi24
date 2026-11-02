"use client";

import { useCallback, useEffect, useState } from "react";

export type ReponseApi<T> =
  | { ok: true; donnees: T }
  | { ok: false; erreur: string; statut: number };

// Appel d'une route du serveur Medi24. Ne lève jamais d'exception : renvoie ok ou erreur.
export async function appeler<T = unknown>(url: string, init?: RequestInit): Promise<ReponseApi<T>> {
  try {
    const reponse = await fetch(url, { cache: "no-store", ...init });
    const json = (await reponse.json().catch(() => null)) as
      | (T & { erreur?: string })
      | null;
    if (!reponse.ok) {
      return {
        ok: false,
        erreur: (json && json.erreur) || "Une erreur est survenue. Réessayez.",
        statut: reponse.status,
      };
    }
    return { ok: true, donnees: json as T };
  } catch {
    return {
      ok: false,
      erreur: "Connexion impossible. Vérifiez votre réseau puis réessayez.",
      statut: 0,
    };
  }
}

export function envoyerJson<T = unknown>(url: string, corps: unknown): Promise<ReponseApi<T>> {
  return appeler<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
}

// Relit une adresse du serveur à intervalle régulier (suivi en direct sans bibliothèque
// supplémentaire). La lecture se met en pause quand l'écran est caché.
export function useSondage<T>(url: string, intervalleMs: number) {
  const [donnees, setDonnees] = useState<T | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [statut, setStatut] = useState(0);
  const [chargement, setChargement] = useState(true);

  const rafraichir = useCallback(async () => {
    const r = await appeler<T>(url);
    if (r.ok) {
      setDonnees(r.donnees);
      setErreur(null);
      setStatut(200);
    } else {
      setErreur(r.erreur);
      setStatut(r.statut);
    }
    setChargement(false);
  }, [url]);

  useEffect(() => {
    let annule = false;
    let minuteur: ReturnType<typeof setTimeout> | undefined;

    async function boucle() {
      if (!document.hidden) await rafraichir();
      if (!annule) minuteur = setTimeout(boucle, intervalleMs);
    }
    boucle();

    return () => {
      annule = true;
      if (minuteur) clearTimeout(minuteur);
    };
  }, [rafraichir, intervalleMs]);

  return { donnees, erreur, statut, chargement, rafraichir };
}
