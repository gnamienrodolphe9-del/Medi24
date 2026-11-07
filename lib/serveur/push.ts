import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adresseSite } from "./http";

// Notifications push : gratuites, elles arrivent même quand la page est fermée
// (sur Android et ordinateur ; sur iPhone seulement si l'application est ajoutée à l'écran d'accueil).
// Elles s'ajoutent aux SMS, elles ne les remplacent pas : un téléphone en économie de batterie
// ou sans internet peut manquer une notification, pas un SMS.

export type CiblePush = {
  type: "pharmacie" | "demande" | "livraison";
  id: string;
};

export type ContenuPush = {
  titre: string;
  corps: string;
  // Chemin relatif ouvert au clic, par exemple "/p/<jeton>".
  chemin: string;
  // Deux notifications avec la même étiquette n'en font qu'une (la plus récente).
  etiquette?: string;
  // Fait insister la notification (sonnerie répétée) : pour les alertes urgentes.
  urgent?: boolean;
};

let configure: boolean | null = null;

export function pushDisponible(): boolean {
  if (configure !== null) return configure;
  const publique = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privee = process.env.VAPID_PRIVATE_KEY;
  if (!publique || !privee) {
    configure = false;
    return false;
  }
  try {
    const sujet = process.env.VAPID_SUJET || adresseSite();
    webpush.setVapidDetails(sujet.startsWith("http") || sujet.startsWith("mailto:") ? sujet : `mailto:${sujet}`, publique, privee);
    configure = true;
  } catch {
    configure = false;
  }
  return configure;
}

type LigneAbonnement = { id: number; endpoint: string; cle_p256dh: string; cle_auth: string };

// Envoie une notification à tous les appareils abonnés à la cible.
// Ne lève jamais d'erreur : une notification ratée ne doit pas bloquer l'application.
// Renvoie le nombre d'appareils joints.
export async function envoyerPush(
  db: SupabaseClient,
  cible: CiblePush,
  contenu: ContenuPush
): Promise<number> {
  try {
    if (!pushDisponible()) return 0;
    const { data } = await db
      .from("abonnements_push")
      .select("id, endpoint, cle_p256dh, cle_auth")
      .eq("cible_type", cible.type)
      .eq("cible_id", cible.id);
    const abonnements = (data ?? []) as LigneAbonnement[];
    if (abonnements.length === 0) return 0;

    const charge = JSON.stringify({
      titre: contenu.titre,
      corps: contenu.corps,
      chemin: contenu.chemin,
      etiquette: contenu.etiquette ?? `${cible.type}-${cible.id}`,
      urgent: contenu.urgent === true,
    });

    const aSupprimer: number[] = [];
    let joints = 0;
    await Promise.all(
      abonnements.map(async (a) => {
        try {
          await webpush.sendNotification(
            { endpoint: a.endpoint, keys: { p256dh: a.cle_p256dh, auth: a.cle_auth } },
            charge,
            { TTL: 3600, urgency: contenu.urgent ? "high" : "normal" }
          );
          joints++;
        } catch (e) {
          const statut = (e as { statusCode?: number }).statusCode;
          // 404 / 410 : l'appareil s'est désabonné ou l'abonnement a expiré.
          if (statut === 404 || statut === 410) aSupprimer.push(a.id);
        }
      })
    );

    if (aSupprimer.length > 0) await db.from("abonnements_push").delete().in("id", aSupprimer);
    if (joints > 0) {
      await db
        .from("abonnements_push")
        .update({ dernier_envoi_le: new Date().toISOString() })
        .eq("cible_type", cible.type)
        .eq("cible_id", cible.id);
    }
    return joints;
  } catch {
    return 0;
  }
}
