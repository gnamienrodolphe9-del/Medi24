"use client";

import { useCallback, useEffect, useState } from "react";
import CadreAdmin from "@/components/admin/CadreAdmin";
import { CLASSE_CHAMP } from "@/components/admin/Champ";
import { creerClientNavigateur } from "@/lib/supabase/client";
import {
  champVersInstantAbidjan,
  formaterDateHeureAbidjan,
  propositionNuit,
} from "@/lib/garde";
import type { GardeAdmin, PharmacieAdmin } from "@/lib/types";

// Ligne brute renvoyée par la base pour une garde, avec le nom de la pharmacie liée.
type LigneGarde = {
  id: string;
  debut: string;
  fin: string;
  confirmee: boolean;
  pharmacies: { nom: string } | { nom: string }[] | null;
};

function nomPharmacie(liee: LigneGarde["pharmacies"]): string {
  if (!liee) return "Pharmacie inconnue";
  return Array.isArray(liee) ? (liee[0]?.nom ?? "Pharmacie inconnue") : liee.nom;
}

function ContenuGardes() {
  const [pharmacies, setPharmacies] = useState<PharmacieAdmin[]>([]);
  const [gardes, setGardes] = useState<GardeAdmin[]>([]);
  const [chargement, setChargement] = useState(true);
  const [pharmacieId, setPharmacieId] = useState("");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async () => {
    const supabase = creerClientNavigateur();

    const { data: dataPharmacies, error: errPharmacies } = await supabase.rpc(
      "admin_lister_pharmacies"
    );
    if (errPharmacies) {
      setErreur("Impossible de charger les pharmacies : " + errPharmacies.message);
    } else {
      // Seules les pharmacies validées et non suspendues peuvent avoir une garde.
      const utilisables = ((dataPharmacies ?? []) as PharmacieAdmin[]).filter(
        (p) => p.validee && !p.suspendue
      );
      setPharmacies(utilisables);
      setPharmacieId((actuel) => actuel || utilisables[0]?.id || "");
    }

    // Gardes en cours ou à venir.
    const { data: dataGardes, error: errGardes } = await supabase
      .from("gardes")
      .select("id, debut, fin, confirmee, pharmacies(nom)")
      .gte("fin", new Date().toISOString())
      .order("debut", { ascending: true });
    if (errGardes) {
      setErreur("Impossible de charger les gardes : " + errGardes.message);
    } else {
      setGardes(
        ((dataGardes ?? []) as unknown as LigneGarde[]).map((g) => ({
          id: g.id,
          debut: g.debut,
          fin: g.fin,
          confirmee: g.confirmee,
          nom_pharmacie: nomPharmacie(g.pharmacies),
        }))
      );
    }
    setChargement(false);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  function proposerCetteNuit() {
    const p = propositionNuit();
    setDebut(p.debut);
    setFin(p.fin);
  }

  async function ajouter(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);
    setSucces(null);

    if (!pharmacieId) {
      setErreur("Choisissez une pharmacie validée.");
      return;
    }
    if (!debut || !fin) {
      setErreur("Indiquez le début et la fin de la garde.");
      return;
    }
    const debutIso = champVersInstantAbidjan(debut);
    const finIso = champVersInstantAbidjan(fin);
    if (new Date(finIso).getTime() <= new Date(debutIso).getTime()) {
      setErreur("La fin de la garde doit être après son début.");
      return;
    }

    setEnCours(true);
    try {
      const supabase = creerClientNavigateur();
      const { error } = await supabase
        .from("gardes")
        .insert({ pharmacie_id: pharmacieId, debut: debutIso, fin: finIso });
      if (error) {
        setErreur("Ajout impossible : " + error.message);
        return;
      }
      setSucces("Garde ajoutée.");
      setDebut("");
      setFin("");
      await charger();
    } finally {
      setEnCours(false);
    }
  }

  async function supprimer(garde: GardeAdmin) {
    if (
      !window.confirm(
        `Supprimer la garde de ${garde.nom_pharmacie} du ${formaterDateHeureAbidjan(garde.debut)} ?`
      )
    ) {
      return;
    }
    setErreur(null);
    setSucces(null);
    const supabase = creerClientNavigateur();
    const { error } = await supabase.from("gardes").delete().eq("id", garde.id);
    if (error) {
      setErreur("Suppression impossible : " + error.message);
      return;
    }
    await charger();
  }

  return (
    <div className="flex flex-col gap-6">
      {erreur && (
        <p className="rounded-xl bg-rouge-clair p-3 text-sm font-semibold leading-snug text-[#8e1b12]" role="alert">
          {erreur}
        </p>
      )}
      {succes && (
        <p className="rounded-xl bg-vert-clair p-3 text-sm font-semibold text-vert-fonce" role="status">
          {succes}
        </p>
      )}

      <form
        onSubmit={ajouter}
        className="flex flex-col gap-4 rounded-2xl border-[1.5px] border-trait bg-white p-4"
      >
        <h2 className="text-lg font-extrabold">Nouvelle garde</h2>

        {pharmacies.length === 0 && !chargement ? (
          <p className="text-sm leading-snug text-discret">
            Aucune pharmacie validée. Validez d&apos;abord une pharmacie dans
            l&apos;onglet Pharmacies.
          </p>
        ) : (
          <>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Pharmacie
              <select
                value={pharmacieId}
                onChange={(e) => setPharmacieId(e.target.value)}
                className={CLASSE_CHAMP}
              >
                {pharmacies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                  </option>
                ))}
              </select>
            </label>

            <p className="text-[12.5px] leading-snug text-discret">
              Les heures sont celles d&apos;Abidjan, quel que soit le fuseau de
              votre ordinateur.
            </p>

            <button
              type="button"
              onClick={proposerCetteNuit}
              className="min-h-11 rounded-xl border-[1.5px] border-vert bg-vert-clair px-4 text-sm font-bold text-vert-fonce"
            >
              Cette nuit : de 19 h à 7 h
            </button>

            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Début de la garde
              <input
                type="datetime-local"
                required
                value={debut}
                onChange={(e) => setDebut(e.target.value)}
                className={CLASSE_CHAMP}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Fin de la garde
              <input
                type="datetime-local"
                required
                value={fin}
                onChange={(e) => setFin(e.target.value)}
                className={CLASSE_CHAMP}
              />
            </label>

            <button
              type="submit"
              disabled={enCours}
              className="min-h-14 rounded-2xl bg-vert text-lg font-extrabold text-white disabled:opacity-60"
            >
              {enCours ? "Ajout…" : "Ajouter la garde"}
            </button>
          </>
        )}
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold">
          Gardes en cours et à venir ({gardes.length})
        </h2>
        {chargement && <p className="text-base text-discret">Chargement…</p>}
        {!chargement && gardes.length === 0 && (
          <p className="text-base text-discret">Aucune garde enregistrée.</p>
        )}
        <ul className="flex flex-col gap-3">
          {gardes.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between gap-3 rounded-2xl border-[1.5px] border-trait bg-white p-4"
            >
              <div>
                <p className="text-base font-extrabold leading-tight">
                  {g.nom_pharmacie}
                </p>
                <p className="mt-1 text-[13px] text-discret">
                  {formaterDateHeureAbidjan(g.debut)} →{" "}
                  {formaterDateHeureAbidjan(g.fin)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => supprimer(g)}
                className="min-h-11 shrink-0 rounded-xl border-[1.5px] border-rouge bg-white px-3.5 text-sm font-bold text-rouge"
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function PageGardes() {
  return (
    <CadreAdmin titre="Gardes">
      <ContenuGardes />
    </CadreAdmin>
  );
}
