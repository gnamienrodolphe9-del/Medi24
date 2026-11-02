import type { SupabaseClient } from "@supabase/supabase-js";
import { CASCADE, decider, type ActionCascade } from "@/lib/cascade";
import type { EtatDemande } from "@/lib/etats";
import { formaterDistance } from "@/lib/garde";
import { smsAlertePharmacie, smsRappelPharmacie } from "@/lib/messages";
import { adresseSite } from "./http";
import { alerterAdmin, envoyerSms } from "./sms";

type LigneDemandeBd = {
  id: string;
  etat: EtatDemande;
  cree_le: string;
  rappel_envoye: boolean;
  repli_fait: boolean;
  sms_envoyes: number;
};

type CandidatBd = {
  id: string;
  nom: string;
  telephone_alerte_1: string;
  telephone_alerte_2: string | null;
  distance_m: number;
};

// Fait avancer la cascade d'alertes d'une demande. Appelée à la création de la demande,
// toutes les minutes par la tâche planifiée, et à chaque ouverture de la page de suivi.
// Un verrou en base empêche deux exécutions simultanées d'envoyer les mêmes SMS.
export async function avancerCascade(db: SupabaseClient, demandeId: string): Promise<void> {
  const { data: verrou } = await db.rpc("reserver_cascade", { p_demande: demandeId });
  if (verrou !== true) return;
  try {
    await executer(db, demandeId);
  } catch (e) {
    await db.from("journal_alertes").insert({
      demande_id: demandeId,
      evenement: "cascade_erreur",
      detail: { message: e instanceof Error ? e.message : String(e) },
    });
  } finally {
    await db.rpc("liberer_cascade", { p_demande: demandeId });
  }
}

async function executer(db: SupabaseClient, demandeId: string): Promise<void> {
  const { data: demande } = await db
    .from("demandes")
    .select("id, etat, cree_le, rappel_envoye, repli_fait, sms_envoyes")
    .eq("id", demandeId)
    .maybeSingle<LigneDemandeBd>();
  if (!demande) return;

  const { data: alertes } = await db
    .from("alertes")
    .select("id, vague, resultat, rappel_le")
    .eq("demande_id", demandeId);
  const liste = (alertes ?? []) as {
    id: string;
    vague: number;
    resultat: string | null;
    rappel_le: string | null;
  }[];

  const { data: restantesBrut } = await db.rpc("choisir_pharmacies_alerte", {
    p_demande: demandeId,
    p_limite: 50,
  });
  const restantes = ((restantesBrut ?? []) as CandidatBd[]).length;

  const actions = decider({
    etat: demande.etat,
    ageSecondes: (Date.now() - new Date(demande.cree_le).getTime()) / 1000,
    vaguesEnvoyees: liste.reduce((m, a) => Math.max(m, a.vague), 0),
    rappelEnvoye: demande.rappel_envoye,
    repliFait: demande.repli_fait,
    pharmaciesRestantes: restantes,
    sansReponse: liste.filter((a) => a.resultat === null).length,
    smsEnvoyes: demande.sms_envoyes,
  });

  let sms = demande.sms_envoyes;
  for (const action of actions) {
    sms += await appliquer(db, demande, action, liste);
  }
  if (sms !== demande.sms_envoyes) {
    await db.from("demandes").update({ sms_envoyes: sms }).eq("id", demandeId);
  }
}

