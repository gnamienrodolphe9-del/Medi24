import { timingSafeEqual } from "crypto";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { erreur, ok } from "@/lib/serveur/http";
import {
  tacheCascade,
  tacheGardesSoir,
  tachePurge,
  tacheRapportMatin,
} from "@/lib/serveur/taches";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Contexte = { params: Promise<{ tache: string }> };

function autorise(requete: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const recu = requete.headers.get("authorization") ?? "";
  const attendu = `Bearer ${secret}`;
  const a = Buffer.from(recu);
  const b = Buffer.from(attendu);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function executer(requete: Request, { params }: Contexte) {
  if (!process.env.CRON_SECRET) return erreur("CRON_SECRET non configuré.", 500);
  if (!autorise(requete)) return erreur("Non autorisé.", 401);

  const { tache } = await params;
  const db = creerClientServeur();
  switch (tache) {
    case "cascade":
      return ok(await tacheCascade(db));
    case "gardes-soir":
      return ok(await tacheGardesSoir(db));
    case "matin":
      return ok(await tacheRapportMatin(db));
    case "purge":
      return ok(await tachePurge(db));
    default:
      return erreur("Tâche inconnue.", 404);
  }
}

export const GET = executer;
export const POST = executer;
