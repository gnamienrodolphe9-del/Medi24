"use client";

import AssistantAlertes from "@/components/AssistantAlertes";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BOUTON_PRINCIPAL,
  BOUTON_SECONDAIRE,
  CHAMP,
  Carte,
  Chargement,
  MessageAttention,
  MessageErreur,
  MessageInfo,
  Pastille,
} from "@/components/ui";
import { envoyerJson, useSondage } from "@/lib/client/api";
import { formaterFcfa, totalLignes } from "@/lib/totaux";
import type { VuePharmacie } from "@/lib/serveur/pharmacie";

// Page de réponse de la pharmacie : ouverte depuis le lien reçu par SMS, sans compte.
export default function PagePharmacie() {
  const { jeton } = useParams<{ jeton: string }>();
  const { donnees: vue, erreur, statut, chargement, rafraichir } = useSondage<VuePharmacie>(
    `/api/pharmacie/${jeton}`,
    6000
  );

  return (
    <main className="flex min-h-screen flex-col gap-4 px-5 pb-10 pt-5">
      <header className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-vert">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <span className="text-[22px] font-extrabold tracking-tight">Medi24 · Pharmacie</span>
      </header>

      {chargement && <Chargement />}
      {statut === 404 && <MessageErreur>Ce lien n&apos;est pas valide.</MessageErreur>}
      {erreur && statut !== 404 && !vue && <MessageErreur>{erreur}</MessageErreur>}
      {vue && <Contenu jeton={jeton} vue={vue} rafraichir={rafraichir} />}
      {vue && <AssistantAlertes genre="alerte" jeton={jeton} role="pharmacie" />}
    </main>
  );
}

const TYPES_LIBELLES = {
  medicament: "Demande par nom de médicament",
  ordonnance: "Demande avec ordonnance (photo)",
  symptomes: "Demande par symptômes : avis du pharmacien attendu",
} as const;

type LigneForm = { produit: string; disponible: boolean; substitut: string; prix: string };

function Contenu({ jeton, vue, rafraichir }: { jeton: string; vue: VuePharmacie; rafraichir: () => Promise<void> }) {
  const d = vue.demande;

  // Pas de SMS quand le patient confirme : la page vibre et change de titre.
  const precedent = useRef<string | null>(null);
  useEffect(() => {
    const cle = `${d.etat}|${d.mode ?? ""}|${vue.estRetenue}`;
    if (precedent.current !== null && precedent.current !== cle) {
      try {
        navigator.vibrate?.([250, 120, 250]);
      } catch {
        // Vibration indisponible : sans importance.
      }
      if (vue.estRetenue && d.mode) document.title = "Medi24 · Le patient a confirmé";
    }
    precedent.current = cle;
  }, [d.etat, d.mode, vue.estRetenue]);

  const termine = ["remise", "annulee", "expiree", "repli"].includes(d.etat);

  return (
    <>
      <p className="text-[15px] font-semibold text-discret">{vue.pharmacie.nom}</p>

      {vue.expire && <MessageErreur>Ce lien a expiré (12 heures). Les nouvelles demandes arrivent par SMS.</MessageErreur>}

      {!vue.expire && d.etat === "annulee" && <MessageAttention>Le patient a annulé sa demande.</MessageAttention>}
      {!vue.expire && d.etat === "expiree" && <MessageAttention>Cette demande a expiré.</MessageAttention>}
      {!vue.expire && d.etat === "repli" && <MessageAttention>Cette demande est terminée.</MessageAttention>}
      {d.etat === "remise" && vue.estRetenue && <MessageInfo>Commande remise. Merci !</MessageInfo>}

      {vue.dejaPrise && !termine && (
        <MessageAttention>Une autre pharmacie a déjà pris en charge cette demande. Merci d&apos;avoir regardé.</MessageAttention>
      )}

      {/* Détails de la demande : tant que la pharmacie peut encore répondre ou préparer */}
      {!vue.expire && !termine && !vue.dejaPrise && <DetailsDemande vue={vue} />}

      {/* Formulaire de réponse */}
      {!vue.expire && !termine && !vue.dejaPrise && !vue.reponse && (
        <FormulaireReponse jeton={jeton} vue={vue} rafraichir={rafraichir} />
      )}

      {/* Déjà répondu */}
      {vue.reponse && !vue.dejaPrise && !termine && !vue.expire && (
        <SuiteReponse jeton={jeton} vue={vue} rafraichir={rafraichir} />
      )}
    </>
  );
}

