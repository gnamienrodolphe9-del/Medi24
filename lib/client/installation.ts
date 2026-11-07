"use client";

import { useCallback, useEffect, useState } from "react";

// Installation de l'application sur l'appareil (écran d'accueil du téléphone ou de l'ordinateur).
// Android et ordinateur : le navigateur propose une fenêtre d'installation, qu'on déclenche
// depuis un bouton. iPhone : aucune fenêtre automatique, il faut guider la personne pas à pas.

type EvenementInstallation = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    // Rempli par le petit script du layout, dès le chargement de la page, car le navigateur
    // n'envoie cet événement qu'une fois.
    __medi24Installation?: EvenementInstallation | null;
  }
}

export type EtatInstallation = {
  // L'application est déjà ouverte depuis l'écran d'accueil.
  installee: boolean;
  // Le navigateur peut ouvrir sa fenêtre d'installation tout de suite.
  installable: boolean;
  // iPhone ou iPad : installation manuelle par le menu Partager.
  ios: boolean;
  // Premier rendu pas encore terminé : ne rien afficher pour éviter un clignotement.
  pret: boolean;
};

function estInstallee(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches === true || nav.standalone === true;
}

function estIos(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return true;
  // iPad récent : se présente comme un Mac mais avec un écran tactile.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function useInstallation() {
  const [etat, setEtat] = useState<EtatInstallation>({
    installee: false,
    installable: false,
    ios: false,
    pret: false,
  });

  useEffect(() => {
    const relire = () =>
      setEtat({
        installee: estInstallee(),
        installable: !!window.__medi24Installation,
        ios: estIos(),
        pret: true,
      });
    relire();

    const surProposition = (e: Event) => {
      e.preventDefault();
      window.__medi24Installation = e as EvenementInstallation;
      relire();
    };
    const surInstallation = () => {
      window.__medi24Installation = null;
      relire();
    };
    window.addEventListener("beforeinstallprompt", surProposition);
    window.addEventListener("appinstalled", surInstallation);
    return () => {
      window.removeEventListener("beforeinstallprompt", surProposition);
      window.removeEventListener("appinstalled", surInstallation);
    };
  }, []);

  // Ouvre la fenêtre d'installation du navigateur. Renvoie "accepte", "refuse" ou
  // "indisponible" (le navigateur n'a pas proposé l'installation : il faut la faire à la main).
  const installer = useCallback(async (): Promise<"accepte" | "refuse" | "indisponible"> => {
    const evenement = window.__medi24Installation;
    if (!evenement) return "indisponible";
    try {
      await evenement.prompt();
      const choix = await evenement.userChoice;
      window.__medi24Installation = null;
      setEtat((e) => ({ ...e, installable: false, installee: choix.outcome === "accepted" || e.installee }));
      return choix.outcome === "accepted" ? "accepte" : "refuse";
    } catch {
      return "indisponible";
    }
  }, []);

  return { ...etat, installer };
}

// Associe le manifeste au lien de la page, pour que l'icône installée rouvre la bonne page
// (voir app/api/manifeste/route.ts) : la pharmacie retrouve sa page de gestion, le patient son
// suivi, le livreur sa course. À appeler sur les pages qui portent un jeton.
export function associerManifeste(): void {
  try {
    const lien = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!lien) return;
    const depart = window.location.pathname + window.location.search;
    lien.href = `/api/manifeste?d=${encodeURIComponent(depart)}`;
  } catch {
    // Sans importance : l'installation fonctionne quand même avec le manifeste par défaut.
  }
}
