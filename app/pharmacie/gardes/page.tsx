import type { Metadata } from "next";
import ContenuGardesPharmacie from "./contenu";

// Le manifeste de l'application est choisi ici, côté serveur, dès le chargement de la page :
// l'installation sur l'écran d'accueil rouvre alors la page de CETTE pharmacie (avec son lien).
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ j?: string | string[] }>;
}): Promise<Metadata> {
  const { j } = await searchParams;
  const jeton = Array.isArray(j) ? j[0] : j;
  if (!jeton || !/^[0-9a-f]{48}$/.test(jeton)) return {};
  return { manifest: `/api/manifeste?d=${encodeURIComponent(`/pharmacie/gardes?j=${jeton}`)}` };
}

export default function Page() {
  return <ContenuGardesPharmacie />;
}
