import { ok } from "@/lib/serveur/http";
import { clePubliqueVapid, pushDisponible } from "@/lib/serveur/push";

export const dynamic = "force-dynamic";

// Donne la clé publique des notifications à la page. Elle est lue ici, côté serveur, À CHAQUE
// demande : contrairement à une variable intégrée au site lors de sa construction, elle ne dépend
// pas du cache de construction de Vercel. La clé publique n'est pas secrète.
export async function GET() {
  return ok({ cle: clePubliqueVapid(), serveurPret: pushDisponible() });
}
