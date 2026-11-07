import { adresseSite } from "./http";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EtatDemande } from "@/lib/etats";
import type { LigneReponse } from "@/lib/totaux";

// Ce que voit la pharmacie sur son lien de réponse.
export type VuePharmacie = {
  expire: boolean;
  pharmacie: { nom: string };
  demande: {
    type: "medicament" | "ordonnance" | "symptomes";
    etat: EtatDemande;
    mode: "retrait" | "livraison" | null;
    creeLe: string;
    produits: { produit: string; quantite: number }[];
    texteLibre: string | null;
    age: string | null;
    poidsKg: number | null;
    grossesse: boolean;
    allergies: string | null;
    traitements: string | null;
    repere: string | null;
    ordonnances: string[]; // adresses temporaires (10 minutes)
  };
  // Pris en charge par une autre pharmacie.
  dejaPrise: boolean;
  estRetenue: boolean;
  reponse: {
    statut: "disponible" | "indisponible" | "partiel";
    avis: string | null;
    retraitPossible: boolean;
    livraisonPossible: boolean;
    lignes: LigneReponse[];
  } | null;
  // Numéro du patient : visible seulement par la pharmacie retenue, une fois le choix fait.
  telephonePatient: string | null;
  livraison: { telephoneLivreur: string; etat: "creee" | "parti" | "arrive" | "remis"; lien: string } | null;
  codeBloque: boolean;
};

type AlerteBd = {
  id: string;
  demande_id: string;
  pharmacie_id: string;
  expire_le: string;
  ouverte_le: string | null;
  resultat: string | null;
};

type DemandeBd = {
  id: string;
  type: VuePharmacie["demande"]["type"];
  etat: EtatDemande;
  mode: "retrait" | "livraison" | null;
  cree_le: string;
  texte_libre: string | null;
  age_texte: string | null;
  poids_kg: number | null;
  grossesse: boolean;
  allergies: string | null;
  traitements: string | null;
  repere: string | null;
  pharmacie_retenue_id: string | null;
  telephone_patient: string;
  essais_code: number;
};

export async function chargerAlerte(db: SupabaseClient, jeton: string) {
  const { data } = await db
    .from("alertes")
    .select("id, demande_id, pharmacie_id, expire_le, ouverte_le, resultat")
    .eq("jeton", jeton)
    .maybeSingle<AlerteBd>();
  return data;
}

export async function construireVuePharmacie(
  db: SupabaseClient,
  alerte: AlerteBd
): Promise<VuePharmacie | null> {
  const [{ data: ph }, { data: d }] = await Promise.all([
    db.from("pharmacies").select("nom").eq("id", alerte.pharmacie_id).maybeSingle<{ nom: string }>(),
    db
      .from("demandes")
      .select(
        "id, type, etat, mode, cree_le, texte_libre, age_texte, poids_kg, grossesse, allergies, traitements, repere, pharmacie_retenue_id, telephone_patient, essais_code"
      )
      .eq("id", alerte.demande_id)
      .maybeSingle<DemandeBd>(),
  ]);
  if (!ph || !d) return null;

  const expire = new Date(alerte.expire_le).getTime() < Date.now();
  const estRetenue = d.pharmacie_retenue_id === alerte.pharmacie_id;
  const dejaPrise = d.pharmacie_retenue_id !== null && !estRetenue;

  const [lignesDemande, ordonnances, reponseBd] = await Promise.all([
    db.from("lignes_demande").select("produit, quantite").eq("demande_id", d.id),
    db.from("ordonnances").select("chemin_fichier").eq("demande_id", d.id),
    db
      .from("reponses")
      .select("id, statut, avis, retrait_possible, livraison_possible")
      .eq("demande_id", d.id)
      .eq("pharmacie_id", alerte.pharmacie_id)
      .maybeSingle<{
        id: string;
        statut: "disponible" | "indisponible" | "partiel";
        avis: string | null;
        retrait_possible: boolean;
        livraison_possible: boolean;
      }>(),
  ]);

  // Photos d'ordonnance : adresses valables 10 minutes, réservées à une pharmacie alertée
  // dont le lien est encore valide et tant que la demande n'est pas terminée.
  const urls: string[] = [];
  const demandeOuverte = !["annulee", "expiree", "repli", "remise"].includes(d.etat);
  if (!expire && demandeOuverte && !dejaPrise) {
    for (const o of (ordonnances.data ?? []) as { chemin_fichier: string }[]) {
      const { data: signee } = await db.storage
        .from("ordonnances")
        .createSignedUrl(o.chemin_fichier, 600);
      if (signee?.signedUrl) urls.push(signee.signedUrl);
    }
  }

  let reponse: VuePharmacie["reponse"] = null;
  let livraison: VuePharmacie["livraison"] = null;
  if (reponseBd.data) {
    const { data: lignes } = await db
      .from("lignes_reponse")
      .select("id, produit, disponible, substitut, prix_fcfa, substitut_accepte")
      .eq("reponse_id", reponseBd.data.id)
      .order("produit");
    reponse = {
      statut: reponseBd.data.statut,
      avis: reponseBd.data.avis,
      retraitPossible: reponseBd.data.retrait_possible,
      livraisonPossible: reponseBd.data.livraison_possible,
      lignes: (lignes ?? []) as LigneReponse[],
    };
    const { data: liv } = await db
      .from("livraisons")
      .select("telephone_livreur, etat, jeton")
      .eq("reponse_id", reponseBd.data.id)
      .maybeSingle<{ telephone_livreur: string; etat: "creee" | "parti" | "arrive" | "remis"; jeton: string }>();
    // Le lien du livreur est donné à la pharmacie (c'est son livreur) : si le SMS n'arrive pas,
    // elle peut le copier ou l'envoyer par WhatsApp.
    if (liv) {
      livraison = {
        telephoneLivreur: liv.telephone_livreur,
        etat: liv.etat,
        lien: `${adresseSite()}/l/${liv.jeton}`,
      };
    }
  }

  return {
    expire,
    pharmacie: { nom: ph.nom },
    demande: {
      type: d.type,
      etat: d.etat,
      mode: estRetenue ? d.mode : null,
      creeLe: d.cree_le,
      produits: (lignesDemande.data ?? []) as { produit: string; quantite: number }[],
      texteLibre: d.texte_libre,
      age: d.age_texte,
      poidsKg: d.poids_kg,
      grossesse: d.grossesse,
      allergies: d.allergies,
      traitements: d.traitements,
      repere: d.repere,
      ordonnances: urls,
    },
    dejaPrise,
    estRetenue,
    reponse,
    telephonePatient: estRetenue && d.mode ? d.telephone_patient : null,
    livraison,
    codeBloque: d.essais_code >= 5,
  };
}
