"use client";

import { envoyerJson } from "@/lib/client/api";

// Côté appareil des notifications push. Le serveur (lib/serveur/push.ts) envoie, le service
// worker (public/sw.js) affiche. Ici : demander l'autorisation et enregistrer l'appareil.

export type GenrePage = "gestion" | "alerte" | "suivi" | "livreur";
export type EtatPush = "inconnu" | "non_supporte" | "inactif" | "actif" | "bloque";

const CLE_PUBLIQUE = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function pushConfigure(): boolean {
  return CLE_PUBLIQUE.length > 0;
}

export function pushSupporte(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// La clé publique est en base64 « URL-safe » ; l'abonnement la veut en octets.
function cleEnOctets(base64: string) {
  const rempli = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(rempli);
  const octets = new Uint8Array(new ArrayBuffer(brut.length));
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i);
  return octets;
}

async function enregistrement(): Promise<ServiceWorkerRegistration> {
  // En production le service worker est déjà enregistré par le site ; en développement local
  // on l'enregistre ici pour pouvoir tester les notifications.
  const existant = await navigator.serviceWorker.getRegistration("/");
  if (existant) return navigator.serviceWorker.ready;
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

export async function lireEtatPush(): Promise<EtatPush> {
  if (!pushConfigure() || !pushSupporte()) return "non_supporte";
  if (Notification.permission === "denied") return "bloque";
  if (Notification.permission !== "granted") return "inactif";
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const abonnement = await reg?.pushManager.getSubscription();
    return abonnement ? "actif" : "inactif";
  } catch {
    return "inactif";
  }
}

// Demande l'autorisation, abonne l'appareil et l'enregistre côté serveur.
export async function activerPush(
  genre: GenrePage,
  jeton: string
): Promise<{ ok: true } | { ok: false; raison: "refuse" | "non_supporte" | "erreur"; message: string }> {
  if (!pushConfigure() || !pushSupporte()) {
    return { ok: false, raison: "non_supporte", message: "Ce navigateur ne permet pas les notifications." };
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return {
        ok: false,
        raison: "refuse",
        message: "Les notifications sont refusées. Autorisez-les dans les réglages du navigateur pour ce site.",
      };
    }
    const reg = await enregistrement();
    const abonnement =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleEnOctets(CLE_PUBLIQUE) }));
    const r = await envoyerJson("/api/push", { action: "abonner", genre, jeton, abonnement: abonnement.toJSON() });
    if (!r.ok) return { ok: false, raison: "erreur", message: r.erreur };
    return { ok: true };
  } catch {
    return { ok: false, raison: "erreur", message: "Activation impossible sur cet appareil. Réessayez." };
  }
}

// Réenregistre silencieusement l'appareil déjà autorisé (au cas où le serveur l'aurait oublié).
export async function rafraichirAbonnement(genre: GenrePage, jeton: string): Promise<void> {
  try {
    if (!pushConfigure() || !pushSupporte() || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker.getRegistration("/");
    const abonnement = await reg?.pushManager.getSubscription();
    if (!abonnement) return;
    await envoyerJson("/api/push", { action: "abonner", genre, jeton, abonnement: abonnement.toJSON() });
  } catch {
    // Sans importance.
  }
}

export async function desactiverPush(genre: GenrePage, jeton: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const abonnement = await reg?.pushManager.getSubscription();
    if (!abonnement) return;
    await envoyerJson("/api/push", { action: "desabonner", genre, jeton, endpoint: abonnement.endpoint });
  } catch {
    // Sans importance.
  }
}

export async function essayerPush(genre: GenrePage, jeton: string): Promise<{ ok: boolean; message: string }> {
  const r = await envoyerJson("/api/push", { action: "tester", genre, jeton });
  return r.ok ? { ok: true, message: "Notification envoyée : regardez le haut de l'écran." } : { ok: false, message: r.erreur };
}
