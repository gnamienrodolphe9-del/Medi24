"use client";

import { useEffect } from "react";

// Enregistre le service worker pour que la page Urgence reste disponible hors ligne.
// Actif seulement en production, pour ne pas gêner le développement.
export default function EnregistrementServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Échec silencieux : le site fonctionne sans le mode hors ligne.
    });
  }, []);

  return null;
}
