import { creerClientServeur } from "@/lib/supabase/serveur";
import { jetonValide } from "@/lib/jeton";
import { construireSuivi } from "@/lib/serveur/suivi";
import { avancerCascade } from "@/lib/serveur/cascade";
import { estEnRecherche } from "@/lib/etats";
import { erreur, lireCorps, ok, adresseSite } from "@/lib/serveur/http";
import { envoyerSms } from "@/lib/serveur/sms";
import { notifier } from "@/lib/serveur/notifier";
import { smsConfirmationPharmacie, smsLivraisonPharmacie } from "@/lib/messages";
import { options } from "@/lib/options";

export const dynamic = "force-dynamic";

type Contexte = { params: Promise<{ jeton: string }> };

// Page de suivi du patient : lecture. Chaque lecture fait aussi avancer la cascade,
// ce qui sert de filet de sécurité si la tâche planifiée tarde.
export async function GET(_requete: Request, { params }: Contexte) {
  const { jeton } = await params;
  if (!jetonValide(jeton)) return erreur("Lien invalide.", 404);

  const db = creerClientServeur();
  let resultat = await construireSuivi(db, jeton);
  if (!resultat) return erreur("Demande introuvable.", 404);

  if (estEnRecherche(resultat.suivi.etat)) {
    await avancerCascade(db, resultat.demandeId);
    resultat = (await construireSuivi(db, jeton)) ?? resultat;
  }
  return ok(resultat.suivi);
}

type Decision = { id: string; accepte: boolean };