function DetailsDemande({ vue }: { vue: VuePharmacie }) {
  const d = vue.demande;
  return (
    <Carte titre="Demande d'un patient">
      <Pastille ton="gris">{TYPES_LIBELLES[d.type]}</Pastille>
      {d.produits.length > 0 && (
        <ul className="flex flex-col gap-1 text-[16px] font-semibold">
          {d.produits.map((p, i) => (
            <li key={i}>• {p.produit}{p.quantite > 1 ? ` x${p.quantite}` : ""}</li>
          ))}
        </ul>
      )}
      {d.texteLibre && (
        <div className="rounded-xl bg-fond p-3">
          <p className="text-[13px] font-bold text-discret">Symptômes décrits</p>
          <p className="whitespace-pre-line text-[15px] leading-snug">{d.texteLibre}</p>
        </div>
      )}
      {(d.age || d.poidsKg || d.grossesse || d.allergies || d.traitements) && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[14px]">
          {d.age && (<><dt className="text-discret">Âge</dt><dd className="font-semibold">{d.age}</dd></>)}
          {d.poidsKg && (<><dt className="text-discret">Poids</dt><dd className="font-semibold">{d.poidsKg} kg</dd></>)}
          {d.grossesse && (<><dt className="text-discret">Grossesse</dt><dd className="font-semibold text-rouge">Oui</dd></>)}
          {d.allergies && (<><dt className="text-discret">Allergies</dt><dd className="font-semibold">{d.allergies}</dd></>)}
          {d.traitements && (<><dt className="text-discret">Traitements</dt><dd className="font-semibold">{d.traitements}</dd></>)}
        </dl>
      )}
      {d.ordonnances.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-bold text-discret">Ordonnance</p>
          {d.ordonnances.map((url) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Ordonnance du patient" className="max-h-80 w-full rounded-xl border-[1.5px] border-trait object-contain" />
              <span className="text-sm font-semibold text-vert underline">Ouvrir en grand</span>
            </a>
          ))}
        </div>
      )}
      {d.repere && <p className="text-[14px] text-discret">Repère du patient : {d.repere}</p>}
    </Carte>
  );
}

