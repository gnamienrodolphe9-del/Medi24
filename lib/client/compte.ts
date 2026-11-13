"use client";

import { useCallback, useEffect, useState } from "react";
import { appeler, envoyerJson } from "@/lib/client/api";

type EtatCompte = { charge: boolean; connecte: boolean; telephone: string | null };

// Compte patient : sait si cet appareil est déjà connecté (session mémorisée par le serveur).
export function useCompte() {
  const [etat, setEtat] = useState<EtatCompte>({ charge: false, connecte: false, telephone: null });

  const actualiser = useCallback(async () => {
    const r = await appeler<{ connecte: boolean; telephone?: string }>("/api/compte");
    setEtat({
      charge: true,
      connecte: r.ok && r.donnees.connecte === true,
      telephone: r.ok && r.donnees.connecte ? (r.donnees.telephone ?? null) : null,
    });
  }, []);

  useEffect(() => {
    void actualiser();
  }, [actualiser]);

  const deconnecter = useCallback(async () => {
    await envoyerJson("/api/compte", { action: "deconnexion" });
    setEtat({ charge: true, connecte: false, telephone: null });
  }, []);

  return { ...etat, actualiser, deconnecter };
}

// « +2250700000000 » -> « 07 00 00 00 00 »
export function formaterTelephone(t: string): string {
  const c = t.replace(/^\+225/, "");
  return c.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

// « +2250700000000 » -> « 07 •• •• •• 00 » (affichage discret)
export function masquerTelephone(t: string): string {
  const c = t.replace(/^\+225/, "");
  if (c.length !== 10) return c;
  return `${c.slice(0, 2)} •• •• •• ${c.slice(8)}`;
}
