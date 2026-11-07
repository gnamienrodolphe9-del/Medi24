import { creerClientServeur } from "@/lib/supabase/serveur";
import { jetonValide } from "@/lib/jeton";
import { erreur, lireCorps, ok } from "@/lib/serveur/http";

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
  const jeton = new URL(requete.url).searchParams.get("j");
  const contexte = await pharmacieParJeton(jeton);
  if (!contexte) return erreur("Lien invalide.", 404);
  const { db, pharmacie } = contexte;

  const hier = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const maintenant = new Date().toISOString();
  const [gardes, alertes, ouvertes] = await Promise.all([
    db
      .from("gardes")
      .select("id, debut, fin, confirmee, confirmee_le")
      .eq("pharmacie_id", pharmacie.id)
      .gte("fin", hier)
      .order("debut"),
    db
      .from("alertes")
      .select("id, cree_le, resultat, demandes(type, etat)")
      .eq("pharmacie_id", pharmacie.id)
      .order("cree_le", { ascending: false })
      .limit(60),
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

  const historique = ((alertes.data ?? []) as unknown[]).map((brut) => {
    const a = brut as {
      id: string;
      cree_le: string;
      resultat: string | null;
      demandes: { type: string; etat: string } | { type: string; etat: string }[] | null;
    };
    const d = Array.isArray(a.demandes) ? a.demandes[0] : a.demandes;
    return {
      id: a.id,
      le: a.cree_le,
      resultat: a.resultat,
      type: d?.type ?? null,
      etat: d?.etat ?? null,
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