function FormulaireReponse({ jeton, vue, rafraichir }: { jeton: string; vue: VuePharmacie; rafraichir: () => Promise<void> }) {
  const d = vue.demande;
  const [statut, setStatut] = useState<"disponible" | "partiel" | "indisponible" | null>(null);
  const [lignes, setLignes] = useState<LigneForm[]>(
    d.produits.length > 0
      ? d.produits.map((p) => ({ produit: p.produit, disponible: true, substitut: "", prix: "" }))
      : [{ produit: "", disponible: true, substitut: "", prix: "" }]
  );
  const [avis, setAvis] = useState("");
  const [retrait, setRetrait] = useState(true);
  const [livraison, setLivraison] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  function maj(i: number, valeurs: Partial<LigneForm>) {
    setLignes((l) => l.map((x, j) => (j === i ? { ...x, ...valeurs } : x)));
  }

  async function envoyer() {
    if (!statut) return;
    setErreur(null);
    setOccupe(true);
    const r = await envoyerJson<{ retenue: boolean; raison: string | null }>(`/api/pharmacie/${jeton}`, {
      action: "repondre",
      statut,
      avis,
      retrait,
      livraison,
      lignes: lignes
        .filter((l) => l.produit.trim())
        .map((l) => ({
          produit: l.produit,
          disponible: statut === "disponible" ? true : l.disponible,
          substitut: l.substitut,
          prix: l.prix === "" ? null : Number(l.prix.replace(/\s/g, "").replace(",", ".")),
        })),
    });
    setOccupe(false);
    if (!r.ok) {
      setErreur(r.erreur);
      return;
    }
    if (statut !== "indisponible" && !r.donnees.retenue) {
      setMessage("Réponse enregistrée, mais une autre pharmacie a répondu avant vous.");
    }
    await rafraichir();
  }

  return (
    <>
      <Carte titre="Votre réponse">
        <div className="grid gap-2">
          <button type="button" aria-pressed={statut === "disponible"} onClick={() => setStatut("disponible")}
            className={`min-h-14 rounded-2xl border-[1.5px] px-4 text-lg font-extrabold ${statut === "disponible" ? "border-vert bg-vert text-white" : "border-vert bg-white text-vert"}`}>
            Disponible
          </button>
          <button type="button" aria-pressed={statut === "partiel"} onClick={() => setStatut("partiel")}
            className={`min-h-14 rounded-2xl border-[1.5px] px-4 text-lg font-extrabold ${statut === "partiel" ? "border-ambre-fonce bg-ambre text-ambre-fonce" : "border-[#c9a24a] bg-white text-ambre-fonce"}`}>
            Partiel (ou avec alternative)
          </button>
          <button type="button" aria-pressed={statut === "indisponible"} onClick={() => setStatut("indisponible")}
            className={`min-h-14 rounded-2xl border-[1.5px] px-4 text-lg font-extrabold ${statut === "indisponible" ? "border-rouge bg-rouge text-white" : "border-rouge bg-white text-rouge"}`}>
            Indisponible
          </button>
        </div>
      </Carte>

      {(statut === "disponible" || statut === "partiel") && (
        <>
          <Carte titre={d.type === "medicament" ? "Produits et prix" : "Produits que vous proposez"}>
            <ul className="flex flex-col gap-3">
              {lignes.map((l, i) => (
                <li key={i} className="flex flex-col gap-2 rounded-xl border-[1.5px] border-trait p-3">
                  <input value={l.produit} onChange={(e) => maj(i, { produit: e.target.value })} placeholder="Nom du produit" maxLength={200} className={CHAMP} aria-label={`Produit ${i + 1}`} />
                  {statut === "partiel" && (
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" aria-pressed={l.disponible} onClick={() => maj(i, { disponible: true })}
                        className={`min-h-11 rounded-xl border-[1.5px] text-sm font-bold ${l.disponible ? "border-vert bg-vert text-white" : "border-vert bg-white text-vert"}`}>
                        En stock
                      </button>
                      <button type="button" aria-pressed={!l.disponible} onClick={() => maj(i, { disponible: false })}
                        className={`min-h-11 rounded-xl border-[1.5px] text-sm font-bold ${!l.disponible ? "border-rouge bg-rouge text-white" : "border-rouge bg-white text-rouge"}`}>
                        Pas en stock
                      </button>
                    </div>
                  )}
                  {statut === "partiel" && !l.disponible && (
                    <input value={l.substitut} onChange={(e) => maj(i, { substitut: e.target.value })} placeholder="Alternative proposée (facultatif)" maxLength={200} className={CHAMP} aria-label={`Alternative pour le produit ${i + 1}`} />
                  )}
                  <input value={l.prix} onChange={(e) => maj(i, { prix: e.target.value })} inputMode="numeric" placeholder={statut === "partiel" && !l.disponible ? "Prix de l'alternative (FCFA)" : "Prix (FCFA)"} className={CHAMP} aria-label={`Prix du produit ${i + 1}`} />
                  {lignes.length > 1 && (
                    <button type="button" onClick={() => setLignes((x) => x.filter((_, j) => j !== i))} className="min-h-11 self-start text-sm font-semibold text-rouge underline">
                      Retirer cette ligne
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {lignes.length < 15 && (
              <button type="button" onClick={() => setLignes((x) => [...x, { produit: "", disponible: true, substitut: "", prix: "" }])} className={BOUTON_SECONDAIRE}>
                Ajouter un produit
              </button>
            )}
          </Carte>

          <Carte titre={d.type === "symptomes" ? "Votre avis de pharmacien (obligatoire)" : "Message au patient (facultatif)"}>
            <textarea value={avis} onChange={(e) => setAvis(e.target.value)} rows={4} maxLength={600} className={CHAMP}
              placeholder={d.type === "symptomes" ? "Conseil, posologie, quand consulter…" : "Précision utile pour le patient"} aria-label="Message au patient" />
          </Carte>

          <Carte titre="Remise possible">
            <label className="flex min-h-12 items-center gap-3 text-base font-semibold">
              <input type="checkbox" checked={retrait} onChange={(e) => setRetrait(e.target.checked)} className="h-6 w-6 accent-[#0a6847]" />
              Le patient peut venir chercher
            </label>
            <label className="flex min-h-12 items-center gap-3 text-base font-semibold">
              <input type="checkbox" checked={livraison} onChange={(e) => setLivraison(e.target.checked)} className="h-6 w-6 accent-[#0a6847]" />
              Je peux livrer (mon livreur)
            </label>
          </Carte>
        </>
      )}

      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      {message && <MessageAttention>{message}</MessageAttention>}

      {statut && (
        <button type="button" onClick={envoyer} disabled={occupe} className={BOUTON_PRINCIPAL}>
          {occupe ? "Envoi…" : "Envoyer ma réponse"}
        </button>
      )}
    </>
  );
}

function SuiteReponse({ jeton, vue, rafraichir }: { jeton: string; vue: VuePharmacie; rafraichir: () => Promise<void> }) {
  const reponse = vue.reponse!;
  const d = vue.demande;
  const [telLivreur, setTelLivreur] = useState("");
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function envoyerLivreur() {
    setErreur(null);
    setMessage(null);
    setOccupe(true);
    const r = await envoyerJson<{ smsEnvoye?: boolean }>(`/api/pharmacie/${jeton}`, {
      action: "livreur",
      telephone: telLivreur,
    });
    setOccupe(false);
    if (!r.ok) {
      setErreur(r.erreur);
      return;
    }
    setMessage(
      r.donnees.smsEnvoye === false
        ? "Le SMS n'est pas parti. Envoyez le lien au livreur par WhatsApp (boutons ci-dessous)."
        : "Lien envoyé au livreur par SMS."
    );
    setTelLivreur("");
    await rafraichir();
  }

  async function action(corps: Record<string, unknown>, succes?: string) {
    setErreur(null);
    setMessage(null);
    setOccupe(true);
    const r = await envoyerJson(`/api/pharmacie/${jeton}`, corps);
    setOccupe(false);
    if (!r.ok) {
      setErreur(r.erreur);
      return;
    }
    if (succes) setMessage(succes);
    await rafraichir();
  }

  if (reponse.statut === "indisponible") {
    return <MessageInfo>Réponse « indisponible » enregistrée. Merci !</MessageInfo>;
  }

  if (!vue.estRetenue) {
    return (
      <MessageAttention>
        Votre réponse est enregistrée, mais une autre pharmacie a été retenue pour cette demande. Merci !
      </MessageAttention>
    );
  }

  const { total, prixManquant } = totalLignes(reponse.lignes);
  const aPreparer = reponse.lignes.filter((l) => l.disponible || l.substitut_accepte === true);
  const enAttenteSubstituts = reponse.lignes.some((l) => !l.disponible && l.substitut && l.substitut_accepte === null);

  return (
    <>
      <MessageInfo>
        Vous êtes retenu pour cette demande. {d.mode ? "Le patient a confirmé sa commande." : "En attente de la confirmation du patient."}
      </MessageInfo>

      {!d.mode && (
        <Carte titre="En attente du patient">
          <p className="text-[15px] leading-snug text-discret">
            Le patient choisit entre retrait et livraison{enAttenteSubstituts ? " et répond à vos alternatives" : ""}. Cette page se met à jour toute seule.
          </p>
        </Carte>
      )}

      {d.mode && (
        <>
          <Carte titre="À préparer">
            <ul className="flex flex-col gap-1.5 text-[16px] font-semibold">
              {aPreparer.map((l) => (
                <li key={l.id}>
                  • {l.disponible ? l.produit : `${l.substitut} (à la place de ${l.produit})`}
                  {l.prix_fcfa != null ? ` · ${formaterFcfa(l.prix_fcfa)}` : ""}
                </li>
              ))}
            </ul>
            {reponse.lignes.some((l) => !l.disponible && !(l.substitut_accepte === true)) && (
              <p className="text-[13px] text-discret">Les produits indisponibles ou refusés par le patient ne sont pas à préparer.</p>
            )}
            <div className="flex items-center justify-between border-t border-trait pt-3">
              <span className="font-bold">Total à encaisser (espèces)</span>
              <span className="text-xl font-extrabold">{formaterFcfa(total)}{prixManquant ? " +" : ""}</span>
            </div>
            <p className="text-sm font-semibold">
              Mode : {d.mode === "retrait" ? "le patient vient chercher" : "livraison"}
            </p>
            {vue.telephonePatient && (
              <a href={`tel:${vue.telephonePatient}`} className="flex min-h-12 items-center justify-center rounded-xl border-[1.5px] border-vert bg-white px-4 text-base font-bold text-vert">
                Appeler le patient
              </a>
            )}
          </Carte>

          {d.mode === "livraison" && d.etat !== "remise" && (
            <Carte titre="Livreur">
              {vue.livraison ? (
                <p className="text-[15px]">
                  Livreur : <strong>{vue.livraison.telephoneLivreur}</strong>{" "}
                  <Pastille ton={vue.livraison.etat === "creee" ? "gris" : "vert"}>
                    {{ creee: "Pas encore parti", parti: "En route", arrive: "Arrivé", remis: "Remis" }[vue.livraison.etat]}
                  </Pastille>
                </p>
              ) : (
                <p className="text-[15px] leading-snug text-discret">Indiquez le numéro de votre livreur : il reçoit un lien par SMS (et vous pouvez aussi le lui envoyer par WhatsApp).</p>
              )}
              {vue.livraison && vue.livraison.etat !== "remis" && (
                <LienLivreur lien={vue.livraison.lien} telephone={vue.livraison.telephoneLivreur} />
              )}
              {(!vue.livraison || vue.livraison.etat === "creee") && (
                <>
                  <input type="tel" inputMode="tel" value={telLivreur} onChange={(e) => setTelLivreur(e.target.value)} placeholder="Numéro du livreur" className={CHAMP} aria-label="Numéro du livreur" />
                  <button type="button" disabled={occupe || !telLivreur.trim()} onClick={envoyerLivreur} className={BOUTON_SECONDAIRE}>
                    {vue.livraison ? "Changer le livreur" : "Envoyer le lien au livreur"}
                  </button>
                </>
              )}
            </Carte>
          )}

          {d.etat === "confirmee" && (
            <button type="button" disabled={occupe || (d.mode === "livraison" && !vue.livraison)} onClick={() => action({ action: "prete" })} className={BOUTON_PRINCIPAL}>
              Commande prête
            </button>
          )}

          {d.etat === "prete" && d.mode === "retrait" && (
            <Carte titre="Remise au patient">
              <MessageInfo>Commande prête. Le patient a été prévenu par SMS.</MessageInfo>
              {vue.codeBloque ? (
                <MessageErreur>Trop d&apos;essais de code. Contactez Medi24.</MessageErreur>
              ) : (
                <>
                  <label className="flex flex-col gap-1.5 text-sm font-semibold">
                    Code à 4 chiffres donné par le patient
                    <input inputMode="numeric" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      className={`${CHAMP} text-center text-3xl font-extrabold tracking-[0.4em]`} />
                  </label>
                  <button type="button" disabled={occupe || code.length !== 4} onClick={() => action({ action: "valider_code", code }, "Remise enregistrée. Merci !")} className={BOUTON_PRINCIPAL}>
                    Valider la remise
                  </button>
                </>
              )}
            </Carte>
          )}

          {(d.etat === "prete" || d.etat === "en_livraison") && d.mode === "livraison" && (
            <MessageInfo>
              {d.etat === "prete" ? "Commande prête : le livreur peut partir." : "Le livreur est en route chez le patient."}
            </MessageInfo>
          )}
        </>
      )}

      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      {message && <MessageInfo>{message}</MessageInfo>}
    </>
  );
}

// Lien de la course du livreur : copie ou WhatsApp, au cas où le SMS ne lui serait pas arrivé.
function LienLivreur({ lien, telephone }: { lien: string; telephone: string }) {
  const [copie, setCopie] = useState(false);
  async function copier() {
    try {
      await navigator.clipboard.writeText(lien);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      window.prompt("Copiez ce lien :", lien);
    }
  }
  const numero = telephone.replace(/\D/g, "");
  const texte = encodeURIComponent(`Medi24 : course a faire. Ouvrez ce lien : ${lien}`);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] leading-snug text-discret">Le livreur n&apos;a pas reçu le SMS ? Envoyez-lui le lien :</p>
      <div className="grid grid-cols-2 gap-3">
        <a href={`https://wa.me/${numero}?text=${texte}`} target="_blank" rel="noopener noreferrer" className={BOUTON_SECONDAIRE}>
          WhatsApp
        </a>
        <button type="button" onClick={copier} className={BOUTON_SECONDAIRE}>
          {copie ? "Copié ✓" : "Copier le lien"}
        </button>
      </div>
    </div>
  );
}
