import type { SupabaseClient } from "@supabase/supabase-js";
import { totalLignes, type LigneReponse } from "@/lib/totaux";

// Résumé de la commande montré au moment de la remise, une fois que le patient a donné son code :
// la personne qui remet (pharmacien ou livreur) vérifie que la commande correspond bien au patient
// qui se présente, avant de confirmer.
//
// Jamais montré ici : âge, poids, grossesse, allergies, traitements, symptômes, photo d'ordonnance.
// Ce sont des informations de santé inutiles pour remettre un sachet.

export type ArticleRemise = {
  produit: string;
  quantite: number;
  prix: number | null;
  // Nom du produit demandé quand le patient a accepté un substitut proposé par la pharmacie.
  remplace: string | null;
};

export type ResumeRemise = {
  commandeLe: string;
  mode: "retrait" | "livraison" | null;
  pharmacie: string | null;
  patient: { prenom: string | null; telephone: string; repere: string | null };
  // null : le détail des produits n'est pas montré (réglage RESUME_LIVREUR_PRODUITS=non).
  articles: ArticleRemise[] | null;
  nombreArticles: number;
  total: number | null;
  prixManquant: boolean;
  surOrdonnance: boolean;
};

const normaliser = (t: string) => t.trim().toLowerCase();

export async function chargerResume(
  db: SupabaseClient,
  demandeId: string,
  options: { avecProduits: boolean }
): Promise<ResumeRemise | null> {
  const { data: d } = await db
    .from("demandes")
    .select("cree_le, mode, prenom_patient, telephone_patient, repere, type, pharmacie_retenue_id")
    .eq("id", demandeId)
    .maybeSingle<{
      cree_le: string;
      mode: "retrait" | "livraison" | null;
      prenom_patient: string | null;
      telephone_patient: string;
      repere: string | null;
      type: string;
      pharmacie_retenue_id: string | null;
    }>();
  if (!d) return null;

  const [pharmacie, demandees, reponse] = await Promise.all([
    d.pharmacie_retenue_id
      ? db.from("pharmacies").select("nom").eq("id", d.pharmacie_retenue_id).maybeSingle<{ nom: string }>()
      : Promise.resolve({ data: null }),
    db.from("lignes_demande").select("produit, quantite").eq("demande_id", demandeId),
    d.pharmacie_retenue_id
      ? db
          .from("reponses")
          .select("id")
          .eq("demande_id", demandeId)
          .eq("pharmacie_id", d.pharmacie_retenue_id)
          .maybeSingle<{ id: string }>()
      : Promise.resolve({ data: null }),
  ]);

  const quantites = new Map<string, number>();
  for (const l of (demandees.data ?? []) as { produit: string; quantite: number }[]) {
    quantites.set(normaliser(l.produit), l.quantite);
  }

  let lignes: LigneReponse[] = [];
  if (reponse.data) {
    const { data } = await db
      .from("lignes_reponse")
      .select("id, produit, disponible, substitut, prix_fcfa, substitut_accepte")
      .eq("reponse_id", reponse.data.id)
      .order("produit");
    lignes = (data ?? []) as LigneReponse[];
  }

  // Ce qui sera réellement remis : produits disponibles, et substituts acceptés par le patient.
  const articles: ArticleRemise[] = [];
  for (const l of lignes) {
    const quantite = quantites.get(normaliser(l.produit)) ?? 1;
    if (l.disponible) {
      articles.push({ produit: l.produit, quantite, prix: l.prix_fcfa, remplace: null });
    } else if (l.substitut && l.substitut_accepte === true) {
      articles.push({ produit: l.substitut, quantite, prix: l.prix_fcfa, remplace: l.produit });
    }
  }

  const { total, prixManquant } = totalLignes(lignes);
  return {
    commandeLe: d.cree_le,
    mode: d.mode,
    pharmacie: pharmacie.data?.nom ?? null,
    patient: { prenom: d.prenom_patient, telephone: d.telephone_patient, repere: d.repere },
    articles: options.avecProduits ? articles : null,
    nombreArticles: articles.reduce((t, a) => t + a.quantite, 0),
    total: lignes.length > 0 ? total : null,
    prixManquant,
    surOrdonnance: d.type === "ordonnance",
  };
}
