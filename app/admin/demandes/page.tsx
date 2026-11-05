"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import CadreAdmin from "@/components/admin/CadreAdmin";
import { CLASSE_CHAMP } from "@/components/admin/Champ";
import { MessageErreur, Pastille } from "@/components/ui";
import {
  afficherTelephone,
  depuisJours,
  ecartSecondes,
  ETATS_TOUS,
  formaterDuree,
  lireParametre,
  telechargerCsv,
  TYPES_LIBELLES,
  un,
} from "@/lib/admin/outils";
import { libelleEtat } from "@/lib/etats";
import { formaterDateHeureAbidjan } from "@/lib/garde";
import { creerClientNavigateur } from "@/lib/supabase/client";

type Ligne = {
  id: string;
  type: string;
  etat: string;
  cree_le: string;
  telephone_patient: string;
  repere: string | null;
  mode: string | null;
  retenue_le: string | null;
  pharmacie_retenue_id: string | null;
  sms_envoyes: number;
  repli_fait: boolean;
  pharmacies: { nom: string } | { nom: string }[] | null;
  alertes: { count: number }[] | { count: number } | null;
  evaluations: { note: number } | { note: number }[] | null;
};

// "retenue" : une pharmacie a répondu. "sans_reponse" : expirée ou liste d'appel sans pharmacie.
const FILTRES_SPECIAUX: [string, string][] = [
  ["retenue", "Avec une pharmacie"],
  ["sans_reponse", "Sans pharmacie (expirées, repli)"],
];

