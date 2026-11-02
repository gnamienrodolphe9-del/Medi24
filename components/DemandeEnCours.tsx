"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { lireDemandeMemorisee } from "@/lib/client/memoire";

// Sur l'accueil : lien vers la dernière demande (moins de 24 heures), pour la retrouver
// si le patient a fermé la page de suivi.
export default function DemandeEnCours() {
  const [jeton, setJeton] = useState<string | null>(null);

  useEffect(() => {
    setJeton(lireDemandeMemorisee());
  }, []);

  if (!jeton) return null;
  return (
    <Link
      href={`/suivi/${jeton}`}
      className="flex min-h-14 items-center justify-between rounded-[14px] border-[1.5px] border-vert bg-vert-clair px-4 py-3 text-vert-fonce"
    >
      <span className="text-base font-extrabold">Retrouver ma demande en cours</span>
      <span aria-hidden="true" className="text-xl font-bold">›</span>
    </Link>
  );
}
