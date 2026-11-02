import { NextResponse } from "next/server";

// Réponses JSON des routes du serveur. "no-store" : jamais de copie en mémoire,
// car ces réponses contiennent des informations de santé.
export function ok(donnees: unknown = { ok: true }, statut = 200) {
  return NextResponse.json(donnees, { status: statut, headers: { "Cache-Control": "no-store" } });
}

export function erreur(message: string, statut = 400) {
  return NextResponse.json(
    { erreur: message },
    { status: statut, headers: { "Cache-Control": "no-store" } }
  );
}

export async function lireCorps(requete: Request): Promise<Record<string, unknown> | null> {
  try {
    const json: unknown = await requete.json();
    if (json && typeof json === "object" && !Array.isArray(json)) {
      return json as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export function adresseSite(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
