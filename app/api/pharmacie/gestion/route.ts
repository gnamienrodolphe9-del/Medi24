import { creerClientServeur } from "@/lib/supabase/serveur";
import { jetonValide } from "@/lib/jeton";
import { erreur, lireCorps, ok } from "@/lib/serveur/http";
import { totalLignes, type LigneReponse } from "@/lib/totaux";

export const dynamic = "force-dynamic";

type PharmacieBd = { id: string; nom: string; service_jour: boolean; jour_debut: string; jour_fin: string };

async function pharmacieParJeton(jeton: string | null) {
  if (!jetonValide(jeton)) return null;
  const db = creerClientServeur();
  const { data } = await db
    .from("pharmacies")
    .select("id, nom, service_jour, jour_debut, jour_fin")
    .eq("jeton_gestion", jeton)
    .maybeSingle<PharmacieBd>();
  return data ? { db, pharmacie: data } : null;
}

// Planning de garde et historique d'une pharmacie, accessibles par son lien de gestion.
export async function GET(requete: Request) {
  const adresse = new URL(requete.url).searchParams;
  const jeton = adresse.get("j");
  const contexte = await pharmacieParJeton(jeton);
  if (!contexte) return erreur("Lien invalide.", 404);
  const { db, pharmacie } = contexte;
  // L'historique détaillé est plus lourd : la page « Mon espace » (relue toutes les 5 secondes)
  // ne le demande pas.
  const avecHistorique = adresse.get("historique") === "1";

  const hier = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const maintenant = new Date().toISOString();
  const [gardes, alertes, ouvertes] = await Promise.all([
    db
      .from("gardes")
      .select("id, debut, fin, confirmee, confirmee_le")
      .eq("pharmacie_id", pharmacie.id)
      .gte("fin", hier)
      .order("debut"),
    (avecHistorique ? db : null)
      ?.from("alertes")
      .select(
        "id, cree_le, envoyee_le, resultat, demande_id, demandes(type, etat, mode, texte_libre, repere, pharmacie_retenue_id, remise_le, lignes_demande(produit, quantite), evaluations(note, commentaire))"
      )
      .eq("pharmacie_id", pharmacie.id)
      .order("cree_le", { ascending: false })
      .limit(60) ?? Promise.resolve({ data: [] }),
    // Demandes à traiter : alertes encore valables des dernières 12 heures, avec le contenu.
    db
      .from("alertes")
      .select(
        "id, jeton, cree_le, expire_le, resultat, demandes(type, etat, mode, texte_libre, repere, pharmacie_retenue_id, lignes_demande(produit, quantite))"
      )
      .eq("pharmacie_id", pharmacie.id)
      .gt("expire_le", maintenant)
      .order("cree_le", { ascending: false })
      .limit(40),
  ]);

  type DemandeOuverte = {
    type: "medicament" | "ordonnance" | "symptomes";
    etat: string;
    mode: "retrait" | "livraison" | null;
    texte_libre: string | null;
    repere: string | null;
    pharmacie_retenue_id: string | null;
    lignes_demande: { produit: string; quantite: number }[] | null;
  };
  const demandes: {
    jeton: string;
    creeLe: string;
    statut: "nouvelle" | "attente_patient" | "a_preparer" | "prete" | "en_livraison";
    resume: string;
    repere: string | null;
  }[] = [];
  for (const brut of (ouvertes.data ?? []) as unknown[]) {
    const a = brut as { jeton: string; cree_le: string; resultat: string | null; demandes: DemandeOuverte | DemandeOuverte[] | null };
    const d = Array.isArray(a.demandes) ? a.demandes[0] : a.demandes;
    if (!d) continue;

    let statut: (typeof demandes)[number]["statut"] | null = null;
    if (d.pharmacie_retenue_id === pharmacie.id) {
      if (d.etat === "confirmee") statut = d.mode ? "a_preparer" : "attente_patient";
      else if (d.etat === "prete") statut = "prete";
      else if (d.etat === "en_livraison") statut = "en_livraison";
    } else if (!d.pharmacie_retenue_id && a.resultat === null && ["creee", "envoyee", "vue"].includes(d.etat)) {
      statut = "nouvelle";
    }
    if (!statut) continue;

    const produits = (d.lignes_demande ?? []).map((l) => (l.quantite > 1 ? `${l.produit} x${l.quantite}` : l.produit));
    const resume =
      d.type === "ordonnance"
        ? "Ordonnance (photo)"
        : d.type === "symptomes"
          ? `Symptômes : ${(d.texte_libre ?? "").slice(0, 80)}`
          : produits.slice(0, 3).join(", ") + (produits.length > 3 ? "…" : "");
    demandes.push({ jeton: a.jeton, creeLe: a.cree_le, statut, resume: resume || "Demande", repere: d.repere });
  }

  // Ma réponse à chaque demande (prix, substituts) pour le détail de l'historique.
  const idsDemandes = ((alertes.data ?? []) as { demande_id: string }[]).map((a) => a.demande_id);
  const { data: reponsesBd } = idsDemandes.length
    ? await db
        .from("reponses")
        .select(
          "demande_id, statut, cree_le, retrait_possible, livraison_possible, lignes_reponse(id, produit, disponible, substitut, prix_fcfa, substitut_accepte)"
        )
        .eq("pharmacie_id", pharmacie.id)
        .in("demande_id", idsDemandes)
    : { data: [] };
  type ReponseBd = {
    demande_id: string;
    statut: string;
    cree_le: string;
    retrait_possible: boolean;
    livraison_possible: boolean;
    lignes_reponse: LigneReponse[] | null;
  };
  const reponsesParDemande = new Map<string, ReponseBd>();
  for (const r of (reponsesBd ?? []) as ReponseBd[]) reponsesParDemande.set(r.demande_id, r);

  type DemandeHistorique = {
    type: string;
    etat: string;
    mode: "retrait" | "livraison" | null;
    texte_libre: string | null;
    repere: string | null;
    pharmacie_retenue_id: string | null;
    remise_le: string | null;
    lignes_demande: { produit: string; quantite: number }[] | null;
    evaluations: { note: number; commentaire: string | null } | { note: number; commentaire: string | null }[] | null;
  };

  const historique = ((alertes.data ?? []) as unknown[]).map((brut) => {
    const a = brut as {
      id: string;
      cree_le: string;
      envoyee_le: string | null;
      resultat: string | null;
      demande_id: string;
      demandes: DemandeHistorique | DemandeHistorique[] | null;
    };
    const d = Array.isArray(a.demandes) ? a.demandes[0] : a.demandes;
    const r = reponsesParDemande.get(a.demande_id) ?? null;
    const lignes = r?.lignes_reponse ?? [];
    const { total, prixManquant } = totalLignes(lignes);
    const retenue = d?.pharmacie_retenue_id === pharmacie.id;
    const evaluation = d ? (Array.isArray(d.evaluations) ? d.evaluations[0] : d.evaluations) : null;
    const debutAttente = a.envoyee_le ?? a.cree_le;
    return {
      id: a.id,
      le: a.cree_le,
      resultat: a.resultat,
      type: d?.type ?? null,
      etat: d?.etat ?? null,
      mode: d?.mode ?? null,
      retenue,
      // Une autre pharmacie a été choisie.
      priseParAutre: !!d?.pharmacie_retenue_id && !retenue,
      repere: d?.repere ?? null,
      texteLibre: d?.texte_libre ?? null,
      demandes: (d?.lignes_demande ?? []).map((l) => ({ produit: l.produit, quantite: l.quantite })),
      delaiReponseSecondes: r ? Math.max(0, Math.round((new Date(r.cree_le).getTime() - new Date(debutAttente).getTime()) / 1000)) : null,
      reponse: r
        ? {
            statut: r.statut,
            retraitPossible: r.retrait_possible,
            livraisonPossible: r.livraison_possible,
            total,
            prixManquant,
            lignes: lignes.map((l) => ({
              produit: l.produit,
              disponible: l.disponible,
              substitut: l.substitut,
              prix: l.prix_fcfa,
              substitutAccepte: l.substitut_accepte,
            })),
          }
        : null,
      remiseLe: d?.remise_le ?? null,
      note: evaluation?.note ?? null,
      commentaire: evaluation?.commentaire ?? null,
    };
  });

  return ok({
    pharmacie: pharmacie.nom,
    gardes: gardes.data ?? [],
    historique,
    demandes,
    serviceJour: {
      actif: pharmacie.service_jour,
      debut: pharmacie.jour_debut.slice(0, 5),
      fin: pharmacie.jour_fin.slice(0, 5),
    },
  });
}

export async function POST(requete: Request) {
  const jeton = new URL(requete.url).searchParams.get("j");
  const contexte = await pharmacieParJeton(jeton);
  if (!contexte) return erreur("Lien invalide.", 404);
  const corps = await lireCorps(requete);
  if (!corps) return erreur("Requête invalide.");
  const { db, pharmacie } = contexte;

  // Pause ou reprise des demandes en journée.
  if (corps.action === "service_jour" && typeof corps.actif === "boolean") {
    const { error } = await db.from("pharmacies").update({ service_jour: corps.actif }).eq("id", pharmacie.id);
    if (error) return erreur("Enregistrement impossible. Réessayez.", 500);
    return ok();
  }

  if (corps.action === "confirmer_garde" && typeof corps.id === "string") {
    const { data, error } = await db
      .from("gardes")
      .update({ confirmee: true, confirmee_le: new Date().toISOString() })
      .eq("id", corps.id)
      .eq("pharmacie_id", pharmacie.id)
      .select("id");
    if (error || !data || data.length === 0) return erreur("Garde introuvable.", 404);
    return ok();
  }
  return erreur("Action inconnue.");
}
