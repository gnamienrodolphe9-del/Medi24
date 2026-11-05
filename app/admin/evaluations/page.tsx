"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import CadreAdmin from "@/components/admin/CadreAdmin";
import { CLASSE_CHAMP } from "@/components/admin/Champ";
import { MessageErreur, Pastille } from "@/components/ui";
import { afficherTelephone, depuisJours, lireParametre, telechargerCsv, TYPES_LIBELLES, un } from "@/lib/admin/outils";
import { formaterDateHeureAbidjan } from "@/lib/garde";
import { creerClientNavigateur } from "@/lib/supabase/client";

type Pharma = { nom: string } | { nom: string }[] | null;
type Demande = { telephone_patient: string; type: string; pharmacies: Pharma };
type Ligne = { id: string; note: number; commentaire: string | null; cree_le: string; demande_id: string; demandes: Demande | Demande[] | null };

function Contenu() {
  const [jours, setJours] = useState(30);
  const [noteMax, setNoteMax] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const j = lireParametre("jours");
    if (j !== null && /^\d+$/.test(j)) setJours(Number(j));
  }, []);

  const charger = useCallback(async () => {
    let requete = creerClientNavigateur()
      .from("evaluations")
      .select("id, note, commentaire, cree_le, demande_id, demandes(telephone_patient, type, pharmacies!pharmacie_retenue_id(nom))")
      .order("cree_le", { ascending: false })
      .limit(500);
    const depuis = depuisJours(jours);
    if (depuis) requete = requete.gte("cree_le", depuis);
    if (noteMax) requete = requete.lte("note", Number(noteMax));
    const { data, error } = await requete;
    if (error) setErreur("Lecture impossible : " + error.message);
    else {
      setErreur(null);
      setLignes((data ?? []) as unknown as Ligne[]);
    }
  }, [jours, noteMax]);

  useEffect(() => {
    charger();
  }, [charger]);

  const moyenne = lignes.length ? lignes.reduce((s, l) => s + l.note, 0) / lignes.length : null;

  return (
    <div className="flex flex-col gap-4">
      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      <div className="flex gap-2" role="group" aria-label="Période">
        {[[7, "7 jours"], [30, "30 jours"], [0, "Tout"]].map(([j, l]) => (
          <button key={j} type="button" aria-pressed={jours === j} onClick={() => setJours(j as number)}
            className={`min-h-11 flex-1 rounded-xl border-[1.5px] text-sm font-bold ${jours === j ? "border-vert bg-vert text-white" : "border-trait bg-white"}`}>{l}</button>
        ))}
      </div>
      <select value={noteMax} onChange={(e) => setNoteMax(e.target.value)} className={CLASSE_CHAMP} aria-label="Filtrer par note">
        <option value="">Toutes les notes</option>
        <option value="2">Notes de 1 à 2 (mécontents)</option>
        <option value="3">Notes de 1 à 3</option>
      </select>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{lignes.length} avis{moyenne !== null ? ` · moyenne ${moyenne.toFixed(2)} / 5` : ""}</p>
        <button type="button" disabled={lignes.length === 0} onClick={() => telechargerCsv("medi24-avis.csv", [
          ["Date (Abidjan)", "Type", "Pharmacie", "Note", "Commentaire"],
          ...lignes.map((l) => [formaterDateHeureAbidjan(l.cree_le), TYPES_LIBELLES[un(l.demandes)?.type ?? ""] ?? "", un(un(l.demandes)?.pharmacies)?.nom ?? "", l.note, l.commentaire ?? ""]),
        ])} className="min-h-11 rounded-xl border-[1.5px] border-vert bg-white px-3.5 text-sm font-bold text-vert disabled:opacity-50">Exporter en CSV</button>
      </div>
      <ul className="flex flex-col gap-2">
        {lignes.map((l) => {
          const d = un(l.demandes);
          return (
            <li key={l.id}>
              <Link href={`/admin/demandes/${l.demande_id}`} className="flex flex-col gap-1 rounded-2xl border-[1.5px] border-trait bg-white p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[15px] font-extrabold">{formaterDateHeureAbidjan(l.cree_le)}</p>
                  <Pastille ton={l.note >= 4 ? "vert" : l.note === 3 ? "ambre" : "rouge"}>{l.note} / 5</Pastille>
                </div>
                <p className="text-[13px] text-discret">
                  {un(d?.pharmacies)?.nom ?? "Pharmacie inconnue"} · {TYPES_LIBELLES[d?.type ?? ""] ?? "—"} · patient {afficherTelephone(d?.telephone_patient)}
                </p>
                {l.commentaire && <p className="whitespace-pre-line text-[14px]">« {l.commentaire} »</p>}
              </Link>
            </li>
          );
        })}
        {lignes.length === 0 && <li className="text-sm text-discret">Aucun avis avec ces filtres.</li>}
      </ul>
    </div>
  );
}

export default function PageEvaluations() {
  return (
    <CadreAdmin titre="Avis des patients">
      <Contenu />
    </CadreAdmin>
  );
}
