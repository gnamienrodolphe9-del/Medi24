import { creerClientServeur } from "@/lib/supabase/serveur";
import { normaliserTelephoneCi } from "@/lib/telephone";
import { verifierCode } from "@/lib/serveur/verification";
import { creerSession, fermerSession, lireSession } from "@/lib/serveur/session_patient";
import { erreur, lireCorps, ok } from "@/lib/serveur/http";

export const dynamic = "force-dynamic";

type LigneDemande = { produit: string; quantite: number };
type DemandeBrute = {
  jeton: string;
  type: "medicament" | "ordonnance" | "symptomes";
  etat: string;
  mode: "retrait" | "livraison" | null;
  texte_libre: string | null;
  cree_le: string;
  lignes_demande: LigneDemande[] | null;
  pharmacie: { nom: string } | { nom: string }[] | null;
};

// État de la connexion sur cet appareil. Avec ?historique=1, renvoie aussi les demandes du patient.
export async function GET(requete: Request) {
  const db = creerClientServeur();
  const session = await lireSession(db);
  if (!session) return ok({ connecte: false });

  const avecHistorique = new URL(requete.url).searchParams.get("historique") === "1";
  if (!avecHistorique) return ok({ connecte: true, telephone: session.telephone });

  const { data } = await db
    .from("demandes")
    .select(
      "jeton, type, etat, mode, texte_libre, cree_le, lignes_demande(produit, quantite), pharmacie:pharmacies!pharmacie_retenue_id(nom)"
    )
    .eq("telephone_patient", session.telephone)
    .order("cree_le", { ascending: false })
    .limit(50);

  const demandes = ((data ?? []) as unknown as DemandeBrute[]).map((d) => {
    const ph = Array.isArray(d.pharmacie) ? d.pharmacie[0] : d.pharmacie;
    return {
      jeton: d.jeton,
      type: d.type,
      etat: d.etat,
      mode: d.mode,
      texteLibre: d.texte_libre,
      le: d.cree_le,
      produits: (d.lignes_demande ?? []).map((l) => ({ produit: l.produit, quantite: l.quantite })),
      pharmacie: ph?.nom ?? null,
    };
  });
  return ok({ connecte: true, telephone: session.telephone, demandes });
}

// Connexion (numéro + code reçu par SMS) ou déconnexion de cet appareil.
export async function POST(requete: Request) {
  const corps = await lireCorps(requete);
  const db = creerClientServeur();

  if (corps?.action === "deconnexion") {
    await fermerSession(db);
    return ok();
  }

  if (corps?.action === "connexion") {
    const telephone = typeof corps.telephone === "string" ? normaliserTelephoneCi(corps.telephone) : null;
    const code = typeof corps.code === "string" ? corps.code.trim() : "";
    if (!telephone) return erreur("Le numéro doit avoir 10 chiffres.");
    if (!(await verifierCode(db, telephone, code))) {
      return erreur("Code de vérification incorrect ou expiré.", 403);
    }
    await creerSession(db, telephone);
    return ok({ connecte: true, telephone });
  }

  return erreur("Action inconnue.");
}
