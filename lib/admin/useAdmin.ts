"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/client";

export type EtatAdmin = "chargement" | "admin" | "non-admin" | "erreur";

// Vérifie que la personne est connectée ET administrateur.
// Non connectée : renvoie vers la page de connexion.
// Connectée mais pas administrateur : le contenu reste caché.
// La vraie protection est dans la base (règles de sécurité) ; ce contrôle ne sert
// qu'à afficher ou non les écrans d'administration.
export function useAdmin() {
  const routeur = useRouter();
  const [etat, setEtat] = useState<EtatAdmin>("chargement");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;

    async function verifier() {
      try {
        const supabase = creerClientNavigateur();
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          routeur.replace("/admin/connexion");
          return;
        }
        const { data: estAdmin, error } = await supabase.rpc("suis_admin");
        if (annule) return;
        setEmail(data.session.user.email ?? null);
        setEtat(!error && estAdmin === true ? "admin" : "non-admin");
      } catch {
        if (!annule) setEtat("erreur");
      }
    }

    verifier();
    return () => {
      annule = true;
    };
  }, [routeur]);

  const deconnexion = useCallback(async () => {
    try {
      await creerClientNavigateur().auth.signOut();
    } finally {
      routeur.replace("/admin/connexion");
    }
  }, [routeur]);

  return { etat, email, deconnexion };
}
