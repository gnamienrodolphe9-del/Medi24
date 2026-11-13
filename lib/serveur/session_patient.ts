import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

// Compte patient sans mot de passe : le numéro de téléphone, vérifié une fois par SMS, identifie le
// patient. L'appareil garde ensuite une session (cookie), ce qui évite de redemander un code.
//
// Sécurité : le cookie est illisible par les scripts (httpOnly) ; la base ne garde que son empreinte.
// Perdre ou voler l'appareil donne accès à l'historique : le patient peut se déconnecter à tout moment.

const NOM_COOKIE = "medi24_session";
export const JOURS_SESSION = 180;

function empreinte(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

function optionsCookie(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

// Ouvre une session pour ce numéro (déjà vérifié par code) et la mémorise dans un cookie.
export async function creerSession(db: SupabaseClient, telephone: string): Promise<void> {
  const jeton = randomBytes(32).toString("hex");
  const expire = new Date(Date.now() + JOURS_SESSION * 86400 * 1000);
  const { error } = await db.from("sessions_patient").insert({
    telephone,
    jeton_hash: empreinte(jeton),
    expire_le: expire.toISOString(),
  });
  if (error) return; // Sans session, le patient saisira simplement un code la prochaine fois.
  (await cookies()).set(NOM_COOKIE, jeton, optionsCookie(JOURS_SESSION * 86400));
  // Ménage : les sessions expirées ne servent plus.
  await db.from("sessions_patient").delete().lt("expire_le", new Date().toISOString());
}

// Numéro de la personne connectée sur cet appareil, ou null.
export async function lireSession(db: SupabaseClient): Promise<{ telephone: string } | null> {
  const jeton = (await cookies()).get(NOM_COOKIE)?.value;
  if (!jeton || !/^[0-9a-f]{64}$/.test(jeton)) return null;
  const { data } = await db
    .from("sessions_patient")
    .select("id, telephone, derniere_utilisation_le")
    .eq("jeton_hash", empreinte(jeton))
    .gt("expire_le", new Date().toISOString())
    .maybeSingle<{ id: number; telephone: string; derniere_utilisation_le: string }>();
  if (!data) return null;

  // La session se prolonge à chaque usage (au plus une écriture par jour).
  if (Date.now() - new Date(data.derniere_utilisation_le).getTime() > 86400 * 1000) {
    await db
      .from("sessions_patient")
      .update({
        derniere_utilisation_le: new Date().toISOString(),
        expire_le: new Date(Date.now() + JOURS_SESSION * 86400 * 1000).toISOString(),
      })
      .eq("id", data.id);
  }
  return { telephone: data.telephone };
}

// Déconnecte cet appareil : la session est supprimée côté serveur et le cookie effacé.
export async function fermerSession(db: SupabaseClient): Promise<void> {
  const magasin = await cookies();
  const jeton = magasin.get(NOM_COOKIE)?.value;
  if (jeton && /^[0-9a-f]{64}$/.test(jeton)) {
    await db.from("sessions_patient").delete().eq("jeton_hash", empreinte(jeton));
  }
  magasin.set(NOM_COOKIE, "", optionsCookie(0));
}
