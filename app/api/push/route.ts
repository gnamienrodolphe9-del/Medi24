import { creerClientServeur } from "@/lib/supabase/serveur";
import { erreur, lireCorps, ok } from "@/lib/serveur/http";
import { pushDisponible, envoyerPush, type CiblePush } from "@/lib/serveur/push";

export const dynamic = "force-dynamic";

const ABONNEMENTS_MAX_PAR_CIBLE = 20;

type Db = ReturnType<typeof creerClientServeur>;

// Retrouve la cible (pharmacie, patient ou livreur) à partir du jeton secret de la page.
async function trouverCible(
  db: Db,
  genre: string,
  jeton: string
): Promise<{ cible: CiblePush; chemin: string } | null> {
  if (!/^[0-9a-f]{48}$/.test(jeton)) return null;

  if (genre === "gestion") {
    const { data } = await db.from("pharmacies").select("id").eq("jeton_gestion", jeton).maybeSingle<{ id: string }>();
    return data ? { cible: { type: "pharmacie", id: data.id }, chemin: `/pharmacie/gardes?j=${jeton}` } : null;
  }
  if (genre === "alerte") {
    const { data } = await db.from("alertes").select("pharmacie_id").eq("jeton", jeton).maybeSingle<{ pharmacie_id: string }>();
    return data ? { cible: { type: "pharmacie", id: data.pharmacie_id }, chemin: `/p/${jeton}` } : null;
  }
  if (genre === "suivi") {
    const { data } = await db.from("demandes").select("id").eq("jeton", jeton).maybeSingle<{ id: string }>();
    return data ? { cible: { type: "demande", id: data.id }, chemin: `/suivi/${jeton}` } : null;
  }
  if (genre === "livreur") {
    const { data } = await db.from("livraisons").select("id").eq("jeton", jeton).maybeSingle<{ id: string }>();
    return data ? { cible: { type: "livraison", id: data.id }, chemin: `/l/${jeton}` } : null;
  }
  return null;
}

// Abonnement, désabonnement et notification de test d'un appareil.
// Aucun compte : le jeton secret de la page identifie la pharmacie, le patient ou le livreur.
export async function POST(requete: Request) {
  const corps = await lireCorps(requete);
  if (!corps) return erreur("Requête invalide.");
  if (!pushDisponible()) return erreur("Les notifications ne sont pas activées sur ce site.", 503);

  const genre = typeof corps.genre === "string" ? corps.genre : "";
  const jeton = typeof corps.jeton === "string" ? corps.jeton : "";
  const db = creerClientServeur();
  const trouve = await trouverCible(db, genre, jeton);
  if (!trouve) return erreur("Lien invalide.", 404);
  const { cible, chemin } = trouve;

  if (corps.action === "abonner") {
    const a = corps.abonnement as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined;
    const endpoint = typeof a?.endpoint === "string" ? a.endpoint : "";
    const p256dh = typeof a?.keys?.p256dh === "string" ? a.keys.p256dh : "";
    const auth = typeof a?.keys?.auth === "string" ? a.keys.auth : "";
    if (!endpoint.startsWith("https://") || endpoint.length > 1000 || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) {
      return erreur("Abonnement invalide.");
    }

    const { count } = await db
      .from("abonnements_push")
      .select("id", { count: "exact", head: true })
      .eq("cible_type", cible.type)
      .eq("cible_id", cible.id);
    if ((count ?? 0) >= ABONNEMENTS_MAX_PAR_CIBLE) {
      return erreur("Trop d'appareils sont déjà enregistrés pour ce lien.", 429);
    }

    const { error } = await db.from("abonnements_push").upsert(
      { cible_type: cible.type, cible_id: cible.id, endpoint, cle_p256dh: p256dh, cle_auth: auth },
      { onConflict: "cible_type,cible_id,endpoint" }
    );
    if (error) return erreur("Enregistrement impossible. Réessayez.", 500);
    return ok();
  }

  if (corps.action === "desabonner") {
    const endpoint = typeof corps.endpoint === "string" ? corps.endpoint : "";
    if (!endpoint) return erreur("Abonnement invalide.");
    await db
      .from("abonnements_push")
      .delete()
      .eq("cible_type", cible.type)
      .eq("cible_id", cible.id)
      .eq("endpoint", endpoint);
    return ok();
  }

  if (corps.action === "tester") {
    // Un test toutes les 10 secondes au plus, pour qu'un lien ne serve pas à harceler un appareil.
    const { data: dernier } = await db
      .from("abonnements_push")
      .select("dernier_envoi_le")
      .eq("cible_type", cible.type)
      .eq("cible_id", cible.id)
      .order("dernier_envoi_le", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle<{ dernier_envoi_le: string | null }>();
    if (dernier?.dernier_envoi_le && Date.now() - new Date(dernier.dernier_envoi_le).getTime() < 10000) {
      return erreur("Patientez quelques secondes avant un nouvel essai.", 429);
    }
    const joints = await envoyerPush(db, cible, {
      titre: "Medi24 : essai",
      corps: "Les alertes fonctionnent sur cet appareil.",
      chemin,
      etiquette: "essai",
    });
    if (joints === 0) return erreur("Aucun appareil n'est abonné. Activez d'abord les alertes.", 404);
    return ok({ ok: true, appareils: joints });
  }

  return erreur("Action inconnue.");
}
