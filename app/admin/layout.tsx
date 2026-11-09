import type { Metadata } from "next";
import Espace from "@/components/Espace";

// L'administration ne doit jamais apparaître dans les moteurs de recherche.
export const metadata: Metadata = {
  title: "Administration Medi24",
  robots: { index: false, follow: false },
};

export default function LayoutAdmin({ children }: { children: React.ReactNode }) {
  return <Espace nom="admin">{children}</Espace>;
}
