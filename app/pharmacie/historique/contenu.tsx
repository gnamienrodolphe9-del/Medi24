"use client";

import { useEffect, useState } from "react";
import CadrePharmacie, { useJetonGestion } from "@/components/pharmacie/CadrePharmacie";
import { Carte, Chargement, MessageErreur, Pastille } from "@/components/ui";
import { appeler } from "@/lib/client/api";
import { formaterDateHeureAbidjan } from "@/lib/garde";

type Ligne = { id: string; le: string; resultat: string | null; type: string | null; etat: string | null };
type Donnees = { pharmacie: string; historique: Ligne[] };

const TYPES: Record<string, string> = { medicament: "Médicament", ordonnance: "Ordonnance", symptomes: "Symptômes" };

export default function ContenuHistoriquePharmacie() {
  const jeton = useJetonGestion();
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!jeton) return;
    appeler<Donnees>(`/api/pharmacie/gestion?j=${jeton}`).then((r) => {
      if (r.ok) setDonnees(r.donnees);
      else setErreur(r.erreur);
    });
  }, [jeton]);

  const total = donnees?.historique.length ?? 0;
  const reponses = donnees?.historique.filter((l) => l.resultat).length ?? 0;
  const remises = donnees?.historique.filter((l) => l.etat === "remise").length ?? 0;

  return (
    <CadrePharmacie titre="Historique" jeton={jeton} nomPharmacie={donnees?.pharmacie} actif="historique">
      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      {!donnees && !erreur && <Chargement />}
      {donnees && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Carte><p className="text-2xl font-extrabold">{total}</p><p className="text-[12px] text-discret">alertes</p></Carte>
            <Carte><p className="text-2xl font-extrabold">{reponses}</p><p className="text-[12px] text-discret">réponses</p></Carte>
            <Carte><p className="text-2xl font-extrabold">{remises}</p><p className="text-[12px] text-discret">remises</p></Carte>
          </div>
          {total === 0 && <p className="text-base text-discret">Aucune alerte pour le moment.</p>}
          <ul className="flex flex-col gap-2">
            {donnees.historique.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 rounded-xl border-[1.5px] border-trait bg-white p-3">
                <div>
                  <p className="text-[15px] font-bold leading-tight">{l.type ? TYPES[l.type] ?? l.type : "Demande"}</p>
                  <p className="text-[12.5px] text-discret">{formaterDateHeureAbidjan(l.le)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {l.resultat ? <Pastille ton={l.resultat === "indisponible" ? "rouge" : "vert"}>{l.resultat}</Pastille> : <Pastille ton="gris">Sans réponse</Pastille>}
                  {l.etat === "remise" && <Pastille ton="vert">Remise</Pastille>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </CadrePharmacie>
  );
}
