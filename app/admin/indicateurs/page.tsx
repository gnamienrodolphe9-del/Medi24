"use client";

import { useCallback, useEffect, useState } from "react";
import CadreAdmin from "@/components/admin/CadreAdmin";
import { Carte, MessageErreur, Pastille } from "@/components/ui";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { formaterDateHeureAbidjan } from "@/lib/garde";

type Indicateurs = {
  jours: number;
  total: number;
  par_etat: Record<string, number>;
  avec_reponse_positive: number;
  remises: number;
  delai_median_secondes: number | null;
  sms_envoyes: number;
  note_moyenne: number | null;
  nb_evaluations: number;
  pharmacies: { nom: string; alertes: number; reponses: number; positives: number }[];
};

type DemandeEnCours = { id: string; type: string; etat: string; cree_le: string; sms_envoyes: number; repli_fait: boolean };
type GardeSoir = { id: string; debut: string; fin: string; confirmee: boolean; pharmacies: { nom: string } | { nom: string }[] | null };

function pourcentage(a: number, b: number): string {
  return b === 0 ? "—" : `${Math.round((a / b) * 100)} %`;
}

function dureeCourte(secondes: number | null): string {
  if (secondes === null) return "—";
  if (secondes < 90) return `${Math.round(secondes)} s`;
  return `${Math.round(secondes / 60)} min`;
}

function Tuile({ valeur, libelle, aide }: { valeur: string; libelle: string; aide?: string }) {
  return (
    <div className="flex flex-col rounded-2xl border-[1.5px] border-trait bg-white p-3">
      <span className="text-[26px] font-extrabold leading-none">{valeur}</span>
      <span className="mt-1.5 text-[13px] font-semibold leading-tight">{libelle}</span>
      {aide && <span className="mt-0.5 text-[12px] leading-tight text-discret">{aide}</span>}
    </div>
  );
}

function Contenu() {
  const [jours, setJours] = useState(7);
  const [ind, setInd] = useState<Indicateurs | null>(null);
  const [enCours, setEnCours] = useState<DemandeEnCours[]>([]);
  const [gardes, setGardes] = useState<GardeSoir[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const db = creerClientNavigateur();
    const { data, error } = await db.rpc("admin_indicateurs", { p_jours: jours });
    if (error) setErreur("Indicateurs indisponibles : " + error.message);
    else {
      setErreur(null);
      setInd(data as Indicateurs);
    }

    const hier = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: d } = await db
      .from("demandes")
      .select("id, type, etat, cree_le, sms_envoyes, repli_fait")
      .in("etat", ["creee", "envoyee", "vue", "confirmee", "prete", "en_livraison", "repli"])
      .gte("cree_le", hier)
      .order("cree_le", { ascending: false });
    setEnCours((d ?? []) as DemandeEnCours[]);

    const maintenant = new Date().toISOString();
    const dans24h = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const { data: g } = await db
      .from("gardes")
      .select("id, debut, fin, confirmee, pharmacies(nom)")
      .gte("fin", maintenant)
      .lte("debut", dans24h)
      .order("debut");
    setGardes((g ?? []) as unknown as GardeSoir[]);
  }, [jours]);

  useEffect(() => {
    charger();
    const i = setInterval(charger, 30000);
    return () => clearInterval(i);
  }, [charger]);

  const nom = (g: GardeSoir) => (Array.isArray(g.pharmacies) ? g.pharmacies[0]?.nom : g.pharmacies?.nom) ?? "—";
  const nonConfirmees = gardes.filter((g) => !g.confirmee).length;

  return (
    <div className="flex flex-col gap-5">
      {erreur && <MessageErreur>{erreur}</MessageErreur>}

      <div className="flex gap-2" role="group" aria-label="Période">
        {[1, 7, 30].map((j) => (
          <button key={j} type="button" aria-pressed={jours === j} onClick={() => setJours(j)}
            className={`min-h-11 flex-1 rounded-xl border-[1.5px] text-sm font-bold ${jours === j ? "border-vert bg-vert text-white" : "border-trait bg-white"}`}>
            {j === 1 ? "24 h" : `${j} jours`}
          </button>
        ))}
      </div>

      {ind && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Tuile valeur={String(ind.total)} libelle="Demandes" />
            <Tuile valeur={pourcentage(ind.avec_reponse_positive, ind.total)} libelle="Avec une pharmacie" aide="Objectif pilote : plus de 80 %" />
            <Tuile valeur={dureeCourte(ind.delai_median_secondes)} libelle="Délai médian de réponse" />
            <Tuile valeur={String(ind.remises)} libelle="Remises" />
            <Tuile valeur={String(ind.sms_envoyes)} libelle="SMS d'alerte" aide="Coût à suivre" />
            <Tuile valeur={ind.note_moyenne !== null ? `${ind.note_moyenne} / 5` : "—"} libelle="Note moyenne" aide={`${ind.nb_evaluations} avis`} />
          </div>

          <Carte titre="Demandes par état">
            <ul className="flex flex-wrap gap-2">
              {Object.entries(ind.par_etat).map(([etat, n]) => (
                <li key={etat}><Pastille ton={etat === "expiree" || etat === "repli" ? "rouge" : etat === "remise" ? "vert" : "gris"}>{etat} : {n}</Pastille></li>
              ))}
              {Object.keys(ind.par_etat).length === 0 && <li className="text-sm text-discret">Aucune demande sur la période.</li>}
            </ul>
          </Carte>

          <Carte titre="Pharmacies">
            {ind.pharmacies.length === 0 ? (
              <p className="text-sm text-discret">Aucune alerte sur la période.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {ind.pharmacies.map((p) => (
                  <li key={p.nom} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-bold">{p.nom}</span>
                    <span className="text-discret">
                      {p.alertes} alertes · {pourcentage(p.reponses, p.alertes)} répondu · {p.positives} positives
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        </>
      )}

      <Carte titre={`Gardes des prochaines 24 h (${nonConfirmees} non confirmée(s))`}>
        {gardes.length === 0 ? (
          <p className="text-sm font-semibold text-rouge">Aucune garde enregistrée : personne ne sera alerté.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {gardes.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2">
                <span className="text-sm"><strong>{nom(g)}</strong><br />{formaterDateHeureAbidjan(g.debut)} → {formaterDateHeureAbidjan(g.fin)}</span>
                {g.confirmee ? <Pastille ton="vert">Confirmée</Pastille> : <Pastille ton="ambre">Non confirmée</Pastille>}
              </li>
            ))}
          </ul>
        )}
      </Carte>

      <Carte titre={`Demandes actives (24 h) : ${enCours.length}`}>
        {enCours.length === 0 ? (
          <p className="text-sm text-discret">Aucune demande active.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {enCours.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{formaterDateHeureAbidjan(d.cree_le)} · {d.type}</span>
                <span className="flex gap-1.5">
                  {d.repli_fait && <Pastille ton="rouge">repli</Pastille>}
                  <Pastille ton="gris">{d.etat}</Pastille>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </div>
  );
}

export default function PageIndicateurs() {
  return (
    <CadreAdmin titre="Indicateurs">
      <Contenu />
    </CadreAdmin>
  );
}
