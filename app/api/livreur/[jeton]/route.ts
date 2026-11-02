import { creerClientServeur } from "@/lib/supabase/serveur";
import { jetonValide } from "@/lib/jeton";
import { codeValide, codesIdentiques, ESSAIS_CODE_MAX } from "@/lib/code";
import { erreur, lireCorps, ok } from "@/lib/serveur/http";

export const dynamic = "force-dynamic";

type Contexte = { params: Promise<{ jeton: string }> };

const JOURS_CONSERVATION_ORDONNANCE = 90;

type LivraisonBd = {
  id: string;
  etat: "creee" | "parti" | "arrive" | "remis";
  reponse_id: string;
};

type Contexte2 = {
  livraison: LivraisonBd;
  demande: {
    id: string;
    etat: string;
    mode: string | null;
    code_remise: string;
    essais_code: number;
    repere: string | null;
    telephone_patient: string;
  };
  pharmacieId: string;
};

async function charger(jeton: string): Promise<Contexte2 | null> {
  const db = creerClientServeur();
  const { data: livraison } = await db
    .from("livraisons")
    .select("id, etat, reponse_id")
    .eq("jeton", jeton)
    .maybeSingle<LivraisonBd>();
  if (!livraison) return null;
  const { data: reponse } = await db
    .from("reponses")
    .select("demande_id, pharmacie_id")
    .eq("id", livraison.reponse_id)
    .maybeSingle<{ demande_id: string; pharmacie_id: string }>();
  if (!reponse) return null;
  const { data: demande } = await db
    .from("demandes")
    .select("id, etat, mode, code_remise, essais_code, repere, telephone_patient")
    .eq("id", reponse.demande_id)
    .maybeSingle<Contexte2["demande"]>();
  if (!demande) return null;
  return { livraison, demande, pharmacieId: reponse.pharmacie_id };
}

// Page du livreur : lecture. Aucun produit ni détail médical n'est montré au livreur.
export async function GET(_requete: Request, { params }: Contexte) {
  const { jeton } = await params;
  if (!jetonValide(jeton)) return erreur("Lien invalide.", 404);
  const c = await charger(jeton);
  if (!c) return erreur("Course introuvable.", 404);

  const db = creerClientServeur();
  const { data: ph } = await db
    .from("pharmacies")
    .select("nom, adresse, repere, telephone_public, telephone_alerte_1")
    .eq("id", c.pharmacieId)
    .maybeSingle<{
      nom: string;
      adresse: string | null;
      repere: string | null;
      telephone_public: string | null;
      telephone_alerte_1: string;
    }>();
  const { data: cp } = await db.rpc("coordonnees_pharmacie", { p_pharmacie: c.pharmacieId });
  const { data: cd } = await db.rpc("coordonnees_demande", { p_demande: c.demande.id });
  const pharma = ((cp ?? []) as { latitude: number; longitude: number }[])[0];
  const patient = ((cd ?? []) as { latitude: number; longitude: number }[])[0];

  const terminee = c.livraison.etat === "remis" || ["annulee", "expiree"].includes(c.demande.etat);
  return ok({
    etat: c.livraison.etat,
    terminee,
    annulee: ["annulee", "expiree"].includes(c.demande.etat),
    // Le livreur ne peut partir que lorsque la pharmacie a marqué la commande prête.
    commandePrete: ["prete", "en_livraison"].includes(c.demande.etat),
    codeBloque: c.demande.essais_code >= ESSAIS_CODE_MAX,
    pharmacie: ph
      ? {
          nom: ph.nom,
          adresse: ph.adresse,
          repere: ph.repere,
          telephone: ph.telephone_public ?? ph.telephone_alerte_1,
          latitude: pharma?.latitude ?? null,
          longitude: pharma?.longitude ?? null,
        }
      : null,
    patient: terminee
      ? null
      : {
          repere: c.demande.repere,
          telephone: c.demande.telephone_patient,
          latitude: patient?.latitude ?? null,
          longitude: patient?.longitude ?? null,
        },
  });
}

export async function POST(requete: Request, { params }: Contexte) {
  const { jeton } = await params;
  if (!jetonValide(jeton)) return erreur("Lien invalide.", 404);
  const corps = await lireCorps(requete);
  if (!corps) return erreur("Requête invalide.");
  const c = await charger(jeton);
  if (!c) return erreur("Course introuvable.", 404);
  if (["annulee", "expiree"].includes(c.demande.etat)) return erreur("Cette demande est annulée.", 409);

  const db = creerClientServeur();
  const maintenant = new Date().toISOString();

  if (corps.action === "parti") {
    if (c.livraison.etat !== "creee") return erreur("La course a déjà commencé.");
    if (c.demande.etat !== "prete") return erreur("La commande n'est pas encore prête. Attendez le message de la pharmacie.", 409);
    await db.from("livraisons").update({ etat: "parti" }).eq("id", c.livraison.id);
    await db
      .from("demandes")
      .update({ etat: "en_livraison", mis_a_jour_le: maintenant })
      .eq("id", c.demande.id);
    await db.from("journal_alertes").insert({ demande_id: c.demande.id, evenement: "livreur_parti" });
    return ok();
  }

  if (corps.action === "position") {
    if (c.livraison.etat !== "parti" && c.livraison.etat !== "arrive") return erreur("Course non démarrée.", 409);
    const lat = Number(corps.latitude);
    const lng = Number(corps.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return erreur("Position invalide.");
    }
    await db
      .from("positions_livreur")
      .insert({ livraison_id: c.livraison.id, position: `SRID=4326;POINT(${lng} ${lat})` });
    return ok();
  }

  if (corps.action === "arrive") {
    if (c.livraison.etat !== "parti") return erreur("Action impossible à ce stade.");
    await db.from("livraisons").update({ etat: "arrive" }).eq("id", c.livraison.id);
    return ok();
  }

  if (corps.action === "remis") {
    if (c.livraison.etat !== "parti" && c.livraison.etat !== "arrive") return erreur("Action impossible à ce stade.");
    if (c.demande.essais_code >= ESSAIS_CODE_MAX) return erreur("Trop d'essais. Contactez la pharmacie.", 423);
    const code = typeof corps.code === "string" ? corps.code.trim() : "";
    if (!codeValide(code)) return erreur("Le code a 4 chiffres.");

    if (!codesIdentiques(code, c.demande.code_remise)) {
      await db.from("demandes").update({ essais_code: c.demande.essais_code + 1 }).eq("id", c.demande.id);
      const restants = ESSAIS_CODE_MAX - c.demande.essais_code - 1;
      return erreur(`Code incorrect. ${restants > 0 ? `${restants} essai(s) restant(s).` : "Plus d'essai possible."}`, 403);
    }

    await db.from("livraisons").update({ etat: "remis", remis_le: maintenant }).eq("id", c.livraison.id);
    await db
      .from("demandes")
      .update({ etat: "remise", remise_le: maintenant, mis_a_jour_le: maintenant })
      .eq("id", c.demande.id);
    // Règle RG11 : la position du livreur est supprimée dès la course terminée.
    await db.from("positions_livreur").delete().eq("livraison_id", c.livraison.id);
    await db
      .from("ordonnances")
      .update({
        supprimer_apres: new Date(Date.now() + JOURS_CONSERVATION_ORDONNANCE * 86400 * 1000).toISOString(),
      })
      .eq("demande_id", c.demande.id);
    await db.from("journal_alertes").insert({ demande_id: c.demande.id, evenement: "remise_livraison" });
    return ok();
  }

  return erreur("Action inconnue.");
}
