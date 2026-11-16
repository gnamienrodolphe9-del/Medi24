"use client";

import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, Carte } from "@/components/ui";
import { formaterTelephone } from "@/lib/client/compte";
import { formaterDateHeureAbidjan } from "@/lib/garde";
import { formaterFcfa } from "@/lib/totaux";

// Mêmes champs que lib/serveur/resume_remise.ts (copiés ici : ce fichier s'exécute dans le navigateur).
export type ResumeRemiseVue = {
  commandeLe: string;
  mode: "retrait" | "livraison" | null;
  pharmacie: string | null;
  patient: { prenom: string | null; telephone: string; repere: string | null };
  articles: { produit: string; quantite: number; prix: number | null; remplace: string | null }[] | null;
  nombreArticles: number;
  total: number | null;
  prixManquant: boolean;
  surOrdonnance: boolean;
};

// Écran de contrôle affiché après le code du patient, AVANT d'enregistrer la remise :
// la personne vérifie que la commande correspond bien à celui qui se présente.
export default function ResumeRemise({
  resume,
  occupe,
  libelleConfirmer,
  surConfirmer,
  surAnnuler,
}: {
  resume: ResumeRemiseVue;
  occupe: boolean;
  libelleConfirmer: string;
  surConfirmer: () => void;
  surAnnuler: () => void;
}) {
  return (
    <Carte titre="Vérifiez la commande avant de remettre">
      <p className="rounded-xl bg-vert-clair p-3 text-[14px] font-semibold leading-snug text-vert-fonce">
        Le code est bon. Contrôlez que ces informations correspondent à la personne en face de vous.
      </p>

      <section className="flex flex-col gap-0.5 text-[15px] leading-snug">
        <h3 className="text-sm font-extrabold">Le patient</h3>
        {resume.patient.prenom && (
          <p>
            Prénom : <strong>{resume.patient.prenom}</strong>
          </p>
        )}
        <p>
          Téléphone : <strong>{formaterTelephone(resume.patient.telephone)}</strong>
        </p>
        {resume.patient.repere && <p>Se trouve près de : {resume.patient.repere}</p>}
        <p className="text-discret">Commande du {formaterDateHeureAbidjan(resume.commandeLe)}</p>
        {resume.pharmacie && <p className="text-discret">Pharmacie : {resume.pharmacie}</p>}
      </section>

      <section className="flex flex-col gap-1 text-[15px] leading-snug">
        <h3 className="text-sm font-extrabold">
          La commande · {resume.nombreArticles} article{resume.nombreArticles > 1 ? "s" : ""}
        </h3>
        {resume.articles === null ? (
          <p className="text-discret">Le détail des produits n&apos;est pas affiché pour le livreur.</p>
        ) : resume.articles.length === 0 ? (
          <p className="text-discret">
            {resume.surOrdonnance ? "Commande établie d'après l'ordonnance du patient." : "Aucun article détaillé."}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {resume.articles.map((a, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>
                  {a.produit}
                  {a.quantite > 1 ? ` x${a.quantite}` : ""}
                  {a.remplace && <span className="text-discret"> (remplace {a.remplace}, accepté par le patient)</span>}
                </span>
                <span className="whitespace-nowrap font-semibold">{a.prix === null ? "—" : formaterFcfa(a.prix)}</span>
              </li>
            ))}
          </ul>
        )}
        {resume.total !== null && (
          <p className="mt-1 text-base font-extrabold">
            Total à payer : {formaterFcfa(resume.total)}
            {resume.prixManquant ? " (un prix manque)" : ""}
          </p>
        )}
        <p className="text-[13px] text-discret">
          {resume.mode === "livraison" ? "Livraison à domicile" : "Retrait à la pharmacie"}
        </p>
      </section>

      <button type="button" disabled={occupe} onClick={surConfirmer} className={BOUTON_PRINCIPAL}>
        {occupe ? "Un instant…" : libelleConfirmer}
      </button>
      <button type="button" disabled={occupe} onClick={surAnnuler} className={BOUTON_SECONDAIRE}>
        Ce n&apos;est pas la bonne personne
      </button>
    </Carte>
  );
}