// Renvoie le nombre de SMS réellement envoyés par cette action.
async function appliquer(
  db: SupabaseClient,
  demande: LigneDemandeBd,
  action: ActionCascade,
  alertesExistantes: { id: string; resultat: string | null }[]
): Promise<number> {
  const site = adresseSite();

  if (action.type === "expirer") {
    await db
      .from("demandes")
      .update({ etat: "expiree", mis_a_jour_le: new Date().toISOString() })
      .eq("id", demande.id)
      .in("etat", ["creee", "envoyee", "vue"]);
    await db.from("journal_alertes").insert({ demande_id: demande.id, evenement: "expiree" });
    return 0;
  }

  if (action.type === "repli") {
    const maintenant = new Date().toISOString();
    await db
      .from("demandes")
      .update(
        action.aucune
          ? { repli_fait: true, etat: "repli", mis_a_jour_le: maintenant }
          : { repli_fait: true, mis_a_jour_le: maintenant }
      )
      .eq("id", demande.id)
      .in("etat", ["creee", "envoyee", "vue"]);
    await db.from("journal_alertes").insert({
      demande_id: demande.id,
      evenement: action.aucune ? "repli_aucune_pharmacie" : "repli",
    });
    if (action.aucune) {
      await alerterAdmin(db, "demande sans aucune pharmacie de garde disponible", demande.id);
    }
    return 0;
  }

  if (action.type === "rappel") {
    const aRappeler = alertesExistantes.filter((a) => a.resultat === null).slice(0, action.nombre);
    let envoyes = 0;
    for (const a of aRappeler) {
      const { data: alerte } = await db
        .from("alertes")
        .select("jeton, pharmacies(telephone_alerte_1)")
        .eq("id", a.id)
        .maybeSingle();
      const jeton = (alerte as { jeton?: string } | null)?.jeton;
      const pharma = (alerte as { pharmacies?: unknown } | null)?.pharmacies;
      const telephone = Array.isArray(pharma)
        ? (pharma[0] as { telephone_alerte_1?: string } | undefined)?.telephone_alerte_1
        : (pharma as { telephone_alerte_1?: string } | null)?.telephone_alerte_1;
      if (!jeton || !telephone) continue;
      const r = await envoyerSms(db, {
        telephone,
        message: smsRappelPharmacie(`${site}/p/${jeton}`),
        demandeId: demande.id,
        evenement: "rappel",
      });
      if (r.reussi) envoyes++;
      await db.from("alertes").update({ rappel_le: new Date().toISOString() }).eq("id", a.id);
    }
    await db.from("demandes").update({ rappel_envoye: true }).eq("id", demande.id);
    await db.from("journal_alertes").insert({
      demande_id: demande.id,
      evenement: "rappel",
      detail: { envoyes },
    });
    return envoyes;
  }

  // Vague d'alertes
  const { data: candidatsBrut } = await db.rpc("choisir_pharmacies_alerte", {
    p_demande: demande.id,
    p_limite: action.nombre,
  });
  const candidats = (candidatsBrut ?? []) as CandidatBd[];
  let envoyes = 0;
  let echecs = 0;

  for (const c of candidats) {
    const { data: alerte, error } = await db
      .from("alertes")
      .insert({ demande_id: demande.id, pharmacie_id: c.id, vague: action.vague })
      .select("id, jeton")
      .single<{ id: string; jeton: string }>();
    if (error || !alerte) {
      echecs++;
      continue;
    }

    const message = smsAlertePharmacie(`${site}/p/${alerte.jeton}`, formaterDistance(c.distance_m));
    let resultat = await envoyerSms(db, {
      telephone: c.telephone_alerte_1,
      message,
      demandeId: demande.id,
      evenement: "alerte",
    });
    // Numéro principal en échec : on essaie le numéro de secours.
    if (!resultat.reussi && c.telephone_alerte_2) {
      resultat = await envoyerSms(db, {
        telephone: c.telephone_alerte_2,
        message,
        demandeId: demande.id,
        evenement: "alerte_secours",
      });
    }

    if (resultat.reussi) {
      envoyes++;
      await db
        .from("alertes")
        .update({ envoyee_le: new Date().toISOString() })
        .eq("id", alerte.id);
    } else {
      echecs++;
      await db.from("alertes").update({ sms_erreur: resultat.erreur ?? "échec" }).eq("id", alerte.id);
    }
  }

  await db.from("journal_alertes").insert({
    demande_id: demande.id,
    evenement: "vague",
    detail: { vague: action.vague, envoyes, echecs },
  });

  if (demande.etat === "creee" && envoyes > 0) {
    await db
      .from("demandes")
      .update({ etat: "envoyee", mis_a_jour_le: new Date().toISOString() })
      .eq("id", demande.id)
      .eq("etat", "creee");
  }

  // Mode dégradé : aucun SMS n'est parti. On affiche tout de suite la liste d'appel au patient
  // et on prévient l'administrateur, sans attendre 6 minutes.
  if (envoyes === 0 && candidats.length > 0) {
    await db
      .from("demandes")
      .update({ repli_fait: true, etat: "repli", mis_a_jour_le: new Date().toISOString() })
      .eq("id", demande.id)
      .in("etat", ["creee", "envoyee", "vue"]);
    await alerterAdmin(db, "envoi des SMS impossible, verifiez le fournisseur SMS", demande.id);
  }

  return envoyes;
}

export { CASCADE };
