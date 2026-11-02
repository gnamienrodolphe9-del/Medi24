"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { creerClientNavigateur } from "@/lib/supabase/client";
import type { PharmacieGarde } from "@/lib/types";
import {
  CENTRE_YOPOUGON,
  formaterDateHeureAbidjan,
  formaterDistance,
  formaterHeureAbidjan,
  lienItineraire,
} from "@/lib/garde";

// La carte est chargée seulement dans le navigateur (Leaflet a besoin de la page entière).
const Carte = dynamic(() => import("./CarteLeaflet"), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full animate-pulse rounded-xl bg-trait" aria-hidden="true" />
  ),
});

type Position = { latitude: number; longitude: number; connue: boolean };
type Etat = "chargement" | "ok" | "memoire" | "erreur";

const CLE_MEMOIRE = "medi24-garde-v1";

// Garde la dernière liste connue dans le téléphone, pour la montrer si internet est coupé.
function memoriser(liste: PharmacieGarde[]) {
  try {
    localStorage.setItem(
      CLE_MEMOIRE,
      JSON.stringify({ liste, le: new Date().toISOString() })
    );
  } catch {
    // Mémoire indisponible (navigation privée, par exemple) : on continue sans.
  }
}

function lireMemoire(): { liste: PharmacieGarde[]; le: string } | null {
  try {
    const brut = localStorage.getItem(CLE_MEMOIRE);
    if (!brut) return null;
    const donnees = JSON.parse(brut) as { liste: PharmacieGarde[]; le: string };
    const maintenant = Date.now();
    // On ne montre jamais une garde déjà terminée.
    const encoreDeGarde = donnees.liste.filter(
      (p) => new Date(p.garde_fin).getTime() > maintenant
    );
    return { liste: encoreDeGarde, le: donnees.le };
  } catch {
    return null;
  }
}

