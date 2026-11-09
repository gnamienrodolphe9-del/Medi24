import type { ReactNode } from "react";

// Marque la zone d'un espace (patient, pharmacie, livreur, admin) pour que ses couleurs puissent
// être réglées séparément dans app/globals.css, section « COULEURS PAR ESPACE ».
export default function Espace({ nom, children }: { nom: "pharmacie" | "livreur" | "admin"; children: ReactNode }) {
  return (
    <div data-espace={nom} className="min-h-screen bg-fond text-encre">
      {children}
    </div>
  );
}
