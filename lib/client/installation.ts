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
  android: boolean;
  // Navigateur intégré à une application (Facebook, Instagram…) : il ne sait pas installer.
  integre: boolean;
  // Premier rendu pas encore terminé : ne rien afficher pour éviter un clignotement.
  pret: boolean;
};

const CLE_INSTALLEE = "medi24-installee";

function estInstallee(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  const modes = ["standalone", "minimal-ui", "window-controls-overlay", "fullscreen"];
  const enApplication =
    nav.standalone === true ||
    modes.some((m) => window.matchMedia?.(`(display-mode: ${m})`).matches === true) ||
    document.referrer.startsWith("android-app://");
  try {
    // Mémoire : une fois l'application installée sur cet appareil, on ne la redemande plus,
    // même si la page est ouverte dans un onglet du navigateur.
    if (enApplication) localStorage.setItem(CLE_INSTALLEE, "1");
    return enApplication || localStorage.getItem(CLE_INSTALLEE) === "1";
  } catch {
    return enApplication;
  }
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
    android: false,
    integre: false,
    pret: false,
  });

  useEffect(() => {
    const relire = () =>
      setEtat({
        installee: estInstallee(),
        installable: !!window.__medi24Installation,
        ios: estIos(),
        android: /android/i.test(navigator.userAgent),
        integre: /; wv\)|FBAN|FBAV|Instagram|Line\//i.test(navigator.userAgent),
        pret: true,
      });
    relire();

    const surProposition = (e: Event) => {
      e.preventDefault();
      window.__medi24Installation = e as EvenementInstallation;
      relire();
    };
    const surInstallation = () => {
      try {
        localStorage.setItem(CLE_INSTALLEE, "1");
      } catch {
        // Sans importance.
      }
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
