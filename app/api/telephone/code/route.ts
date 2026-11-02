import { creerClientServeur } from "@/lib/supabase/serveur";
import { normaliserTelephoneCi } from "@/lib/telephone";
import { envoyerCodeVerification } from "@/lib/serveur/verification";
import { erreur, lireCorps, ok } from "@/lib/serveur/http";

export const dynamic = "force-dynamic";

// Envoie un code de vérification au numéro du patient.
export async function POST(requete: Request) {
  const corps = await lireCorps(requete);
  const telephone =
    typeof corps?.telephone === "string" ? normaliserTelephoneCi(corps.telephone) : null;
  if (!telephone) return erreur("Le numéro doit avoir 10 chiffres.");

  const resultat = await envoyerCodeVerification(creerClientServeur(), telephone);
  if (!resultat.ok) return erreur(resultat.erreur, resultat.statut);
  return ok(resultat.codeDev ? { ok: true, codeDev: resultat.codeDev } : { ok: true });
}
