"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, CHAMP, Carte, Chargement, MessageErreur, MessageInfo, Pastille } from "@/components/ui";
import { appeler, envoyerJson } from "@/lib/client/api";
import { masquerTelephone, useCompte } from "@/lib/client/compte";
import { type EtatDemande, estTermine, libelleEtat } from "@/lib/etats";
import { formaterDateHeureAbidjan } from "@/lib/garde";

type Demande = {
  jeton: string;
  type: "medicament" | "ordonnance" | "symptomes";
  etat: EtatDemande;
  mode: "retrait" | "livraison" | null;
  texteLibre: string | null;
  le: string;
  produits: { produit: string; quantite: number }[];
  pharmacie: string | null;
};
type Historique = { connecte: boolean; telephone?: string; demandes?: Demande[] };

function resume(d: Demande): string {
  if (d.type === "ordonnance") return "Ordonnance (photo)";
  if (d.type === "symptomes") return `Symptômes : ${(d.texteLibre ?? "").slice(0, 60)}`;
  const produits = d.produits.map((p) => (p.quantite > 1 ? `${p.produit} x${p.quantite}` : p.produit));
  return produits.slice(0, 3).join(", ") + (produits.length > 3 ? "…" : "") || "Demande";
}

export default function ContenuCompte() {
  const compte = useCompte();
  const [demandes, setDemandes] = useState<Demande[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const r = await appeler<Historique>("/api/compte?historique=1");
    if (r.ok) setDemandes(r.donnees.demandes ?? []);
    else setErreur(r.erreur);
  }, []);

  useEffect(() => {
    if (compte.charge && compte.connecte) void charger();
  }, [compte.charge, compte.connecte, charger]);

  if (!compte.charge) return <Chargement />;
  if (!compte.connecte) return <Connexion surConnecte={compte.actualiser} />;

  return (
    <>
      <Carte>
        <p className="text-[15px]">
          Connecté avec le <strong>{masquerTelephone(compte.telephone ?? "")}</strong>. Vous n&apos;avez plus à recevoir de
          code sur ce téléphone.
        </p>
        <Link href="/demande" className={`${BOUTON_PRINCIPAL} text-center`}>
          Nouvelle demande
        </Link>
      </Carte>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-extrabold">Mes demandes</h2>
        {erreur && <MessageErreur>{erreur}</MessageErreur>}
        {!demandes && !erreur && <Chargement />}
        {demandes && demandes.length === 0 && (
          <p className="text-base text-discret">Vous n&apos;avez pas encore fait de demande.</p>
        )}
        <ul className="flex flex-col gap-2">
          {(demandes ?? []).map((d) => (
            <li key={d.jeton}>
              <Link
                href={`/suivi/${d.jeton}`}
                className="flex min-h-16 items-center justify-between gap-3 rounded-xl border-[1.5px] border-trait bg-white p-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-bold leading-tight">{resume(d)}</span>
                  <span className="block text-[12.5px] text-discret">
                    {formaterDateHeureAbidjan(d.le)}
                    {d.pharmacie ? ` · ${d.pharmacie}` : ""}
                  </span>
                </span>
                <Pastille ton={d.etat === "remise" ? "vert" : estTermine(d.etat) ? "gris" : "ambre"}>
                  {libelleEtat(d.etat)}
                </Pastille>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        onClick={async () => {
          await compte.deconnecter();
          setDemandes(null);
        }}
        className={BOUTON_SECONDAIRE}
      >
        Me déconnecter de ce téléphone
      </button>
      <p className="text-[13px] leading-snug text-discret">
        Votre numéro sert d&apos;identifiant : pas de mot de passe. Sur un autre téléphone, un code reçu par SMS vous
        reconnecte et retrouve vos demandes.
      </p>
    </>
  );
}

// Retrouver son compte sur un nouvel appareil : numéro + code reçu par SMS.
function Connexion({ surConnecte }: { surConnecte: () => Promise<void> }) {
  const [telephone, setTelephone] = useState("");
  const [code, setCode] = useState("");
  const [codeEnvoye, setCodeEnvoye] = useState(false);
  const [codeDev, setCodeDev] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function recevoirCode() {
    setErreur(null);
    setOccupe(true);
    const r = await envoyerJson<{ codeDev?: string }>("/api/telephone/code", { telephone });
    setOccupe(false);
    if (!r.ok) return setErreur(r.erreur);
    setCodeEnvoye(true);
    setCodeDev(r.donnees.codeDev ?? null);
  }

  async function seConnecter() {
    setErreur(null);
    setOccupe(true);
    const r = await envoyerJson("/api/compte", { action: "connexion", telephone, code: code.trim() });
    setOccupe(false);
    if (!r.ok) return setErreur(r.erreur);
    await surConnecte();
  }

  return (
    <>
      <p className="text-base leading-snug text-discret">
        Votre compte se crée tout seul à votre première demande. Si vous avez déjà fait une demande, connectez-vous ici pour
        retrouver votre historique.
      </p>
      <Carte titre="Me connecter">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Téléphone
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={telephone}
            onChange={(e) => {
              setTelephone(e.target.value);
              setCodeEnvoye(false);
              setCodeDev(null);
            }}
            placeholder="07 00 00 00 00"
            className={CHAMP}
          />
        </label>
        {!codeEnvoye ? (
          <button type="button" onClick={recevoirCode} disabled={occupe} className={BOUTON_SECONDAIRE}>
            {occupe ? "Envoi…" : "Recevoir un code par SMS"}
          </button>
        ) : (
          <>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Code reçu par SMS (5 chiffres)
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={5}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className={`${CHAMP} text-center text-2xl font-extrabold tracking-[0.4em]`}
              />
            </label>
            {codeDev && <MessageInfo>Mode test : votre code est {codeDev}</MessageInfo>}
            <button type="button" onClick={seConnecter} disabled={occupe || code.length !== 5} className={BOUTON_PRINCIPAL}>
              {occupe ? "Un instant…" : "Me connecter"}
            </button>
          </>
        )}
        {erreur && <MessageErreur>{erreur}</MessageErreur>}
      </Carte>
      <Link href="/demande" className={`${BOUTON_SECONDAIRE} text-center`}>
        Faire une demande
      </Link>
    </>
  );
}
