import { creerClientServeur } from "@/lib/supabase/serveur";
import { jetonValide } from "@/lib/jeton";
import { erreur, lireCorps, ok } from "@/lib/serveur/http";

export const dynamic = "force-dynamic";

type Contexte = { params: Promise<{ jeton: string }> };

async function demandeRemise(jeton: string) {
  const db = creerClientServeur();
  const { data } = await db
    .from("demandes")
    .select("id, etat")
    .eq("jeton", jeton)
    .maybeSingle<{ id: string; etat: string }>();
  return { db, demande: data };
}

export async function GET(_requete: Request, { params }: Contexte) {
  const { jeton } = await params;
  if (!jetonValide(jeton)) return erreur("Lien invalide.", 404);
  const { db, demande } = await demandeRemise(jeton);
  if (!demande) return erreur("Demande introuvable.", 404);
  const { data: existante } = await db
    .from("evaluations")
    .select("id")
    .eq("demande_id", demande.id)
    .maybeSingle();
  return ok({ possible: demande.etat === "remise" && !existante, dejaFaite: !!existante });
}

export async function POST(requete: Request, { params }: Contexte) {
  const { jeton } = await params;
  if (!jetonValide(jeton)) return erreur("Lien invalide.", 404);
  const corps = await lireCorps(requete);
  if (!corps) return erreur("Requête invalide.");

  const note = Number(corps.note);
  if (!Number.isInteger(note) || note < 1 || note > 5) return erreur("La note doit être entre 1 et 5.");
  const commentaire =
    typeof corps.commentaire === "string" ? corps.commentaire.trim().slice(0, 500) || null : null;

  const { db, demande } = await demandeRemise(jeton);
  if (!demande) return erreur("Demande introuvable.", 404);
  if (demande.etat !== "remise") return erreur("Vous pourrez évaluer une fois la commande remise.", 409);

  const { error } = await db.from("evaluations").insert({ demande_id: demande.id, note, commentaire });
  if (error) return erreur("Vous avez déjà donné votre avis.", 409);
  return ok();
}
