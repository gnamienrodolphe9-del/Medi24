import { creerClientServeur } from "@/lib/supabase/serveur";
import { jetonValide } from "@/lib/jeton";
import { codeValide, codesIdentiques, ESSAIS_CODE_MAX } from "@/lib/code";
import { normaliserTelephoneCi } from "@/lib/telephone";
import { chargerAlerte, construireVuePharmacie } from "@/lib/serveur/pharmacie";
import { adresseSite, erreur, lireCorps, ok } from "@/lib/serveur/http";
import { envoyerSms } from "@/lib/serveur/sms";
import { smsLivreur, smsPatientPrete, smsPatientReponse } from "@/lib/messages";
import { contientProduitExclu } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Contexte = { params: Promise<{ jeton: string }> };

const JOURS_CONSERVATION_ORDONNANCE = 90;

// Lecture de la demande par la pharmacie. Ouvrir le lien marque la demande comme "vue".
export async function GET(_requete: Request, { params }: Contexte) {
  const { jeton } = await params;
  if (!jetonValide(jeton)) return erreur("Lien invalide.", 404);

  const db = creerClientServeur();
  const alerte = await chargerAlerte(db, jeton);
  if (!alerte) return erreur("Lien introuvable.", 404);

  if (!alerte.ouverte_le) {
    await db.from("alertes").update({ ouverte_le: new Date().toISOString() }).eq("id", alerte.id);
    await db
      .from("demandes")
      .update({ etat: "vue", mis_a_jour_le: new Date().toISOString() })
      .eq("id", alerte.demande_id)
      .eq("etat", "envoyee");
  }

  const vue = await construireVuePharmacie(db, alerte);
  if (!vue) return erreur("Demande introuvable.", 404);
  return ok(vue);
}

type LigneEntree = { produit: string; disponible: boolean; substitut: string; prix: number | null };

function lireLignes(brut: unknown): LigneEntree[] | string {
  if (!Array.isArray(brut)) return [];
  if (brut.length > 15) return "Pas plus de 15 produits par réponse.";
  const lignes: LigneEntree[] = [];
  for (const x of brut) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const produit = typeof o.produit === "string" ? o.produit.trim().slice(0, 200) : "";
    if (!produit) continue;
    const substitut = typeof o.substitut === "string" ? o.substitut.trim().slice(0, 200) : "";
    let prix: number | null = null;
    if (o.prix !== null && o.prix !== undefined && o.prix !== "") {
      const n = Number(o.prix);
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return `Prix invalide pour « ${produit} ».`;
      prix = Math.round(n);
    }
    if (contientProduitExclu(produit) || contientProduitExclu(substitut)) {
      return "Ce produit ne peut pas être proposé sur Medi24.";
    }
    lignes.push({ produit, disponible: o.disponible !== false, substitut, prix });
  }
  return lignes;
}

