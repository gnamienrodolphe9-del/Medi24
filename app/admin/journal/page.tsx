"use client";

import { useCallback, useEffect, useState } from "react";
import CadreAdmin from "@/components/admin/CadreAdmin";
import { CLASSE_CHAMP } from "@/components/admin/Champ";
import { MessageErreur } from "@/components/ui";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { formaterDateHeureAbidjan } from "@/lib/garde";

type Ligne = { id: number; demande_id: string | null; evenement: string; detail: unknown; cree_le: string };

function Contenu() {
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [filtre, setFiltre] = useState("");
  const [seulementProblemes, setSeulementProblemes] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const { data, error } = await creerClientNavigateur()
      .from("journal_alertes")
      .select("id, demande_id, evenement, detail, cree_le")
      .order("id", { ascending: false })
      .limit(300);
    if (error) setErreur("Lecture impossible : " + error.message);
    else {
      setErreur(null);
      setLignes((data ?? []) as Ligne[]);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const visibles = lignes.filter((l) => {
    if (seulementProblemes && !/echec|erreur|supervision|repli|expiree/.test(l.evenement)) return false;
    return !filtre || l.evenement.toLowerCase().includes(filtre.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-4">
      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      <div className="flex flex-col gap-2">
        <input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Filtrer (sms, vague, repli…)" className={CLASSE_CHAMP} aria-label="Filtrer le journal" />
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
          <input type="checkbox" checked={seulementProblemes} onChange={(e) => setSeulementProblemes(e.target.checked)} className="h-5 w-5 accent-[#0a6847]" />
          Seulement les problèmes (échecs, erreurs, repli, expirées)
        </label>
        <button type="button" onClick={charger} className="min-h-11 self-start rounded-xl border-[1.5px] border-vert bg-white px-4 text-sm font-bold text-vert">
          Actualiser
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {visibles.map((l) => (
          <li key={l.id} className="rounded-xl border-[1.5px] border-trait bg-white p-3 text-[13px]">
            <p className="font-bold">{l.evenement} <span className="font-normal text-discret">· {formaterDateHeureAbidjan(l.cree_le)}</span></p>
            {l.demande_id && <p className="text-discret">Demande {l.demande_id.slice(0, 8)}</p>}
            {l.detail !== null && l.detail !== undefined && (
              <p className="mt-1 break-all font-mono text-[12px]">{JSON.stringify(l.detail)}</p>
            )}
          </li>
        ))}
        {visibles.length === 0 && <li className="text-sm text-discret">Rien à afficher.</li>}
      </ul>
    </div>
  );
}

export default function PageJournal() {
  return (
    <CadreAdmin titre="Journal">
      <Contenu />
    </CadreAdmin>
  );
}
