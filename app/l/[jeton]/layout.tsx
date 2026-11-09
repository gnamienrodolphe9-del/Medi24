import type { Metadata } from "next";
import Espace from "@/components/Espace";

// Manifeste choisi côté serveur, dès le chargement : l'icône installée rouvre la bonne page.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ jeton: string }>;
}): Promise<Metadata> {
  const { jeton } = await params;
  if (!/^[0-9a-f]{48}$/.test(jeton)) return {};
  return { manifest: `/api/manifeste?d=${encodeURIComponent(`/l/${jeton}`)}` };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <Espace nom="livreur">{children}</Espace>;
}
