import Link from "next/link";
import type { ReactNode } from "react";

// Petits éléments d'interface communs aux écrans patient, pharmacie et livreur.

export const BOUTON_PRINCIPAL =
  "inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-vert px-4 text-lg font-extrabold text-white disabled:opacity-60";
export const BOUTON_SECONDAIRE =
  "inline-flex min-h-12 w-full items-center justify-center rounded-2xl border-[1.5px] border-vert bg-white px-4 text-base font-bold text-vert disabled:opacity-60";
export const BOUTON_DANGER =
  "inline-flex min-h-12 w-full items-center justify-center rounded-2xl border-[1.5px] border-rouge bg-white px-4 text-base font-bold text-rouge disabled:opacity-60";
export const CHAMP =
  "min-h-12 w-full rounded-[10px] border-[1.5px] border-bordure bg-white px-3.5 py-2 text-base text-encre";

export function MessageErreur({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl bg-rouge-clair p-3 text-sm font-semibold leading-snug text-rouge-fonce" role="alert">
      {children}
    </p>
  );
}

export function MessageInfo({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl bg-vert-clair p-3 text-sm font-semibold leading-snug text-vert-fonce" role="status">
      {children}
    </p>
  );
}

export function MessageAttention({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl bg-ambre p-3 text-sm font-semibold leading-snug text-ambre-fonce" role="status">
      {children}
    </p>
  );
}

export function Carte({ children, titre }: { children: ReactNode; titre?: string }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-trait bg-white p-4">
      {titre ? <h2 className="text-lg font-extrabold leading-tight">{titre}</h2> : null}
      {children}
    </section>
  );
}

export function LienRetour({ href, libelle }: { href: string; libelle: string }) {
  return (
    <Link href={href} className="inline-flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-semibold text-vert">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" />
      </svg>
      {libelle}
    </Link>
  );
}

export function Chargement({ texte = "Chargement…" }: { texte?: string }) {
  return (
    <p className="py-6 text-center text-base text-discret" role="status">
      {texte}
    </p>
  );
}

// Étiquette colorée d'état.
export function Pastille({ ton, children }: { ton: "vert" | "ambre" | "rouge" | "gris"; children: ReactNode }) {
  const classes = {
    vert: "bg-vert-clair text-vert-fonce",
    ambre: "bg-ambre text-ambre-fonce",
    rouge: "bg-rouge-clair text-rouge-fonce",
    gris: "bg-trait text-encre",
  }[ton];
  return (
    <span className={`inline-block whitespace-nowrap rounded-xl px-2.5 py-1 text-[13px] font-bold ${classes}`}>
      {children}
    </span>
  );
}
