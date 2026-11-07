import type { SupabaseClient } from "@supabase/supabase-js";
import { fournisseurSms } from "@/lib/sms";
import { smsSupervision } from "@/lib/messages";
import { options } from "@/lib/options";

// Envoie un SMS et garde une trace dans le journal. En fonctionnement normal, on ne garde pas
// le texte complet pour ne pas y copier de lien secret : seulement les 4 derniers chiffres du
// numéro. En MODE_TEST (vos essais), le texte et le numéro complets sont gardés pour que la page
// Admin > Messages les affiche avec leurs liens cliquables.
export async function envoyerSms(
  db: SupabaseClient,
  options_: { telephone: string; message: string; demandeId?: string | null; evenement: string }
): Promise<{ reussi: boolean; erreur?: string }> {
  const resultat = await fournisseurSms().envoyer(options_.telephone, options_.message);
  await db.from("journal_alertes").insert({
    demande_id: options_.demandeId ?? null,
    evenement: resultat.reussi ? `sms_${options_.evenement}` : `sms_echec_${options_.evenement}`,
    detail: {
      telephone_fin: options_.telephone.slice(-4),
      erreur: resultat.erreur ?? null,
      ...(options.modeTest() ? { telephone: options_.telephone, message: options_.message } : {}),
    },
  });
  return { reussi: resultat.reussi, erreur: resultat.erreur };
}

// Prévient l'administrateur (vous) par SMS quand quelque chose ne va pas.
export async function alerterAdmin(
  db: SupabaseClient,
  texte: string,
  demandeId?: string | null
): Promise<void> {
  const telephone = process.env.ADMIN_TELEPHONE;
  await db.from("journal_alertes").insert({
    demande_id: demandeId ?? null,
    evenement: "supervision",
    detail: { texte },
  });
  if (!telephone) return;
  await envoyerSms(db, {
    telephone,
    message: smsSupervision(texte),
    demandeId,
    evenement: "supervision",
  });
}
