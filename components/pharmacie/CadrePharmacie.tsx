"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Chargement, MessageErreur } from "@/components/ui";

// Cadre des pages de gestion de la pharmacie : le jeton est dans l'adresse (?j=...).
export function useJetonGestion(): string | null | undefined {
  // undefined = pas encore lu ; null = absent
  const [jeton, setJeton] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setJeton(new URLSearchParams(window.location.search).get("j"));
  }, []);
  return jeton;
}

export default function CadrePharmacie({
  titre,
  jeton,
  nomPharmacie,
  actif,
  children,
}: {
  titre: string;
  jeton: string | null | undefined;
  nomPharmacie?: string;
  actif: "gardes" | "historique";
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col gap-4 px-5 pb-10 pt-5">
      <header className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-vert">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <span className="text-[22px] font-extrabold tracking-tight">Medi24 · Pharmacie</span>
      </header>
      {nomPharmacie && <p className="text-[15px] font-semibold text-discret">{nomPharmacie}</p>}
      {jeton && (
        <nav className="grid grid-cols-2 gap-2" aria-label="Navigation pharmacie">
          <Link href={`/pharmacie/gardes?j=${jeton}`} aria-current={actif === "gardes" ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center rounded-xl text-sm font-bold ${actif === "gardes" ? "bg-vert text-white" : "bg-vert-clair text-vert-fonce"}`}>
            Mon espace
          </Link>
          <Link href={`/pharmacie/historique?j=${jeton}`} aria-current={actif === "historique" ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center rounded-xl text-sm font-bold ${actif === "historique" ? "bg-vert text-white" : "bg-vert-clair text-vert-fonce"}`}>
            Historique
          </Link>
        </nav>
      )}
      <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">{titre}</h1>
      {jeton === undefined && <Chargement />}
      {jeton === null && <MessageErreur>Lien incomplet. Utilisez le lien envoyé par Medi24.</MessageErreur>}
      {jeton && children}
    </main>
  );
}
