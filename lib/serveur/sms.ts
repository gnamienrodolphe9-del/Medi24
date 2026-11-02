import type { SupabaseClient } from "@supabase/supabase-js";
import { fournisseurSms } from "@/lib/sms";
import { smsSupervision } from "@/lib/messages";

// Envoie un SMS et garde une trace dans le journal (sans le texte complet pour ne pas
// y copier de lien secret : on garde seulement les 4 derniers chiffres du numéro).
export async function envoyerSms(
  db: SupabaseClient,
  options: { telephone: string; message: string; demandeId?: string | null; evenement: string }
): Promise<{ reussi: boolean; erreur?: string }> {
  const resultat = await fournisseurSms().envoyer(options.telephone, options.message);
  await db.from("journal_alertes").insert({
    demande_id: options.demandeId ?? null,
    evenement: resultat.reussi ? `sms_${options.evenement}` : `sms_echec_${options.evenement}`,
    detail: {
      telephone_fin: options.telephone.slice(-4),
      erreur: resultat.erreur ?? null,
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
