"use client";

import { useCallback, useEffect, useState } from "react";
import CadreAdmin from "@/components/admin/CadreAdmin";
import { MessageAttention, MessageErreur } from "@/components/ui";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { formaterDateHeureAbidjan } from "@/lib/garde";

type Detail = {
  telephone?: string;
  telephone_fin?: string;
  message?: string;
  titre?: string;
  corps?: string;
  chemin?: string;
  appareils?: number;
  cible?: string;
  erreur?: string | null;
};
type Ligne = { id: number; demande_id: string | null; evenement: string; detail: Detail | null; cree_le: string };

const LIBELLES: Record<string, string> = {
  code: "Code de vérification",
  alerte: "Alerte pharmacie",
  alerte_secours: "Alerte (numéro de secours)",
  rappel: "Rappel pharmacie",
  garde_soir: "Confirmation de garde",
  livreur: "Lien livreur",
  livreur_prete: "Commande prête (livreur)",
  patient_reponse: "Réponse de pharmacie (patient)",
  patient_prete: "Commande prête (patient)",
  confirmation_patient: "Patient confirmé (pharmacie)",
  supervision: "Supervision",
};

function nomEvenement(evenement: string): { canal: "SMS" | "Notification"; libelle: string; echec: boolean } {
  const sms = evenement.startsWith("sms_");
  const echec = evenement.startsWith("sms_echec_") || evenement.startsWith("push_aucun_");
  const reste = evenement.replace(/^(sms_echec_|sms_|push_aucun_|push_)/, "");
  return { canal: sms ? "SMS" : "Notification", libelle: LIBELLES[reste] ?? reste, echec };
}

// Découpe un texte pour rendre ses adresses cliquables.
function TexteAvecLiens({ texte }: { texte: string }) {
  const morceaux = texte.split(/(https?:\/\/\S+)/g);
  return (
    <>
      {morceaux.map((m, i) =>
        /^https?:\/\//.test(m) ? (
          <a key={i} href={m} className="break-all font-semibold text-vert underline">
            {m}
          </a>
        ) : (
          <span key={i}>{m}</span>
        )
      )}
    </>
  );
}

function BoutonCopier({ texte }: { texte: string }) {
  const [copie, setCopie] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texte);
          setCopie(true);
          setTimeout(() => setCopie(false), 2000);
        } catch {
          window.prompt("Copiez ce lien :", texte);
        }
      }}
      className="min-h-11 rounded-xl border-[1.5px] border-vert bg-white px-3.5 text-sm font-bold text-vert"
    >
      {copie ? "Copié ✓" : "Copier le lien"}
    </button>
  );
}

function Contenu() {
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);
  const [canal, setCanal] = useState<"tous" | "SMS" | "Notification">("tous");

  const charger = useCallback(async () => {
    const { data, error } = await creerClientNavigateur()
      .from("journal_alertes")
      .select("id, demande_id, evenement, detail, cree_le")
      .or("evenement.like.sms_*,evenement.like.push_*")
      .order("id", { ascending: false })
      .limit(100);
    if (error) setErreur("Lecture impossible : " + error.message);
    else {
      setErreur(null);
      setLignes((data ?? []) as Ligne[]);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  useEffect(() => {
    if (!auto) return;
    const i = setInterval(charger, 5000);
    return () => clearInterval(i);
  }, [auto, charger]);

  const visibles = lignes.filter((l) => canal === "tous" || nomEvenement(l.evenement).canal === canal);
  const sansTexte = lignes.length > 0 && lignes.every((l) => !l.detail?.message && !l.detail?.chemin);
  const origine = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] leading-snug text-discret">
        Tout ce que Medi24 a envoyé (SMS et notifications), du plus récent au plus ancien. Avec le mode test, chaque
        lien est cliquable : plus besoin d&apos;ouvrir les journaux de Vercel.
      </p>
      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      {sansTexte && (
        <MessageAttention>
          Le texte et les liens ne sont pas gardés. Pour vos essais, ajoutez MODE_TEST=oui dans les variables
          d&apos;environnement (puis redéployez) ; retirez-le avant le vrai pilote.
        </MessageAttention>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(["tous", "SMS", "Notification"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCanal(c)}
            aria-pressed={canal === c}
            className={`min-h-11 rounded-xl px-4 text-sm font-bold transition-colors ${
              canal === c ? "bg-vert text-white" : "bg-vert-clair text-vert-fonce hover:bg-vert hover:text-white"
            }`}
          >
            {c === "tous" ? "Tous" : c === "SMS" ? "SMS" : "Notifications"}
          </button>
        ))}
        <button
          type="button"
          onClick={charger}
          className="min-h-11 rounded-xl border-[1.5px] border-vert bg-white px-4 text-sm font-bold text-vert"
        >
          Actualiser
        </button>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="h-5 w-5 accent-[#0a6847]" />
          Toutes les 5 s
        </label>
      </div>

      <ul className="flex flex-col gap-3">
        {visibles.map((l) => {
          const { canal: c, libelle, echec } = nomEvenement(l.evenement);
          const d = l.detail ?? {};
          const lien = d.chemin ? `${origine}${d.chemin}` : null;
          return (
            <li key={l.id} className={`flex flex-col gap-2 rounded-xl border-[1.5px] bg-white p-3.5 ${echec ? "border-rouge" : "border-trait"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ${c === "SMS" ? "bg-ambre text-ambre-fonce" : "bg-vert-clair text-vert-fonce"}`}>
                  {c}
                </span>
                <span className="text-[15px] font-extrabold">{libelle}</span>
                {echec && <span className="text-[12px] font-bold text-rouge">non envoyé</span>}
                <span className="text-[12.5px] text-discret">· {formaterDateHeureAbidjan(l.cree_le)}</span>
              </div>

              {c === "SMS" && (
                <p className="text-[13px] text-discret">
                  Vers {d.telephone ?? `…${d.telephone_fin ?? "?"}`}
                  {d.erreur ? ` · erreur : ${d.erreur}` : ""}
                </p>
              )}
              {c === "Notification" && (
                <p className="text-[13px] text-discret">
                  {d.cible === "pharmacie" ? "Pharmacie" : d.cible === "demande" ? "Patient" : d.cible === "livraison" ? "Livreur" : "Appareil"}
                  {" · "}
                  {typeof d.appareils === "number" ? `${d.appareils} appareil(s) joint(s)` : ""}
                  {l.evenement.startsWith("push_aucun_") ? " · aucun appareil abonné" : ""}
                </p>
              )}

              {d.message && (
                <p className="rounded-lg bg-fond p-2.5 text-[14px] leading-snug">
                  <TexteAvecLiens texte={d.message} />
                </p>
              )}
              {d.titre && (
                <p className="rounded-lg bg-fond p-2.5 text-[14px] leading-snug">
                  <strong>{d.titre}</strong>
                  <br />
                  {d.corps}
                </p>
              )}
              {lien && (
                <div className="flex flex-wrap items-center gap-2">
                  <a href={lien} className="inline-flex min-h-11 items-center rounded-xl bg-vert px-4 text-sm font-bold text-white">
                    Ouvrir la page
                  </a>
                  <BoutonCopier texte={lien} />
                </div>
              )}
            </li>
          );
        })}
        {visibles.length === 0 && <li className="text-sm text-discret">Aucun message pour le moment.</li>}
      </ul>
    </div>
  );
}

export default function PageMessages() {
  return (
    <CadreAdmin titre="Messages envoyés">
      <Contenu />
    </CadreAdmin>
  );
}
