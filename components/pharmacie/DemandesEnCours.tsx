"use client";

import Link from "next/link";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, Carte, Pastille } from "@/components/ui";

export type DemandePharmacie = {
  jeton: string;
  creeLe: string;
  statut: "nouvelle" | "attente_patient" | "a_preparer" | "prete" | "en_livraison";
  resume: string;
  repere: string | null;
};

const LIBELLES: Record<DemandePharmacie["statut"], { texte: string; ton: "vert" | "ambre" | "gris" }> = {
  nouvelle: { texte: "Nouvelle demande", ton: "ambre" },
  attente_patient: { texte: "Réponse envoyée : le patient choisit", ton: "gris" },
  a_preparer: { texte: "À préparer", ton: "vert" },
  prete: { texte: "Prête : attente de remise", ton: "vert" },
  en_livraison: { texte: "En livraison", ton: "vert" },
};

function depuis(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  return `il y a ${Math.floor(minutes / 60)} h`;
}

// Les demandes arrivent ici toute seules : la pharmacie n'a pas à chercher de lien.
export default function DemandesEnCours({ demandes }: { demandes: DemandePharmacie[] }) {
  const nouvelles = demandes.filter((d) => d.statut === "nouvelle");
  const suivies = demandes.filter((d) => d.statut !== "nouvelle");

  return (
    <section className="flex flex-col gap-3" aria-label="Demandes des patients">
      <div className="flex items-center gap-2.5">
        <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-vert" aria-hidden="true" />
        <h2 className="text-lg font-extrabold">
          {nouvelles.length > 0
            ? `${nouvelles.length} nouvelle${nouvelles.length > 1 ? "s" : ""} demande${nouvelles.length > 1 ? "s" : ""}`
            : "En écoute des demandes"}
        </h2>
      </div>

      {demandes.length === 0 && (
        <p className="text-[15px] leading-snug text-discret">
          Aucune demande pour le moment. Gardez cette page ouverte : les demandes des patients proches arrivent ici
          toutes seules, avec une notification et un SMS.
        </p>
      )}

      {nouvelles.map((d) => (
        <Carte key={d.jeton}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[17px] font-extrabold leading-snug">{d.resume}</p>
            <Pastille ton="ambre">{depuis(d.creeLe)}</Pastille>
          </div>
          {d.repere && <p className="text-[13px] text-discret">Patient près de : {d.repere}</p>}
          <Link href={`/p/${d.jeton}`} className={BOUTON_PRINCIPAL}>
            Répondre
          </Link>
        </Carte>
      ))}

      {suivies.map((d) => (
        <Carte key={d.jeton}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-base font-bold leading-snug">{d.resume}</p>
            <Pastille ton={LIBELLES[d.statut].ton}>{LIBELLES[d.statut].texte}</Pastille>
          </div>
          <p className="text-[13px] text-discret">{depuis(d.creeLe)}</p>
          <Link href={`/p/${d.jeton}`} className={BOUTON_SECONDAIRE}>
            Ouvrir
          </Link>
        </Carte>
      ))}
    </section>
  );
}