export async function POST(requete: Request, { params }: Contexte) {
  const { jeton } = await params;
  if (!jetonValide(jeton)) return erreur("Lien invalide.", 404);
  const corps = await lireCorps(requete);
  if (!corps) return erreur("Requête invalide.");

  const db = creerClientServeur();
  const alerte = await chargerAlerte(db, jeton);
  if (!alerte) return erreur("Lien introuvable.", 404);
  if (new Date(alerte.expire_le).getTime() < Date.now()) {
    return erreur("Ce lien a expiré.", 410);
  }

  const { data: demande } = await db
    .from("demandes")
    .select("id, jeton, etat, mode, code_remise, essais_code, pharmacie_retenue_id, type")
    .eq("id", alerte.demande_id)
    .maybeSingle<{
      id: string;
      jeton: string;
      etat: string;
      mode: "retrait" | "livraison" | null;
      code_remise: string;
      essais_code: number;
      pharmacie_retenue_id: string | null;
      type: string;
    }>();
  if (!demande) return erreur("Demande introuvable.", 404);

  const site = adresseSite();
  const maintenant = new Date().toISOString();
  const estRetenue = demande.pharmacie_retenue_id === alerte.pharmacie_id;

  // --- Répondre : disponible, indisponible ou partiel ---
  if (corps.action === "repondre") {
    const statut = corps.statut;
    if (statut !== "disponible" && statut !== "indisponible" && statut !== "partiel") {
      return erreur("Statut invalide.");
    }
    const lignes = lireLignes(corps.lignes);
    if (typeof lignes === "string") return erreur(lignes);

    if (statut !== "indisponible") {
      if (lignes.length === 0) return erreur("Indiquez au moins un produit avec son prix.");
      if (statut === "partiel" && !lignes.some((l) => !l.disponible || l.substitut)) {
        return erreur("Réponse partielle : marquez au moins un produit indisponible ou proposez un substitut.");
      }
      if (statut === "partiel" && lignes.every((l) => !l.disponible && !l.substitut)) {
        return erreur("Réponse partielle : au moins un produit doit être disponible ou remplaçable.");
      }
      if (demande.type === "symptomes" && (typeof corps.avis !== "string" || corps.avis.trim().length < 5)) {
        return erreur("Pour une demande par symptômes, ajoutez votre avis de pharmacien.");
      }
    }

    const retrait = corps.retrait !== false;
    const livraison = corps.livraison === true;
    if (statut !== "indisponible" && !retrait && !livraison) {
      return erreur("Choisissez retrait, livraison, ou les deux.");
    }

    const { data, error } = await db.rpc("enregistrer_reponse", {
      p_jeton_alerte: jeton,
      p_statut: statut,
      p_avis: typeof corps.avis === "string" ? corps.avis.slice(0, 600) : null,
      p_retrait: retrait,
      p_livraison: livraison,
      p_lignes:
        statut === "indisponible"
          ? []
          : lignes.map((l) => ({
              produit: l.produit,
              disponible: statut === "disponible" ? true : l.disponible,
              substitut: statut === "disponible" || l.disponible ? null : l.substitut || null,
              prix_fcfa: l.prix,
            })),
    });
    if (error) return erreur("Enregistrement impossible. Réessayez.", 500);

    const resultat = data as { ok: boolean; retenue?: boolean; raison?: string };
    if (!resultat.ok) {
      const messages: Record<string, string> = {
        lien_expire: "Ce lien a expiré.",
        demande_close: "Cette demande est terminée.",
        deja_repondu: "Vous avez déjà répondu à cette demande.",
      };
      return erreur(messages[resultat.raison ?? ""] ?? "Réponse refusée.", 409);
    }

    if (resultat.retenue) {
      await envoyerSms(db, {
        telephone: await telephonePatient(db, demande.id),
        message: smsPatientReponse(`${site}/suivi/${demande.jeton}`),
        demandeId: demande.id,
        evenement: "patient_reponse",
      });
    }
    return ok({ ok: true, retenue: resultat.retenue === true, raison: resultat.raison ?? null });
  }

  // Les actions suivantes ne concernent que la pharmacie retenue.
  if (!estRetenue) return erreur("Cette demande n'est pas attribuée à votre pharmacie.", 403);

  // --- Indiquer le livreur ---
  if (corps.action === "livreur") {
    if (demande.mode !== "livraison") return erreur("Le patient n'a pas demandé la livraison.");
    if (["remise", "annulee", "expiree"].includes(demande.etat)) return erreur("Demande terminée.");
    const telephone =
      typeof corps.telephone === "string" ? normaliserTelephoneCi(corps.telephone) : null;
    if (!telephone) return erreur("Le numéro du livreur doit avoir 10 chiffres.");

    const { data: reponse } = await db
      .from("reponses")
      .select("id")
      .eq("demande_id", demande.id)
      .eq("pharmacie_id", alerte.pharmacie_id)
      .maybeSingle<{ id: string }>();
    if (!reponse) return erreur("Réponse introuvable.", 404);

    const { data: existante } = await db
      .from("livraisons")
      .select("id, jeton, etat")
      .eq("reponse_id", reponse.id)
      .maybeSingle<{ id: string; jeton: string; etat: string }>();
    if (existante && existante.etat !== "creee") {
      return erreur("La course a déjà commencé, le livreur ne peut plus être changé.");
    }

    let jetonLivreur: string;
    if (existante) {
      await db.from("livraisons").update({ telephone_livreur: telephone }).eq("id", existante.id);
      jetonLivreur = existante.jeton;
    } else {
      const { data: creee, error } = await db
        .from("livraisons")
        .insert({ reponse_id: reponse.id, telephone_livreur: telephone })
        .select("jeton")
        .single<{ jeton: string }>();
      if (error || !creee) return erreur("Création de la livraison impossible.", 500);
      jetonLivreur = creee.jeton;
    }

    const { data: ph } = await db
      .from("pharmacies")
      .select("nom")
      .eq("id", alerte.pharmacie_id)
      .maybeSingle<{ nom: string }>();
    const envoi = await envoyerSms(db, {
      telephone,
      message: smsLivreur(`${site}/l/${jetonLivreur}`, ph?.nom ?? "la pharmacie"),
      demandeId: demande.id,
      evenement: "livreur",
    });
    if (!envoi.reussi) return erreur("Le SMS au livreur n'a pas pu être envoyé. Vérifiez le numéro.", 502);
    return ok();
  }

  // --- Commande prête ---
  if (corps.action === "prete") {
    if (demande.etat !== "confirmee" || !demande.mode) {
      return erreur("Le patient n'a pas encore confirmé sa commande.");
    }
    if (demande.mode === "livraison") {
      const { data: reponse } = await db
        .from("reponses")
        .select("id")
        .eq("demande_id", demande.id)
        .eq("pharmacie_id", alerte.pharmacie_id)
        .maybeSingle<{ id: string }>();
      const { data: liv } = reponse
        ? await db.from("livraisons").select("id").eq("reponse_id", reponse.id).maybeSingle()
        : { data: null };
      if (!liv) return erreur("Indiquez d'abord le numéro du livreur.");
    }
    await db
      .from("demandes")
      .update({ etat: "prete", mis_a_jour_le: maintenant })
      .eq("id", demande.id)
      .eq("etat", "confirmee");
    await db.from("journal_alertes").insert({ demande_id: demande.id, evenement: "prete" });
    await envoyerSms(db, {
      telephone: await telephonePatient(db, demande.id),
      message: smsPatientPrete(`${site}/suivi/${demande.jeton}`),
      demandeId: demande.id,
      evenement: "patient_prete",
    });
    return ok();
  }

  // --- Retrait : le pharmacien saisit le code donné par le patient ---
  if (corps.action === "valider_code") {
    if (demande.mode !== "retrait") return erreur("Cette commande est une livraison : le code est saisi par le livreur.");
    if (demande.etat !== "prete") return erreur("La commande doit d'abord être marquée prête.");
    if (demande.essais_code >= ESSAIS_CODE_MAX) {
      return erreur("Trop d'essais. Contactez Medi24.", 423);
    }
    const code = typeof corps.code === "string" ? corps.code.trim() : "";
    if (!codeValide(code)) return erreur("Le code a 4 chiffres.");

    if (!codesIdentiques(code, demande.code_remise)) {
      await db.from("demandes").update({ essais_code: demande.essais_code + 1 }).eq("id", demande.id);
      const restants = ESSAIS_CODE_MAX - demande.essais_code - 1;
      return erreur(`Code incorrect. ${restants > 0 ? `${restants} essai(s) restant(s).` : "Plus d'essai possible."}`, 403);
    }

    await db
      .from("demandes")
      .update({ etat: "remise", remise_le: maintenant, mis_a_jour_le: maintenant })
      .eq("id", demande.id);
    await db
      .from("ordonnances")
      .update({
        supprimer_apres: new Date(Date.now() + JOURS_CONSERVATION_ORDONNANCE * 86400 * 1000).toISOString(),
      })
      .eq("demande_id", demande.id);
    await db.from("journal_alertes").insert({ demande_id: demande.id, evenement: "remise_retrait" });
    return ok();
  }

  return erreur("Action inconnue.");
}

async function telephonePatient(
  db: ReturnType<typeof creerClientServeur>,
  demandeId: string
): Promise<string> {
  const { data } = await db
    .from("demandes")
    .select("telephone_patient")
    .eq("id", demandeId)
    .single<{ telephone_patient: string }>();
  return data?.telephone_patient ?? "";
}
