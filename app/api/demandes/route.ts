import { randomUUID } from "crypto";
import { creerClientServeur } from "@/lib/supabase/serveur";
import { validerDemande, validerFichierOrdonnance } from "@/lib/validation";
import { verifierCode } from "@/lib/serveur/verification";
import { creerSession, lireSession } from "@/lib/serveur/session_patient";
import { avancerCascade } from "@/lib/serveur/cascade";
import { erreur, ok } from "@/lib/serveur/http";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DEMANDES_PAR_HEURE_MAX = 3;
const JOURS_CONSERVATION_ORDONNANCE = 90;

// Création d'une demande. Reçoit un formulaire (JSON dans le champ "donnees" + photo facultative).
export async function POST(requete: Request) {
  let formulaire: FormData;
  try {
    formulaire = await requete.formData();
  } catch {
    return erreur("Formulaire illisible.");
  }

  let donnees: Record<string, unknown>;
  try {
    const brut = formulaire.get("donnees");
    donnees = JSON.parse(typeof brut === "string" ? brut : "{}") as Record<string, unknown>;
  } catch {
    return erreur("Données illisibles.");
  }

  const fichier = formulaire.get("ordonnance");
  const photo = fichier instanceof File && fichier.size > 0 ? fichier : null;
  if (photo) {
    const probleme = validerFichierOrdonnance(photo.type, photo.size);
    if (probleme) return erreur(probleme);
  }

  const verification = validerDemande({
    type: donnees.type,
    telephone: donnees.telephone,
    produits: donnees.produits,
    texteLibre: donnees.texteLibre,
    age: donnees.age,
    poidsKg: donnees.poidsKg,
    grossesse: donnees.grossesse,
    allergies: donnees.allergies,
    traitements: donnees.traitements,
    consentement: donnees.consentement,
    latitude: donnees.latitude,
    longitude: donnees.longitude,
    repere: donnees.repere,
    avecOrdonnance: photo !== null,
  });
  if (!verification.ok) return erreur(verification.erreurs.join(" "));
  const d = verification.valeur;

  const db = creerClientServeur();

  // Limite : 3 demandes par heure et par numéro.
  const { count } = await db
    .from("demandes")
    .select("id", { count: "exact", head: true })
    .eq("telephone_patient", d.telephone)
    .gte("cree_le", new Date(Date.now() - 3600 * 1000).toISOString());
  if ((count ?? 0) >= DEMANDES_PAR_HEURE_MAX) {
    return erreur("Trop de demandes pour ce numéro. Réessayez dans une heure.", 429);
  }

  // Patient déjà connecté sur cet appareil avec CE numéro : pas de nouveau code.
  // Sinon, code reçu par SMS ; une fois vérifié, l'appareil garde une session (compte patient).
  const session = await lireSession(db);
  if (!session || session.telephone !== d.telephone) {
    const code = typeof donnees.code === "string" ? donnees.code.trim() : "";
    if (!(await verifierCode(db, d.telephone, code))) {
      return erreur("Code de vérification incorrect ou expiré.", 403);
    }
    await creerSession(db, d.telephone);
  }

  const { data: demande, error } = await db
    .from("demandes")
    .insert({
      type: d.type,
      telephone_patient: d.telephone,
      telephone_verifie: true,
      position:
        d.latitude !== null && d.longitude !== null
          ? `SRID=4326;POINT(${d.longitude} ${d.latitude})`
          : null,
      repere: d.repere,
      texte_libre: d.texteLibre,
      age_texte: d.age,
      poids_kg: d.poidsKg,
      grossesse: d.grossesse,
      allergies: d.allergies,
      traitements: d.traitements,
      consentement: true,
    })
    .select("id, jeton")
    .single<{ id: string; jeton: string }>();
  if (error || !demande) return erreur("Création de la demande impossible.", 500);

  if (d.lignes.length > 0) {
    await db
      .from("lignes_demande")
      .insert(d.lignes.map((l) => ({ demande_id: demande.id, produit: l.produit, quantite: l.quantite })));
  }

  if (photo) {
    const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
    const chemin = `${demande.id}/${randomUUID()}.${extension}`;
    const { error: erreurStockage } = await db.storage
      .from("ordonnances")
      .upload(chemin, Buffer.from(await photo.arrayBuffer()), {
        contentType: photo.type,
        upsert: false,
      });
    if (erreurStockage) {
      await db.from("demandes").delete().eq("id", demande.id);
      return erreur("L'envoi de la photo a échoué. Réessayez.", 500);
    }
    await db.from("ordonnances").insert({
      demande_id: demande.id,
      chemin_fichier: chemin,
      supprimer_apres: new Date(Date.now() + JOURS_CONSERVATION_ORDONNANCE * 86400 * 1000).toISOString(),
    });
  }

  await db.from("journal_alertes").insert({ demande_id: demande.id, evenement: "creee" });

  // Lance la première vague d'alertes tout de suite.
  await avancerCascade(db, demande.id);

  return ok({ jeton: demande.jeton }, 201);
}
