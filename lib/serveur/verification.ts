import { createHash, randomInt } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { smsCodeVerification } from "@/lib/messages";
import { envoyerSms } from "./sms";

const VALIDITE_MINUTES = 10;
const CODES_PAR_HEURE_MAX = 3;
const ESSAIS_MAX = 5;

function empreinte(telephone: string, code: string): string {
  const poivre = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "medi24";
  return createHash("sha256").update(`${telephone}:${code}:${poivre}`).digest("hex");
}

export type ResultatEnvoiCode =
  | { ok: true; codeDev?: string }
  | { ok: false; erreur: string; statut: number };

// Envoie un code de vérification par SMS. Limité à 3 codes par heure et par numéro.
export async function envoyerCodeVerification(
  db: SupabaseClient,
  telephone: string
): Promise<ResultatEnvoiCode> {
  const depuis = new Date(Date.now() - 3600 * 1000).toISOString();
  const { count } = await db
    .from("verifications_telephone")
    .select("id", { count: "exact", head: true })
    .eq("telephone", telephone)
    .gte("cree_le", depuis);
  if ((count ?? 0) >= CODES_PAR_HEURE_MAX) {
    return {
      ok: false,
      statut: 429,
      erreur: "Trop de codes demandés pour ce numéro. Réessayez dans une heure.",
    };
  }

  const code = String(randomInt(0, 100000)).padStart(5, "0");
  const { error } = await db.from("verifications_telephone").insert({
    telephone,
    code_hash: empreinte(telephone, code),
    expire_le: new Date(Date.now() + VALIDITE_MINUTES * 60 * 1000).toISOString(),
  });
  if (error) return { ok: false, statut: 500, erreur: "Envoi du code impossible." };

  const envoi = await envoyerSms(db, {
    telephone,
    message: smsCodeVerification(code),
    evenement: "code",
  });
  if (!envoi.reussi) {
    return {
      ok: false,
      statut: 502,
      erreur: "Le SMS n'a pas pu être envoyé. Vérifiez le numéro ou réessayez.",
    };
  }

  // En développement uniquement, on renvoie le code à l'écran pour tester sans SMS réel.
  const dev = process.env.NODE_ENV === "development" && (process.env.SMS_FOURNISSEUR ?? "console") === "console";
  return dev ? { ok: true, codeDev: code } : { ok: true };
}

// Vérifie le code saisi. Un code ne sert qu'une fois et s'efface après 5 essais ratés.
export async function verifierCode(
  db: SupabaseClient,
  telephone: string,
  code: string
): Promise<boolean> {
  if (!/^\d{5}$/.test(code)) return false;
  const { data } = await db
    .from("verifications_telephone")
    .select("id, code_hash, essais")
    .eq("telephone", telephone)
    .eq("utilise", false)
    .gt("expire_le", new Date().toISOString())
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: number; code_hash: string; essais: number }>();
  if (!data || data.essais >= ESSAIS_MAX) return false;

  if (data.code_hash === empreinte(telephone, code)) {
    await db.from("verifications_telephone").update({ utilise: true }).eq("id", data.id);
    return true;
  }
  await db
    .from("verifications_telephone")
    .update({ essais: data.essais + 1 })
    .eq("id", data.id);
  return false;
}
