import { creerClientServeur } from "@/lib/supabase/serveur";

export const dynamic = "force-dynamic";

// Manifeste de l'application : identique au manifeste fixe, sauf quand on l'installe depuis un
// lien personnel. L'icône de l'écran d'accueil doit alors rouvrir SA page :
//   - pharmacie : sa page de gestion (la page de réponse à une alerte, valable 12 h, y est remplacée) ;
//   - patient : le suivi de sa demande ;
//   - livreur : sa course.
// Utile surtout sur iPhone, où l'application installée ne partage rien avec le navigateur.
export async function GET(requete: Request) {
  const d = new URL(requete.url).searchParams.get("d") ?? "";

  let depart = "/";
  let nom = "Medi24";
  let court = "Medi24";
  let id = "/";

  const gestion = /^\/pharmacie\/(?:gardes|historique)\?j=([0-9a-f]{48})$/.exec(d);
  const alerte = /^\/p\/([0-9a-f]{48})$/.exec(d);

  let jetonGestion: string | null = null;
  if (gestion) {
    jetonGestion = gestion[1];
  } else if (alerte) {
    const { data } = await creerClientServeur()
      .from("alertes")
      .select("pharmacies(jeton_gestion)")
      .eq("jeton", alerte[1])
      .maybeSingle();
    const ph = (data as { pharmacies?: unknown } | null)?.pharmacies;
    const fiche = Array.isArray(ph) ? ph[0] : ph;
    const valeur = (fiche as { jeton_gestion?: string } | null | undefined)?.jeton_gestion;
    if (valeur && /^[0-9a-f]{48}$/.test(valeur)) jetonGestion = valeur;
  }

  const suivi = /^\/suivi\/([0-9a-f]{48})$/.exec(d);
  const livreur = /^\/l\/([0-9a-f]{48})$/.exec(d);
  if (suivi) {
    depart = `/suivi/${suivi[1]}`;
  } else if (livreur) {
    depart = `/l/${livreur[1]}`;
    nom = "Medi24 Livreur";
    court = "Medi24 Livreur";
    id = "/livreur";
  }

  if (jetonGestion) {
    depart = `/pharmacie/gardes?j=${jetonGestion}`;
    nom = "Medi24 Pharmacie";
    court = "Medi24 Pharma";
    id = `/pharmacie?i=${jetonGestion.slice(0, 8)}`;
  }

  const manifeste = {
    id,
    name: nom,
    short_name: court,
    description: "Pharmacies de garde et médicaments, la nuit, à Yopougon.",
    lang: "fr",
    start_url: depart,
    scope: "/",
    display: "standalone",
    background_color: "#f5f6f1",
    theme_color: "#0a6847",
    icons: [
      { src: "/icons/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return new Response(JSON.stringify(manifeste), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-store" },
  });
}