// Actions du patient : valider son choix, chercher ailleurs, annuler.
export async function POST(requete: Request, { params }: Contexte) {
  const { jeton } = await params;
  if (!jetonValide(jeton)) return erreur("Lien invalide.", 404);
  const corps = await lireCorps(requete);
  if (!corps) return erreur("Requête invalide.");

  const db = creerClientServeur();
  const { data: demande } = await db
    .from("demandes")
    .select("id, etat, mode, pharmacie_retenue_id, retenue_le")
    .eq("jeton", jeton)
    .maybeSingle<{
      id: string;
      etat: string;
      mode: string | null;
      pharmacie_retenue_id: string | null;
      retenue_le: string | null;
    }>();
  if (!demande) return erreur("Demande introuvable.", 404);

  const maintenant = new Date().toISOString();

  // --- Annuler ---
  if (corps.action === "annuler") {
    if (!["creee", "envoyee", "vue", "confirmee", "prete", "repli"].includes(demande.etat)) {
      return erreur("Cette demande ne peut plus être annulée.");
    }
    await db
      .from("demandes")
      .update({ etat: "annulee", mis_a_jour_le: maintenant })
      .eq("id", demande.id);
    await db.from("journal_alertes").insert({ demande_id: demande.id, evenement: "annulee" });
    return ok();
  }

  // --- Chercher ailleurs (la réponse ne convient pas) ---
  if (corps.action === "chercher_ailleurs") {
    if (demande.etat !== "confirmee") return erreur("Action impossible à ce stade.");
    await db
      .from("demandes")
      .update({
        pharmacie_retenue_id: null,
        retenue_le: null,
        mode: null,
        etat: "envoyee",
        mis_a_jour_le: maintenant,
      })
      .eq("id", demande.id)
      .eq("etat", "confirmee");
    await db.from("journal_alertes").insert({ demande_id: demande.id, evenement: "chercher_ailleurs" });
    await avancerCascade(db, demande.id);
    return ok();
  }

  // --- Valider : choix du mode et réponse aux substituts ---
  if (corps.action === "valider") {
    if (demande.etat !== "confirmee" || !demande.pharmacie_retenue_id) {
      return erreur("Il n'y a rien à valider pour le moment.");
    }
    const mode = corps.mode === "retrait" || corps.mode === "livraison" ? corps.mode : null;
    if (!mode) return erreur("Choisissez retrait ou livraison.");

    const { data: reponse } = await db
      .from("reponses")
      .select("id, retrait_possible, livraison_possible")
      .eq("demande_id", demande.id)
      .eq("pharmacie_id", demande.pharmacie_retenue_id)
      .maybeSingle<{ id: string; retrait_possible: boolean; livraison_possible: boolean }>();
    if (!reponse) return erreur("Réponse introuvable.", 404);
    if (mode === "retrait" && !reponse.retrait_possible) return erreur("Le retrait n'est pas proposé par cette pharmacie.");
    if (mode === "livraison" && !reponse.livraison_possible) return erreur("La livraison n'est pas proposée par cette pharmacie.");

    const decisions: Decision[] = Array.isArray(corps.decisions)
      ? (corps.decisions as unknown[])
          .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
          .map((x) => ({ id: String(x.id), accepte: x.accepte === true }))
      : [];

    const { data: lignes } = await db
      .from("lignes_reponse")
      .select("id, disponible, substitut, substitut_accepte")
      .eq("reponse_id", reponse.id);
    const toutes = (lignes ?? []) as {
      id: string;
      disponible: boolean;
      substitut: string | null;
      substitut_accepte: boolean | null;
    }[];

    // Chaque substitut proposé doit avoir une réponse (nouvelle ou déjà donnée).
    for (const l of toutes) {
      if (l.disponible || !l.substitut) continue;
      const decision = decisions.find((x) => x.id === l.id);
      if (!decision && l.substitut_accepte === null) {
        return erreur("Répondez à chaque substitut proposé (accepter ou refuser).");
      }
      if (decision) {
        await db.from("lignes_reponse").update({ substitut_accepte: decision.accepte }).eq("id", l.id);
      }
    }

    await db
      .from("demandes")
      .update({ mode, mode_choisi_le: maintenant, mis_a_jour_le: maintenant })
      .eq("id", demande.id);
    await db.from("journal_alertes").insert({
      demande_id: demande.id,
      evenement: "mode_choisi",
      detail: { mode },
    });

    // Prévient la pharmacie retenue (par SMS) qu'elle peut préparer la commande.
    const { data: alerte } = await db
      .from("alertes")
      .select("jeton, pharmacies(telephone_alerte_1)")
      .eq("demande_id", demande.id)
      .eq("pharmacie_id", demande.pharmacie_retenue_id)
      .maybeSingle();
    const jetonAlerte = (alerte as { jeton?: string } | null)?.jeton;
    const ph = (alerte as { pharmacies?: unknown } | null)?.pharmacies;
    const tel = Array.isArray(ph)
      ? (ph[0] as { telephone_alerte_1?: string } | undefined)?.telephone_alerte_1
      : (ph as { telephone_alerte_1?: string } | null)?.telephone_alerte_1;
    // La pharmacie est toujours prévenue par notification ; le SMS est facultatif.
    if (jetonAlerte && demande.pharmacie_retenue_id) {
      await notifier(
        db,
        { type: "pharmacie", id: demande.pharmacie_retenue_id },
        {
          titre: "Medi24 : le patient a confirmé",
          corps:
            mode === "livraison"
              ? "Livraison demandée : indiquez votre livreur, puis préparez la commande."
              : "Retrait demandé : préparez la commande puis touchez « Prête ».",
          chemin: `/p/${jetonAlerte}`,
          urgent: true,
        },
        { evenement: "confirmation_patient", demandeId: demande.id }
      );
    }
    if (options.smsConfirmationPharmacie() && jetonAlerte && tel) {
      const lien = `${adresseSite()}/p/${jetonAlerte}`;
      await envoyerSms(db, {
        telephone: tel,
        message: mode === "livraison" ? smsLivraisonPharmacie(lien) : smsConfirmationPharmacie(lien),
        demandeId: demande.id,
        evenement: "confirmation_patient",
      });
    }
    return ok();
  }

  return erreur("Action inconnue.");
}
