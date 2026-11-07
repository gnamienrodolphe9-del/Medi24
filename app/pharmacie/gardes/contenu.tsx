"use client";

import AssistantAlertes from "@/components/AssistantAlertes";
import { useCallback, useEffect, useRef, useState } from "react";
import CadrePharmacie, { useJetonGestion } from "@/components/pharmacie/CadrePharmacie";
import DemandesEnCours, { type DemandePharmacie } from "@/components/pharmacie/DemandesEnCours";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, Carte, Chargement, MessageErreur, Pastille } from "@/components/ui";
import { appeler, envoyerJson } from "@/lib/client/api";
import { signalerNouvelleDemande } from "@/lib/client/signal";
import { formaterDateHeureAbidjan } from "@/lib/garde";

type Garde = { id: string; debut: string; fin: string; confirmee: boolean; confirmee_le: string | null };
type Donnees = {
  pharmacie: string;
  gardes: Garde[];
  demandes: DemandePharmacie[];
  serviceJour: { actif: boolean; debut: string; fin: string };
};

export default function ContenuGardesPharmacie() {
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

  // La page écoute les demandes : relecture toutes les 5 secondes (en pause si l'écran est caché).
  useEffect(() => {
    charger();
    const i = setInterval(() => {
      if (!document.hidden) void charger();
    }, 5000);
    const reveil = () => {
      if (!document.hidden) void charger();
    };
    document.addEventListener("visibilitychange", reveil);
    return () => {
      clearInterval(i);
      document.removeEventListener("visibilitychange", reveil);
    };
  }, [charger]);

  // Une nouvelle demande déclenche le bip, la vibration et un compteur dans le titre de l'onglet.
  const dejaVues = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!donnees) return;
    const nouvelles = donnees.demandes.filter((d) => d.statut === "nouvelle");
    document.title = nouvelles.length > 0 ? `(${nouvelles.length}) Medi24 · Nouvelle demande` : "Medi24 · Pharmacie";
    if (dejaVues.current === null) {
      // Premier chargement : on ne sonne pas pour les demandes déjà là.
      dejaVues.current = new Set(nouvelles.map((d) => d.jeton));
      return;
    }
    const inconnues = nouvelles.filter((d) => !dejaVues.current!.has(d.jeton));
    if (inconnues.length > 0) {
      signalerNouvelleDemande();
      inconnues.forEach((d) => dejaVues.current!.add(d.jeton));
    }
  }, [donnees]);

  async function confirmer(id: string) {
    setOccupe(id);
    setErreur(null);
    const r = await envoyerJson(`/api/pharmacie/gestion?j=${jeton}`, { action: "confirmer_garde", id });
    setOccupe(null);
    if (!r.ok) setErreur(r.erreur);
    else await charger();
  }

  async function basculerServiceJour(actif: boolean) {
    setOccupe("jour");
    setErreur(null);
    const r = await envoyerJson(`/api/pharmacie/gestion?j=${jeton}`, { action: "service_jour", actif });
    setOccupe(null);
    if (!r.ok) setErreur(r.erreur);
    else await charger();
  }

  const maintenant = Date.now();

  return (
    <CadrePharmacie titre="Mon espace" jeton={jeton} nomPharmacie={donnees?.pharmacie} actif="gardes">
      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      {jeton && <AssistantAlertes genre="gestion" jeton={jeton} role="pharmacie" />}
      {!donnees && !erreur && <Chargement />}
      {donnees && <DemandesEnCours demandes={donnees.demandes} />}
      {donnees && (
        <Carte titre="Demandes en journée">
          <p className="text-[15px] leading-snug">
            {donnees.serviceJour.actif
              ? `Vous recevez aussi les demandes en journée, de ${donnees.serviceJour.debut} à ${donnees.serviceJour.fin} (heure d'Abidjan), même sans garde.`
              : "En pause : vous ne recevez pas les demandes en journée (vos gardes de nuit restent actives)."}
          </p>
          <button
            type="button"
            disabled={occupe === "jour"}
            onClick={() => basculerServiceJour(!donnees.serviceJour.actif)}
            className={donnees.serviceJour.actif ? BOUTON_SECONDAIRE : BOUTON_PRINCIPAL}
          >
            {occupe === "jour" ? "Un instant…" : donnees.serviceJour.actif ? "Mettre en pause la journée" : "Reprendre la journée"}
          </button>
        </Carte>
      )}
      {donnees && <h2 className="text-lg font-extrabold">Mes gardes</h2>}
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
