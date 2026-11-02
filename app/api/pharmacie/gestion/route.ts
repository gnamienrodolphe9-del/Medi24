import { creerClientServeur } from "@/lib/supabase/serveur";
import { jetonValide } from "@/lib/jeton";
import { erreur, lireCorps, ok } from "@/lib/serveur/http";

export const dynamic = "force-dynamic";

type PharmacieBd = { id: string; nom: string };

async function pharmacieParJeton(jeton: string | null) {
  if (!jetonValide(jeton)) return null;
  const db = creerClientServeur();
  const { data } = await db
    .from("pharmacies")
    .select("id, nom")
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
  const [gardes, alertes] = await Promise.all([
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
  ]);

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

  return ok({ pharmacie: pharmacie.nom, gardes: gardes.data ?? [], historique });
}

export async function POST(requete: Request) {
  const jeton = new URL(requete.url).searchParams.get("j");
  const contexte = await pharmacieParJeton(jeton);
  if (!contexte) return erreur("Lien invalide.", 404);
  const corps = await lireCorps(requete);
  if (!corps) return erreur("Requête invalide.");
  const { db, pharmacie } = contexte;

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