export default function ListePharmaciesGarde() {
  const [position, setPosition] = useState<Position>({
    ...CENTRE_YOPOUGON,
    connue: false,
  });
  const [messagePosition, setMessagePosition] = useState<string | null>(null);
  const [liste, setListe] = useState<PharmacieGarde[]>([]);
  const [etat, setEtat] = useState<Etat>("chargement");
  const [enregistreLe, setEnregistreLe] = useState<string | null>(null);

  const demanderPosition = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setMessagePosition(
        "Votre téléphone ne partage pas sa position. Distances calculées depuis le centre de Yopougon."
      );
      return;
    }
    setMessagePosition("Recherche de votre position…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          connue: true,
        });
        setMessagePosition(null);
      },
      () => {
        setMessagePosition(
          "Position indisponible. Distances calculées depuis le centre de Yopougon."
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  // Demande la position une fois à l'ouverture de la page.
  useEffect(() => {
    demanderPosition();
  }, [demanderPosition]);

  // Charge la liste, et la recharge quand la position change.
  useEffect(() => {
    let annule = false;

    async function charger() {
      setEtat("chargement");
      try {
        const supabase = creerClientNavigateur();
        const { data, error } = await supabase.rpc("pharmacies_de_garde", {
          lat: position.latitude,
          lng: position.longitude,
          limite: 10,
        });
        if (error) throw error;
        if (annule) return;
        const resultat = (data ?? []) as PharmacieGarde[];
        setListe(resultat);
        setEnregistreLe(null);
        setEtat("ok");
        memoriser(resultat);
      } catch {
        if (annule) return;
        const memoire = lireMemoire();
        if (memoire) {
          setListe(memoire.liste);
          setEnregistreLe(memoire.le);
          setEtat("memoire");
        } else {
          setListe([]);
          setEtat("erreur");
        }
      }
    }

    charger();
    return () => {
      annule = true;
    };
  }, [position.latitude, position.longitude]);

  return (
    <div className="flex flex-col gap-4">
      {/* Position */}
      <div className="flex flex-col gap-2">
        {position.connue ? (
          <p className="text-sm text-discret">Distances depuis votre position.</p>
        ) : (
          <button
            type="button"
            onClick={demanderPosition}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-[1.5px] border-vert bg-vert-clair px-4 text-base font-bold text-vert-fonce"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            Utiliser ma position
          </button>
        )}
        {messagePosition && (
          <p className="text-[13px] leading-snug text-discret" role="status">
            {messagePosition}
          </p>
        )}
      </div>

      {/* Avertissement : liste venant de la mémoire du téléphone */}
      {etat === "memoire" && enregistreLe && (
        <p
          className="rounded-xl bg-ambre px-4 py-3 text-sm font-semibold leading-snug text-ambre-fonce"
          role="status"
        >
          Pas de connexion. Liste enregistrée le{" "}
          {formaterDateHeureAbidjan(enregistreLe)} : elle peut être dépassée.
          Appelez avant de vous déplacer.
        </p>
      )}

      {/* Carte */}
      {(etat === "ok" || etat === "memoire") && liste.length > 0 && (
        <Carte
          centre={{ latitude: position.latitude, longitude: position.longitude }}
          positionConnue={position.connue}
          pharmacies={liste}
        />
      )}

      {/* États */}
      {etat === "chargement" && (
        <p className="text-base text-discret" role="status">
          Recherche des pharmacies de garde…
        </p>
      )}

      {etat === "erreur" && (
        <div className="flex flex-col gap-3 rounded-xl bg-rouge-clair p-4" role="alert">
          <p className="text-base font-bold text-[#8e1b12]">
            Impossible de charger la liste pour le moment.
          </p>
          <p className="text-sm leading-snug">
            Vérifiez votre connexion. En cas d&apos;urgence, appelez directement.
          </p>
          <Link
            href="/urgence"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-rouge px-4 text-base font-bold text-white"
          >
            Aller à Urgence
          </Link>
        </div>
      )}

      {(etat === "ok" || etat === "memoire") && liste.length === 0 && (
        <div className="flex flex-col gap-2 rounded-xl border-[1.5px] border-trait bg-white p-4">
          <p className="text-base font-bold">
            Aucune pharmacie de garde enregistrée en ce moment.
          </p>
          <p className="text-sm leading-snug text-discret">
            Les pharmacies affichent leur liste de garde sur leur vitrine. En cas
            d&apos;urgence, utilisez l&apos;espace Urgence.
          </p>
        </div>
      )}

      {/* Liste */}
      {liste.length > 0 && (
        <ul className="flex flex-col gap-3">
          {liste.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-trait bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[19px] font-extrabold leading-tight">{p.nom}</h2>
                  {(p.adresse || p.repere) && (
                    <p className="mt-1 text-sm text-discret">
                      {[p.adresse, p.repere].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                {etat === "ok" && (
                  <span className="whitespace-nowrap text-sm font-bold">
                    {formaterDistance(p.distance_m)}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
                <span className="rounded-xl bg-vert-clair px-2.5 py-1 text-vert-fonce">
                  De garde jusqu&apos;à {formaterHeureAbidjan(p.garde_fin)}
                </span>
                {p.garde_confirmee ? (
                  <span className="rounded-xl bg-vert-clair px-2.5 py-1 text-vert-fonce">
                    Garde confirmée
                  </span>
                ) : (
                  <span className="rounded-xl bg-ambre px-2.5 py-1 text-ambre-fonce">
                    Garde non confirmée
                  </span>
                )}
              </div>

              <div className="flex gap-2.5">
                {p.telephone_public ? (
                  <a
                    href={`tel:${p.telephone_public}`}
                    className="flex min-h-12 flex-1 items-center justify-center rounded-xl border-[1.5px] border-vert text-base font-extrabold text-vert"
                  >
                    Appeler
                  </a>
                ) : null}
                <a
                  href={lienItineraire(p.latitude, p.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-vert text-base font-extrabold text-white"
                >
                  Itinéraire
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