function Contenu() {
  const [jours, setJours] = useState(7);
  const [etat, setEtat] = useState("");
  const [type, setType] = useState("");
  const [recherche, setRecherche] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  // Les liens depuis les indicateurs arrivent avec des filtres dans l'adresse.
  useEffect(() => {
    const j = lireParametre("jours");
    if (j !== null && /^\d+$/.test(j)) setJours(Number(j));
    setEtat(lireParametre("etat") ?? "");
    setType(lireParametre("type") ?? "");
  }, []);

  const charger = useCallback(async () => {
    setChargement(true);
    let requete = creerClientNavigateur()
      .from("demandes")
      .select(
        "id, type, etat, cree_le, telephone_patient, repere, mode, retenue_le, pharmacie_retenue_id, sms_envoyes, repli_fait, pharmacies!pharmacie_retenue_id(nom), alertes(count), evaluations(note)"
      )
      .order("cree_le", { ascending: false })
      .limit(500);
    const depuis = depuisJours(jours);
    if (depuis) requete = requete.gte("cree_le", depuis);
    if (type) requete = requete.eq("type", type);
    if (etat === "retenue") requete = requete.not("pharmacie_retenue_id", "is", null);
    else if (etat === "sans_reponse") requete = requete.is("pharmacie_retenue_id", null).in("etat", ["expiree", "repli"]);
    else if (etat) requete = requete.eq("etat", etat);

    const { data, error } = await requete;
    if (error) setErreur("Lecture impossible : " + error.message);
    else {
      setErreur(null);
      setLignes((data ?? []) as unknown as Ligne[]);
    }
    setChargement(false);
  }, [jours, etat, type]);

  useEffect(() => {
    charger();
  }, [charger]);

  const nbAlertes = (l: Ligne) => (Array.isArray(l.alertes) ? l.alertes[0]?.count : l.alertes?.count) ?? 0;
  const visibles = lignes.filter((l) => {
    if (!recherche.trim()) return true;
    const q = recherche.trim().toLowerCase().replace(/\s/g, "");
    return (
      l.telephone_patient.replace(/\s/g, "").includes(q) ||
      (l.repere ?? "").toLowerCase().includes(recherche.trim().toLowerCase())
    );
  });

  // Export sans numéro de téléphone : utilisable comme preuve (pharmacies, Ordre) sans exposer les patients.
  function exporter() {
    telechargerCsv("medi24-demandes.csv", [
      ["Date (Abidjan)", "Type", "État", "Mode", "Pharmacie retenue", "Délai de réponse (s)", "Pharmacies alertées", "SMS envoyés", "Note"],
      ...visibles.map((l) => [
        formaterDateHeureAbidjan(l.cree_le),
        TYPES_LIBELLES[l.type] ?? l.type,
        libelleEtat(l.etat as never),
        l.mode ?? "",
        un(l.pharmacies)?.nom ?? "",
        ecartSecondes(l.cree_le, l.retenue_le) ?? "",
        nbAlertes(l),
        l.sms_envoyes,
        un(l.evaluations)?.note ?? "",
      ]),
    ]);
  }

  return (
    <div className="flex flex-col gap-4">
      {erreur && <MessageErreur>{erreur}</MessageErreur>}

      <div className="flex gap-2" role="group" aria-label="Période">
        {[[1, "24 h"], [7, "7 jours"], [30, "30 jours"], [0, "Tout"]].map(([j, libelle]) => (
          <button key={j} type="button" aria-pressed={jours === j} onClick={() => setJours(j as number)}
            className={`min-h-11 flex-1 rounded-xl border-[1.5px] text-sm font-bold ${jours === j ? "border-vert bg-vert text-white" : "border-trait bg-white"}`}>
            {libelle}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select value={etat} onChange={(e) => setEtat(e.target.value)} className={CLASSE_CHAMP} aria-label="Filtrer par état">
          <option value="">Tous les états</option>
          {FILTRES_SPECIAUX.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          {ETATS_TOUS.map((e) => <option key={e} value={e}>{libelleEtat(e)}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className={CLASSE_CHAMP} aria-label="Filtrer par type">
          <option value="">Tous les types</option>
          {Object.entries(TYPES_LIBELLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un numéro ou un repère" className={CLASSE_CHAMP} aria-label="Rechercher" />

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{visibles.length} demande(s){lignes.length === 500 ? " (500 max affichées)" : ""}</p>
        <button type="button" onClick={exporter} disabled={visibles.length === 0} className="min-h-11 rounded-xl border-[1.5px] border-vert bg-white px-3.5 text-sm font-bold text-vert disabled:opacity-50">
          Exporter en CSV
        </button>
      </div>
      <p className="-mt-2 text-[12.5px] leading-snug text-discret">L&apos;export ne contient aucun numéro de patient : il peut servir de preuve sans exposer personne.</p>

      {chargement && <p className="text-base text-discret">Chargement…</p>}
      <ul className="flex flex-col gap-2">
        {visibles.map((l) => {
          const delai = ecartSecondes(l.cree_le, l.retenue_le);
          const note = un(l.evaluations)?.note;
          return (
            <li key={l.id}>
              <Link href={`/admin/demandes/${l.id}`} className="flex flex-col gap-1.5 rounded-2xl border-[1.5px] border-trait bg-white p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[15px] font-extrabold leading-tight">{formaterDateHeureAbidjan(l.cree_le)} · {TYPES_LIBELLES[l.type] ?? l.type}</p>
                  <Pastille ton={["expiree", "repli"].includes(l.etat) ? "rouge" : l.etat === "remise" ? "vert" : l.etat === "annulee" ? "gris" : "ambre"}>
                    {libelleEtat(l.etat as never)}
                  </Pastille>
                </div>
                <p className="text-[13px] text-discret">
                  Patient {afficherTelephone(l.telephone_patient)}{l.repere ? ` · ${l.repere}` : ""}
                </p>
                <p className="text-[13px]">
                  {un(l.pharmacies)?.nom ? <>Pharmacie : <strong>{un(l.pharmacies)?.nom}</strong> · </> : "Aucune pharmacie · "}
                  réponse en {formaterDuree(delai)} · {nbAlertes(l)} alertées · {l.sms_envoyes} SMS{note ? ` · note ${note}/5` : ""}
                </p>
              </Link>
            </li>
          );
        })}
        {!chargement && visibles.length === 0 && <li className="text-sm text-discret">Aucune demande avec ces filtres.</li>}
      </ul>
    </div>
  );
}

export default function PageDemandes() {
  return (
    <CadreAdmin titre="Demandes">
      <Contenu />
    </CadreAdmin>
  );
}
