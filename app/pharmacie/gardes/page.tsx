"use client";

import { useCallback, useEffect, useState } from "react";
import CadrePharmacie, { useJetonGestion } from "@/components/pharmacie/CadrePharmacie";
import { BOUTON_PRINCIPAL, Carte, Chargement, MessageErreur, Pastille } from "@/components/ui";
import { appeler, envoyerJson } from "@/lib/client/api";
import { formaterDateHeureAbidjan } from "@/lib/garde";

type Garde = { id: string; debut: string; fin: string; confirmee: boolean; confirmee_le: string | null };
type Donnees = { pharmacie: string; gardes: Garde[] };

export default function PageGardesPharmacie() {
  const jeton = useJetonGestion();
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!jeton) return;
    const r = await appeler<Donnees>(`/api/pharmacie/gestion?j=${jeton}`);
    if (r.ok) setDonnees(r.donnees);
    else setErreur(r.erreur);
  }, [jeton]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function confirmer(id: string) {
    setOccupe(id);
    setErreur(null);
    const r = await envoyerJson(`/api/pharmacie/gestion?j=${jeton}`, { action: "confirmer_garde", id });
    setOccupe(null);
    if (!r.ok) setErreur(r.erreur);
    else await charger();
  }

  const maintenant = Date.now();

  return (
    <CadrePharmacie titre="Mes gardes" jeton={jeton} nomPharmacie={donnees?.pharmacie} actif="gardes">
      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      {!donnees && !erreur && <Chargement />}
      {donnees && donnees.gardes.length === 0 && (
        <p className="text-base text-discret">Aucune garde enregistrée. Medi24 saisit votre planning de garde.</p>
      )}
      <ul className="flex flex-col gap-3">
        {donnees?.gardes.map((g) => {
          const enCours = new Date(g.debut).getTime() <= maintenant && new Date(g.fin).getTime() >= maintenant;
          const passee = new Date(g.fin).getTime() < maintenant;
          return (
            <li key={g.id}>
              <Carte>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-extrabold leading-tight">{formaterDateHeureAbidjan(g.debut)}</p>
                    <p className="text-[13px] text-discret">jusqu&apos;à {formaterDateHeureAbidjan(g.fin)}</p>
                  </div>
                  {passee ? <Pastille ton="gris">Terminée</Pastille> : enCours ? <Pastille ton="vert">En cours</Pastille> : <Pastille ton="ambre">À venir</Pastille>}
                </div>
                {g.confirmee ? (
                  <Pastille ton="vert">Garde confirmée ✓</Pastille>
                ) : !passee ? (
                  <button type="button" disabled={occupe === g.id} onClick={() => confirmer(g.id)} className={BOUTON_PRINCIPAL}>
                    {occupe === g.id ? "Envoi…" : "Je confirme cette garde"}
                  </button>
                ) : null}
              </Carte>
            </li>
          );
        })}
      </ul>
      <p className="text-[13px] leading-snug text-discret">
        Les heures sont celles d&apos;Abidjan. Confirmer votre garde nous permet de vous alerter en priorité.
      </p>
    </CadrePharmacie>
  );
}
