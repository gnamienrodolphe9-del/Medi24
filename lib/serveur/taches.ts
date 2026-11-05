import type { SupabaseClient } from "@supabase/supabase-js";
import { avancerCascade } from "./cascade";
import { adresseSite } from "./http";
import { alerterAdmin, envoyerSms } from "./sms";
import { smsGardeSoir } from "@/lib/messages";
import { options } from "@/lib/options";

// Tâches automatiques, appelées par pg_cron via /api/cron/[tache].

// Toutes les minutes : fait avancer la cascade des demandes en recherche.
export async function tacheCascade(db: SupabaseClient): Promise<{ demandes: number }> {
  const depuis = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
  const { data } = await db
    .from("demandes")
    .select("id")
    .in("etat", ["creee", "envoyee", "vue"])
    .gte("cree_le", depuis);
  const ids = ((data ?? []) as { id: string }[]).map((d) => d.id);
  for (const id of ids) await avancerCascade(db, id);

  // Les demandes bloquées en recherche depuis plus de 2 h sont expirées.
  await db
    .from("demandes")
    .update({ etat: "expiree", mis_a_jour_le: new Date().toISOString() })
    .in("etat", ["creee", "envoyee", "vue"])
    .lt("cree_le", depuis);
  return { demandes: ids.length };
}

// Chaque soir : demande aux pharmacies de confirmer leur garde de la nuit.
export async function tacheGardesSoir(db: SupabaseClient): Promise<{ envoyes: number; sansNumero: number }> {
  if (!options.smsGardeSoir()) return { envoyes: 0, sansNumero: 0 };
  const maintenant = new Date();
  const dans10h = new Date(maintenant.getTime() + 10 * 3600 * 1000);
  const { data } = await db
    .from("gardes")
    .select("id, pharmacie_id, pharmacies(nom, telephone_alerte_1, jeton_gestion, validee, suspendue)")
    .gte("fin", maintenant.toISOString())
    .lte("debut", dans10h.toISOString())
    .eq("confirmee", false)
    .is("rappel_envoye_le", null);

  let envoyes = 0;
  const vus = new Set<string>();
  for (const brut of (data ?? []) as unknown[]) {
    const g = brut as {
      id: string;
      pharmacie_id: string;
      pharmacies:
        | { telephone_alerte_1: string; jeton_gestion: string; validee: boolean; suspendue: boolean }
        | { telephone_alerte_1: string; jeton_gestion: string; validee: boolean; suspendue: boolean }[]
        | null;
    };
    const p = Array.isArray(g.pharmacies) ? g.pharmacies[0] : g.pharmacies;
    if (!p || !p.validee || p.suspendue) continue;
    // Un seul SMS par pharmacie, même avec plusieurs gardes.
    if (!vus.has(g.pharmacie_id)) {
      vus.add(g.pharmacie_id);
      const r = await envoyerSms(db, {
        telephone: p.telephone_alerte_1,
        message: smsGardeSoir(`${adresseSite()}/pharmacie/gardes?j=${p.jeton_gestion}`),
        evenement: "garde_soir",
      });
      if (r.reussi) envoyes++;
    }
    await db.from("gardes").update({ rappel_envoye_le: maintenant.toISOString() }).eq("id", g.id);
  }
  return { envoyes, sansNumero: 0 };
}

// Chaque matin : rapport de la nuit (journal + SMS à l'administrateur).
export async function tacheRapportMatin(db: SupabaseClient): Promise<Record<string, number>> {
  const depuis = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
  const { data } = await db
    .from("demandes")
    .select("etat, pharmacie_retenue_id, sms_envoyes")
    .gte("cree_le", depuis);
  const lignes = (data ?? []) as { etat: string; pharmacie_retenue_id: string | null; sms_envoyes: number }[];

  const rapport = {
    demandes: lignes.length,
    repondues: lignes.filter((l) => l.pharmacie_retenue_id).length,
    remises: lignes.filter((l) => l.etat === "remise").length,
    expirees: lignes.filter((l) => l.etat === "expiree").length,
    repli: lignes.filter((l) => l.etat === "repli").length,
    sms: lignes.reduce((total, l) => total + l.sms_envoyes, 0),
  };

  await db.from("journal_alertes").insert({ evenement: "rapport_matin", detail: rapport });
  await alerterAdmin(
    db,
    `nuit: ${rapport.demandes} demandes, ${rapport.repondues} repondues, ${rapport.remises} remises, ${rapport.expirees} expirees, ${rapport.repli} repli`
  );
  return rapport;
}

// Chaque nuit : suppression des données qui ne doivent plus être gardées.
export async function tachePurge(db: SupabaseClient): Promise<Record<string, number>> {
  const maintenant = new Date().toISOString();

  // Photos d'ordonnance arrivées à échéance (90 jours après la remise).
  const { data: echues } = await db
    .from("ordonnances")
    .select("id, chemin_fichier")
    .lt("supprimer_apres", maintenant)
    .limit(200);
  const ordonnances = (echues ?? []) as { id: string; chemin_fichier: string }[];
  let ordonnancesSupprimees = 0;
  if (ordonnances.length > 0) {
    const { error } = await db.storage.from("ordonnances").remove(ordonnances.map((o) => o.chemin_fichier));
    if (!error) {
      await db.from("ordonnances").delete().in("id", ordonnances.map((o) => o.id));
      ordonnancesSupprimees = ordonnances.length;
    }
  }

  // Positions de livreurs oubliées (normalement supprimées à la remise).
  const hier = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  await db.from("positions_livreur").delete().lt("cree_le", hier);

  // Codes de vérification de plus d'un jour.
  await db.from("verifications_telephone").delete().lt("cree_le", hier);

  // Journal technique de plus de 180 jours.
  const il180 = new Date(Date.now() - 180 * 86400 * 1000).toISOString();
  await db.from("journal_alertes").delete().lt("cree_le", il180);

  return { ordonnancesSupprimees };
}
