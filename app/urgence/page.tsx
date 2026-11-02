"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { lirePosition, type PositionSimple } from "@/lib/client/position";
import {
  messagePosition,
  NUMERO_POMPIERS,
  NUMERO_SAMU,
  SIGNES_GRAVES,
} from "@/lib/urgence";

type Structure = {
  id: string;
  nom: string;
  type: string | null;
  adresse: string | null;
  telephone: string | null;
};

const CLE_STRUCTURES = "medi24-structures-v1";

function lireStructuresMemorisees(): Structure[] {
  try {
    const brut = localStorage.getItem(CLE_STRUCTURES);
    return brut ? (JSON.parse(brut) as Structure[]) : [];
  } catch {
    return [];
  }
}

// Espace Urgence : fonctionne sans internet (appel, tri de gravité, dernière liste connue).
// Principe : appeler d'abord, ne rien chercher avant.
export default function Urgence() {
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const [aucunSigne, setAucunSigne] = useState(false);
  const [position, setPosition] = useState<PositionSimple | null>(null);
  const [messagePos, setMessagePos] = useState<string | null>(null);
  const [recherchePos, setRecherchePos] = useState(false);
  const [structures, setStructures] = useState<Structure[]>([]);
  const [structuresHorsLigne, setStructuresHorsLigne] = useState(false);

  const signeGrave = coches.size > 0;

  useEffect(() => {
    let annule = false;
    setStructures(lireStructuresMemorisees());

    async function charger() {
      try {
        const { data, error } = await creerClientNavigateur()
          .from("structures_sante")
          .select("id, nom, type, adresse, telephone")
          .eq("ouvert_la_nuit", true)
          .order("nom");
        if (error) throw error;
        if (annule) return;
        const liste = (data ?? []) as Structure[];
        setStructures(liste);
        setStructuresHorsLigne(false);
        try {
          localStorage.setItem(CLE_STRUCTURES, JSON.stringify(liste));
        } catch {
          // Mémoire indisponible : on continue sans.
        }
      } catch {
        if (!annule) setStructuresHorsLigne(true);
      }
    }
    charger();
    return () => {
      annule = true;
    };
  }, []);

  function basculer(id: string) {
    setCoches((actuel) => {
      const suite = new Set(actuel);
      if (suite.has(id)) suite.delete(id);
      else suite.add(id);
      return suite;
    });
    setAucunSigne(false);
  }

  async function partagerPosition() {
    setMessagePos(null);
    setRecherchePos(true);
    try {
      setPosition(await lirePosition());
    } catch (e) {
      setMessagePos(e instanceof Error ? e.message : "Position introuvable.");
    } finally {
      setRecherchePos(false);
    }
  }

  const texteUrgence = position ? messagePosition(position.latitude, position.longitude) : null;

  return (
    <main className="flex min-h-screen flex-col pb-10">
      <div className="flex flex-col gap-3.5 bg-rouge px-5 pb-6 pt-4 text-white">
        <Link href="/" className="inline-flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-semibold">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Accueil
        </Link>
        <h1 className="text-[32px] font-extrabold tracking-tight">Urgence</h1>
        <p className="text-base leading-snug">Appelez d&apos;abord. Ne cherchez aucun produit.</p>
      </div>

      <div className="flex flex-col gap-3 px-5 py-5">
        <a
          href={`tel:${NUMERO_SAMU}`}
          className="flex min-h-[68px] items-center justify-between rounded-2xl bg-rouge px-5 text-white"
        >
          <span className="flex flex-col">
            <span className="text-xl font-extrabold">Appeler le SAMU</span>
            <span className="text-sm">Urgence médicale</span>
          </span>
          <span className="text-3xl font-extrabold">{NUMERO_SAMU}</span>
        </a>
        <a
          href={`tel:${NUMERO_POMPIERS}`}
          className="flex min-h-[68px] items-center justify-between rounded-2xl border-2 border-rouge bg-white px-5 text-rouge"
        >
          <span className="flex flex-col">
            <span className="text-xl font-extrabold">Appeler les pompiers</span>
            <span className="text-sm text-discret">Secours, accident, incendie</span>
          </span>
          <span className="text-3xl font-extrabold">{NUMERO_POMPIERS}</span>
        </a>

        <section className="mt-3 flex flex-col gap-3 rounded-2xl border-[1.5px] border-trait bg-white p-4">
          <h2 className="text-lg font-extrabold leading-tight">Un de ces signes est-il présent ?</h2>
          <ul className="flex flex-col gap-2">
            {SIGNES_GRAVES.map((s) => (
              <li key={s.id}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-trait px-3 py-2 text-[15px] leading-snug has-[:checked]:border-rouge has-[:checked]:bg-rouge-clair">
                  <input
                    type="checkbox"
                    checked={coches.has(s.id)}
                    onChange={() => basculer(s.id)}
                    className="h-6 w-6 shrink-0 accent-[#b42318]"
                  />
                  {s.libelle}
                </label>
              </li>
            ))}
          </ul>
          {!signeGrave && !aucunSigne && (
            <button
              type="button"
              onClick={() => setAucunSigne(true)}
              className="min-h-12 rounded-2xl border-[1.5px] border-[#76837b] bg-white px-4 text-base font-bold"
            >
              Aucun de ces signes
            </button>
          )}
        </section>

        {signeGrave && (
          <section className="flex flex-col gap-3 rounded-2xl bg-rouge-clair p-4" role="alert">
            <h2 className="text-xl font-extrabold leading-tight text-[#8e1b12]">
              Appelez le SAMU maintenant : {NUMERO_SAMU}
            </h2>
            <p className="text-[15px] leading-snug text-[#8e1b12]">
              Ne cherchez pas de médicament. Restez avec la personne et donnez votre position.
            </p>
            <a
              href={`tel:${NUMERO_SAMU}`}
              className="flex min-h-14 items-center justify-center rounded-2xl bg-rouge text-lg font-extrabold text-white"
            >
              Appeler le {NUMERO_SAMU}
            </a>

            <button
              type="button"
              onClick={partagerPosition}
              disabled={recherchePos}
              className="min-h-12 rounded-2xl border-[1.5px] border-rouge bg-white px-4 text-base font-bold text-rouge disabled:opacity-60"
            >
              {recherchePos ? "Recherche de la position…" : "Partager ma position à un proche"}
            </button>
            {messagePos && <p className="text-sm font-semibold text-[#8e1b12]">{messagePos}</p>}
            {texteUrgence && (
              <div className="flex flex-col gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(texteUrgence)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-12 items-center justify-center rounded-2xl bg-white px-4 text-base font-bold text-encre"
                >
                  Envoyer par WhatsApp
                </a>
                <a
                  href={`sms:?&body=${encodeURIComponent(texteUrgence)}`}
                  className="flex min-h-12 items-center justify-center rounded-2xl bg-white px-4 text-base font-bold text-encre"
                >
                  Envoyer par SMS
                </a>
              </div>
            )}
          </section>
        )}

        {!signeGrave && aucunSigne && (
          <section className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-trait bg-white p-4">
            <h2 className="text-lg font-extrabold leading-tight">Pas de signe grave</h2>
            <p className="text-[15px] leading-snug text-discret">
              Si la situation s&apos;aggrave, appelez le {NUMERO_SAMU}. Sinon, voici ce que vous pouvez faire :
            </p>
            <Link
              href="/pharmacies-de-garde"
              className="flex min-h-14 items-center justify-center rounded-2xl bg-vert text-lg font-extrabold text-white"
            >
              Pharmacies de garde
            </Link>
            <Link
              href="/demande"
              className="flex min-h-12 items-center justify-center rounded-2xl border-[1.5px] border-vert bg-white px-4 text-base font-bold text-vert"
            >
              Demander un médicament
            </Link>
          </section>
        )}

        <section className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-trait bg-white p-4">
          <h2 className="text-lg font-extrabold leading-tight">Structures de santé ouvertes la nuit</h2>
          {structuresHorsLigne && (
            <p className="rounded-xl bg-ambre p-3 text-sm font-semibold text-ambre-fonce">
              Pas d&apos;internet : liste enregistrée sur ce téléphone. Appelez pour confirmer qu&apos;ils sont ouverts.
            </p>
          )}
          {structures.length === 0 ? (
            <p className="text-[15px] text-discret">Aucune structure enregistrée pour le moment.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {structures.map((s) => (
                <li key={s.id} className="flex flex-col gap-2 rounded-xl border-[1.5px] border-trait p-3">
                  <div>
                    <p className="text-base font-extrabold leading-tight">{s.nom}</p>
                    <p className="mt-0.5 text-[13px] text-discret">
                      {[s.type, s.adresse].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {s.telephone && (
                      <a
                        href={`tel:${s.telephone}`}
                        className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-vert px-3 text-sm font-bold text-white"
                      >
                        Appeler
                      </a>
                    )}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        [s.nom, s.adresse, "Abidjan"].filter(Boolean).join(" ")
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-11 flex-1 items-center justify-center rounded-xl border-[1.5px] border-vert bg-white px-3 text-sm font-bold text-vert"
                    >
                      Itinéraire
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-[13px] leading-snug text-discret">
          Medi24 ne remplace pas les services d&apos;urgence et ne pose aucun diagnostic.
        </p>
      </div>
    </main>
  );
}
