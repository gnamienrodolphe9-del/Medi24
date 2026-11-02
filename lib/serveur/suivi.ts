import type { SupabaseClient } from "@supabase/supabase-js";
import type { EtatDemande } from "@/lib/etats";
import type { LigneReponse } from "@/lib/totaux";
import type { PharmacieGarde } from "@/lib/types";
import { CENTRE_YOPOUGON } from "@/lib/garde";

// Ce que voit le patient sur sa page de suivi. Jamais de numéro d'alerte de pharmacie,
// jamais de jeton d'une autre personne.
export type SuiviPatient = {
  etat: EtatDemande;
  type: "medicament" | "ordonnance" | "symptomes";
  mode: "retrait" | "livraison" | null;
  creeLe: string;
  repliFait: boolean;
  pharmaciesAlertees: number;
  produits: { produit: string; quantite: number }[];
  codeRemise: string | null;
  pharmacie: {
    nom: string;
    adresse: string | null;
    repere: string | null;
    telephone: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  reponse: {
    statut: "disponible" | "partiel";
    avis: string | null;
    retraitPossible: boolean;
    livraisonPossible: boolean;
    lignes: LigneReponse[];
  } | null;
  livraison: {
    etat: "creee" | "parti" | "arrive" | "remis";
    position: { latitude: number; longitude: number; le: string } | null;
  } | null;
  patient: { latitude: number | null; longitude: number | null };
  repliListe: PharmacieGarde[];
  evaluationFaite: boolean;
};

type DemandeBd = {
  id: string;
  type: SuiviPatient["type"];
  etat: EtatDemande;
  mode: SuiviPatient["mode"];
  cree_le: string;
  repli_fait: boolean;
  code_remise: string;
  pharmacie_retenue_id: string | null;
};

export async function construireSuivi(
  db: SupabaseClient,
  jeton: string
): Promise<{ demandeId: string; suivi: SuiviPatient } | null> {
  const { data: d } = await db
    .from("demandes")
    .select("id, type, etat, mode, cree_le, repli_fait, code_remise, pharmacie_retenue_id")
    .eq("jeton", jeton)
    .maybeSingle<DemandeBd>();
  if (!d) return null;

  const [lignesDemande, alertes, coord, evaluation] = await Promise.all([
    db.from("lignes_demande").select("produit, quantite").eq("demande_id", d.id),
    db.from("alertes").select("id", { count: "exact", head: true }).eq("demande_id", d.id),
    db.rpc("coordonnees_demande", { p_demande: d.id }),
    db.from("evaluations").select("id").eq("demande_id", d.id).maybeSingle(),
  ]);

  const coordPatient = ((coord.data ?? []) as { latitude: number; longitude: number }[])[0] ?? null;

  let pharmacie: SuiviPatient["pharmacie"] = null;
  let reponse: SuiviPatient["reponse"] = null;
  let livraison: SuiviPatient["livraison"] = null;

  if (d.pharmacie_retenue_id) {
    const { data: p } = await db
      .from("pharmacies")
      .select("nom, adresse, repere, telephone_public, telephone_alerte_1")
      .eq("id", d.pharmacie_retenue_id)
      .maybeSingle<{
        nom: string;
        adresse: string | null;
        repere: string | null;
        telephone_public: string | null;
        telephone_alerte_1: string;
      }>();
    const { data: c } = await db.rpc("coordonnees_pharmacie", { p_pharmacie: d.pharmacie_retenue_id });
    const cp = ((c ?? []) as { latitude: number; longitude: number }[])[0];
    if (p) {
      pharmacie = {
        nom: p.nom,
        adresse: p.adresse,
        repere: p.repere,
        // Numéro à appeler : le numéro public, sinon le numéro de la pharmacie.
        telephone: p.telephone_public ?? p.telephone_alerte_1,
        latitude: cp?.latitude ?? null,
        longitude: cp?.longitude ?? null,
      };
    }

    const { data: r } = await db
      .from("reponses")
      .select("id, statut, avis, retrait_possible, livraison_possible")
      .eq("demande_id", d.id)
      .eq("pharmacie_id", d.pharmacie_retenue_id)
      .maybeSingle<{
        id: string;
        statut: "disponible" | "partiel" | "indisponible";
        avis: string | null;
        retrait_possible: boolean;
        livraison_possible: boolean;
      }>();
    if (r && r.statut !== "indisponible") {
      const { data: lignes } = await db
        .from("lignes_reponse")
        .select("id, produit, disponible, substitut, prix_fcfa, substitut_accepte")
        .eq("reponse_id", r.id)
        .order("produit");
      reponse = {
        statut: r.statut,
        avis: r.avis,
        retraitPossible: r.retrait_possible,
        livraisonPossible: r.livraison_possible,
        lignes: (lignes ?? []) as LigneReponse[],
      };

      const { data: liv } = await db
        .from("livraisons")
        .select("id, etat")
        .eq("reponse_id", r.id)
        .maybeSingle<{ id: string; etat: "creee" | "parti" | "arrive" | "remis" }>();
      if (liv) {
        let position: { latitude: number; longitude: number; le: string } | null = null;
        if (liv.etat === "parti" || liv.etat === "arrive") {
          const { data: pos } = await db.rpc("derniere_position_livreur", { p_livraison: liv.id });
          const p0 = ((pos ?? []) as { latitude: number; longitude: number; cree_le: string }[])[0];
          if (p0) position = { latitude: p0.latitude, longitude: p0.longitude, le: p0.cree_le };
        }
        livraison = { etat: liv.etat, position };
      }
    }
  }

  // Liste d'appel directe : quand la recherche automatique n'a pas abouti.
  let repliListe: PharmacieGarde[] = [];
  const sansPharmacie = !d.pharmacie_retenue_id;
  if (sansPharmacie && (d.repli_fait || d.etat === "repli" || d.etat === "expiree")) {
    const { data } = await db.rpc("pharmacies_de_garde", {
      lat: coordPatient?.latitude ?? CENTRE_YOPOUGON.latitude,
      lng: coordPatient?.longitude ?? CENTRE_YOPOUGON.longitude,
      limite: 5,
    });
    repliListe = (data ?? []) as PharmacieGarde[];
  }

  // Le code n'est utile au patient qu'une fois son choix fait.
  const afficherCode = d.mode !== null && ["confirmee", "prete", "en_livraison"].includes(d.etat);

  return {
    demandeId: d.id,
    suivi: {
      etat: d.etat,
      type: d.type,
      mode: d.mode,
      creeLe: d.cree_le,
      repliFait: d.repli_fait,
      pharmaciesAlertees: alertes.count ?? 0,
      produits: (lignesDemande.data ?? []) as { produit: string; quantite: number }[],
      codeRemise: afficherCode ? d.code_remise : null,
      pharmacie,
      reponse,
      livraison,
      patient: { latitude: coordPatient?.latitude ?? null, longitude: coordPatient?.longitude ?? null },
      repliListe,
      evaluationFaite: !!evaluation.data,
    },
  };
}
