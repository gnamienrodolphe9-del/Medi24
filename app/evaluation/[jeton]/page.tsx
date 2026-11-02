"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import EnTete from "@/components/EnTete";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, CHAMP, Carte, Chargement, MessageErreur, MessageInfo } from "@/components/ui";
import { appeler, envoyerJson } from "@/lib/client/api";

export default function PageEvaluation() {
  const { jeton } = useParams<{ jeton: string }>();
  const [etat, setEtat] = useState<"chargement" | "possible" | "deja" | "impossible" | "merci">("chargement");
  const [note, setNote] = useState(0);
  const [commentaire, setCommentaire] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    appeler<{ possible: boolean; dejaFaite: boolean }>(`/api/evaluation/${jeton}`).then((r) => {
      if (!r.ok) setEtat("impossible");
      else setEtat(r.donnees.dejaFaite ? "deja" : r.donnees.possible ? "possible" : "impossible");
    });
  }, [jeton]);

  async function envoyer() {
    if (note < 1) {
      setErreur("Choisissez une note de 1 à 5.");
      return;
    }
    setErreur(null);
    setOccupe(true);
    const r = await envoyerJson(`/api/evaluation/${jeton}`, { note, commentaire });
    setOccupe(false);
    if (!r.ok) setErreur(r.erreur);
    else setEtat("merci");
  }

  return (
    <main className="flex min-h-screen flex-col gap-5 px-5 pb-10 pt-5">
      <EnTete />
      <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">Votre avis</h1>

      {etat === "chargement" && <Chargement />}
      {etat === "impossible" && <MessageErreur>Vous pourrez donner votre avis une fois la commande remise.</MessageErreur>}
      {etat === "deja" && <MessageInfo>Vous avez déjà donné votre avis. Merci !</MessageInfo>}
      {etat === "merci" && <MessageInfo>Merci pour votre avis, il nous aide à améliorer le service.</MessageInfo>}

      {etat === "possible" && (
        <Carte titre="Comment s'est passée votre commande ?">
          <div role="radiogroup" aria-label="Note de 1 à 5" className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={note === n} onClick={() => setNote(n)}
                className={`min-h-14 rounded-xl border-[1.5px] text-xl font-extrabold ${note === n ? "border-vert bg-vert text-white" : "border-trait bg-white"}`}>
                {n}
              </button>
            ))}
          </div>
          <p className="flex justify-between text-[12px] text-discret"><span>Pas bien</span><span>Très bien</span></p>
          <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={3} maxLength={500} placeholder="Un commentaire (facultatif)" className={CHAMP} aria-label="Commentaire" />
          {erreur && <MessageErreur>{erreur}</MessageErreur>}
          <button type="button" onClick={envoyer} disabled={occupe} className={BOUTON_PRINCIPAL}>
            {occupe ? "Envoi…" : "Envoyer mon avis"}
          </button>
        </Carte>
      )}

      <Link href="/" className={BOUTON_SECONDAIRE}>Retour à l&apos;accueil</Link>
    </main>
  );
}
