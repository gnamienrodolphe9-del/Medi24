"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import EnTete from "@/components/EnTete";
import CarteSimple, { type Repere } from "@/components/CarteSimple";
import {
  BOUTON_DANGER,
  BOUTON_PRINCIPAL,
  BOUTON_SECONDAIRE,
  Carte,
  Chargement,
  MessageAttention,
  MessageErreur,
  MessageInfo,
  Pastille,
} from "@/components/ui";
import { envoyerJson, useSondage } from "@/lib/client/api";
import { memoriserDemande, oublierDemande } from "@/lib/client/memoire";
import { estEnRecherche } from "@/lib/etats";
import { formaterDistance, lienItineraire } from "@/lib/garde";
import { formaterFcfa, substitutsEnAttente, totalLignes } from "@/lib/totaux";
import type { SuiviPatient } from "@/lib/serveur/suivi";

function dureeTexte(depuisIso: string, maintenant: number): string {
  const s = Math.max(0, Math.floor((maintenant - new Date(depuisIso).getTime()) / 1000));
  const m = Math.floor(s / 60);
  return `${m} min ${String(s % 60).padStart(2, "0")} s`;
}

export default function PageSuivi() {
  const { jeton } = useParams<{ jeton: string }>();
  const { donnees: suivi, erreur, statut, chargement, rafraichir } = useSondage<SuiviPatient>(
    `/api/suivi/${jeton}`,
    4000
  );

  useEffect(() => {
    if (jeton && statut === 200) memoriserDemande(jeton);
    if (statut === 404) oublierDemande();
  }, [jeton, statut]);

  return (
    <main className="flex min-h-screen flex-col gap-5 px-5 pb-10 pt-5">
      <EnTete />
      <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">Ma demande</h1>

      {chargement && <Chargement />}
      {statut === 404 && (
        <>
          <MessageErreur>Cette demande est introuvable. Le lien est peut-être incomplet.</MessageErreur>
          <Link href="/demande" className={BOUTON_PRINCIPAL}>Faire une nouvelle demande</Link>
        </>
      )}
      {erreur && statut !== 404 && !suivi && <MessageErreur>{erreur}</MessageErreur>}
      {erreur && statut !== 404 && suivi && (
        <MessageAttention>Connexion instable : les informations peuvent avoir quelques secondes de retard.</MessageAttention>
      )}

      {suivi && <Contenu jeton={jeton} suivi={suivi} rafraichir={rafraichir} />}
    </main>
  );
}

function Contenu({ jeton, suivi, rafraichir }: { jeton: string; suivi: SuiviPatient; rafraichir: () => Promise<void> }) {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function agir(corps: Record<string, unknown>): Promise<boolean> {
    setErreurAction(null);
    setOccupe(true);
    const r = await envoyerJson(`/api/suivi/${jeton}`, corps);
    setOccupe(false);
    if (!r.ok) {
      setErreurAction(r.erreur);
      return false;
    }
    await rafraichir();
    return true;
  }

  const annuler = () => {
    if (window.confirm("Annuler cette demande ?")) agir({ action: "annuler" });
  };

  const recherche = estEnRecherche(suivi.etat);

  return (
    <>
      {erreurAction && <MessageErreur>{erreurAction}</MessageErreur>}

      {recherche && (
        <>
          <Carte>
            <div className="flex items-center gap-3">
              <span className="h-5 w-5 shrink-0 animate-pulse rounded-full bg-vert" aria-hidden="true" />
              <div>
                <p className="text-lg font-extrabold leading-tight">
                  {suivi.etat === "vue" ? "Une pharmacie regarde votre demande" : "Nous alertons les pharmacies de garde"}
                </p>
                <p className="mt-0.5 text-[13px] text-discret">
                  {suivi.pharmaciesAlertees} pharmacie(s) alertée(s) · {dureeTexte(suivi.creeLe, maintenant)}
                </p>
              </div>
            </div>
            <p className="text-[14px] leading-snug text-discret">
              Gardez cette page ouverte. Vous recevrez aussi un SMS dès qu&apos;une pharmacie répond.
            </p>
          </Carte>
          <ResumeDemande suivi={suivi} />
          {suivi.repliFait && (
            <>
              <MessageAttention>
                Pas encore de réponse. Vous pouvez appeler directement une pharmacie de garde, pendant que nous continuons à chercher.
              </MessageAttention>
              <ListeAppel suivi={suivi} />
            </>
          )}
          <button type="button" onClick={annuler} disabled={occupe} className={BOUTON_DANGER}>
            Annuler ma demande
          </button>
        </>
      )}

      {(suivi.etat === "repli" || suivi.etat === "expiree") && (
        <>
          <MessageAttention>
            {suivi.etat === "repli"
              ? "Nous n'avons pas pu joindre de pharmacie automatiquement."
              : "Aucune pharmacie n'a répondu à temps."}{" "}
            Appelez directement une pharmacie de garde.
          </MessageAttention>
          <ListeAppel suivi={suivi} />
          <Link href="/demande" className={BOUTON_PRINCIPAL}>Refaire une demande</Link>
        </>
      )}

      {suivi.etat === "annulee" && (
        <>
          <MessageInfo>Votre demande est annulée.</MessageInfo>
          <Link href="/demande" className={BOUTON_PRINCIPAL}>Faire une nouvelle demande</Link>
        </>
      )}

      {suivi.etat === "confirmee" && suivi.reponse && suivi.pharmacie && (
        <ReponsePharmacie suivi={suivi} agir={agir} occupe={occupe} annuler={annuler} />
      )}

      {(suivi.etat === "prete" || suivi.etat === "en_livraison") && suivi.pharmacie && (
        <CommandeEnCours suivi={suivi} />
      )}

      {suivi.etat === "remise" && (
        <>
          <MessageInfo>Remise effectuée. Prenez soin de vous.</MessageInfo>
          {!suivi.evaluationFaite && (
            <Link href={`/evaluation/${jeton}`} className={BOUTON_PRINCIPAL}>Donner mon avis (30 secondes)</Link>
          )}
          <Link href="/" className={BOUTON_SECONDAIRE}>Retour à l&apos;accueil</Link>
        </>
      )}
    </>
  );
}

function ResumeDemande({ suivi }: { suivi: SuiviPatient }) {
  const texte =
    suivi.type === "ordonnance"
      ? "Ordonnance envoyée"
      : suivi.type === "symptomes"
        ? "Demande par symptômes"
        : suivi.produits.map((p) => (p.quantite > 1 ? `${p.produit} x${p.quantite}` : p.produit)).join(", ");
  return (
    <Carte titre="Votre demande">
      <p className="text-[15px] leading-snug">{texte}</p>
    </Carte>
  );
}

function ListeAppel({ suivi }: { suivi: SuiviPatient }) {
  if (suivi.repliListe.length === 0) {
    return (
      <Link href="/pharmacies-de-garde" className={BOUTON_SECONDAIRE}>
        Voir les pharmacies de garde
      </Link>
    );
  }
  return (
    <Carte titre="Pharmacies de garde à appeler">
      <ul className="flex flex-col gap-3">
        {suivi.repliListe.map((p) => (
          <li key={p.id} className="flex flex-col gap-2 rounded-xl border-[1.5px] border-trait p-3">
            <div>
              <p className="text-base font-extrabold leading-tight">{p.nom}</p>
              <p className="mt-0.5 text-[13px] text-discret">
                {formaterDistance(p.distance_m)} · {[p.adresse, p.repere].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex gap-2">
              {p.telephone_public && (
                <a href={`tel:${p.telephone_public}`} className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-vert px-3 text-sm font-bold text-white">
                  Appeler
                </a>
              )}
              <a href={lienItineraire(p.latitude, p.longitude)} target="_blank" rel="noopener noreferrer" className="flex min-h-11 flex-1 items-center justify-center rounded-xl border-[1.5px] border-vert bg-white px-3 text-sm font-bold text-vert">
                Itinéraire
              </a>
            </div>
          </li>
        ))}
      </ul>
    </Carte>
  );
}

function BlocPharmacie({ suivi, avecItineraire }: { suivi: SuiviPatient; avecItineraire: boolean }) {
  const p = suivi.pharmacie;
  if (!p) return null;
  return (
    <Carte titre={p.nom}>
      <p className="text-[14px] leading-snug text-discret">
        {[p.adresse, p.repere].filter(Boolean).join(" · ") || "Adresse non renseignée"}
      </p>
      <div className="flex gap-2">
        {p.telephone && (
          <a href={`tel:${p.telephone}`} className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-vert px-3 text-base font-bold text-white">
            Appeler
          </a>
        )}
        {avecItineraire && p.latitude !== null && p.longitude !== null && (
          <a href={lienItineraire(p.latitude, p.longitude)} target="_blank" rel="noopener noreferrer" className="flex min-h-12 flex-1 items-center justify-center rounded-xl border-[1.5px] border-vert bg-white px-3 text-base font-bold text-vert">
            Itinéraire
          </a>
        )}
      </div>
    </Carte>
  );
}

function ReponsePharmacie({
  suivi,
  agir,
  occupe,
  annuler,
}: {
  suivi: SuiviPatient;
  agir: (corps: Record<string, unknown>) => Promise<boolean>;
  occupe: boolean;
  annuler: () => void;
}) {
  const reponse = suivi.reponse!;
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<"retrait" | "livraison" | null>(null);

  const lignes = useMemo(
    () => reponse.lignes.map((l) => (l.id in decisions ? { ...l, substitut_accepte: decisions[l.id] } : l)),
    [reponse.lignes, decisions]
  );
  const enAttente = substitutsEnAttente(lignes);
  const { total, prixManquant } = totalLignes(lignes);
  const rienAcceptable = lignes.every(
    (l) => !l.disponible && (!l.substitut || l.substitut_accepte === false)
  );

  // Le patient a déjà validé : la pharmacie prépare.
  if (suivi.mode) {
    return (
      <>
        <MessageInfo>
          Choix enregistré : {suivi.mode === "retrait" ? "je viens chercher" : "livraison"}. La pharmacie prépare votre commande.
        </MessageInfo>
        <BlocPharmacie suivi={suivi} avecItineraire={suivi.mode === "retrait"} />
        {suivi.codeRemise && <CodeRemise code={suivi.codeRemise} mode={suivi.mode} />}
        <button type="button" onClick={annuler} disabled={occupe} className={BOUTON_DANGER}>
          Annuler ma demande
        </button>
      </>
    );
  }

  const peutValider = mode !== null && enAttente.length === 0 && !rienAcceptable;

  return (
    <>
      <MessageInfo>
        {reponse.statut === "disponible" ? "Une pharmacie a votre produit." : "Une pharmacie a répondu : réponse partielle."}
      </MessageInfo>
      <BlocPharmacie suivi={suivi} avecItineraire={false} />

      {reponse.avis && (
        <Carte titre="Avis du pharmacien">
          <p className="whitespace-pre-line text-[15px] leading-snug">{reponse.avis}</p>
        </Carte>
      )}

      <Carte titre="Produits et prix">
        <ul className="flex flex-col gap-3">
          {lignes.map((l) => (
            <li key={l.id} className="flex flex-col gap-2 rounded-xl border-[1.5px] border-trait p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-base font-extrabold leading-tight">{l.produit}</p>
                {l.disponible ? <Pastille ton="vert">Disponible</Pastille> : <Pastille ton="rouge">Indisponible</Pastille>}
              </div>
              {l.disponible && (
                <p className="text-[14px] text-discret">{l.prix_fcfa != null ? formaterFcfa(l.prix_fcfa) : "Prix à confirmer"}</p>
              )}
              {!l.disponible && l.substitut && (
                <div className="flex flex-col gap-2 rounded-xl bg-ambre p-3">
                  <p className="text-[14px] font-semibold leading-snug text-ambre-fonce">
                    Alternative proposée : {l.substitut}
                    {l.prix_fcfa != null ? ` · ${formaterFcfa(l.prix_fcfa)}` : ""}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      aria-pressed={l.substitut_accepte === true}
                      onClick={() => setDecisions((d) => ({ ...d, [l.id]: true }))}
                      className={`min-h-11 rounded-xl border-[1.5px] px-3 text-sm font-bold ${
                        l.substitut_accepte === true ? "border-vert bg-vert text-white" : "border-vert bg-white text-vert"
                      }`}
                    >
                      J&apos;accepte
                    </button>
                    <button
                      type="button"
                      aria-pressed={l.substitut_accepte === false}
                      onClick={() => setDecisions((d) => ({ ...d, [l.id]: false }))}
                      className={`min-h-11 rounded-xl border-[1.5px] px-3 text-sm font-bold ${
                        l.substitut_accepte === false ? "border-rouge bg-rouge text-white" : "border-rouge bg-white text-rouge"
                      }`}
                    >
                      Je refuse
                    </button>
                  </div>
                </div>
              )}
              {!l.disponible && !l.substitut && (
                <p className="text-[13px] text-discret">Pas d&apos;alternative proposée.</p>
              )}
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-trait pt-3">
          <span className="text-base font-bold">Total estimé</span>
          <span className="text-xl font-extrabold">
            {formaterFcfa(total)}
            {prixManquant ? " +" : ""}
          </span>
        </div>
        <p className="text-[12.5px] leading-snug text-discret">
          Le prix final est celui annoncé par la pharmacie à la remise. Paiement en espèces.
        </p>
      </Carte>

      <Carte titre="Comment récupérer ?">
        <div className="grid gap-2">
          {reponse.retraitPossible && (
            <button
              type="button"
              aria-pressed={mode === "retrait"}
              onClick={() => setMode("retrait")}
              className={`flex min-h-16 flex-col items-start justify-center rounded-2xl border-[1.5px] px-4 py-2 text-left ${
                mode === "retrait" ? "border-vert bg-vert-clair" : "border-trait bg-white"
              }`}
            >
              <span className="text-base font-extrabold">Je viens chercher</span>
              <span className="text-[13px] text-discret">Itinéraire et code de retrait fournis</span>
            </button>
          )}
          {reponse.livraisonPossible && (
            <button
              type="button"
              aria-pressed={mode === "livraison"}
              onClick={() => setMode("livraison")}
              className={`flex min-h-16 flex-col items-start justify-center rounded-2xl border-[1.5px] px-4 py-2 text-left ${
                mode === "livraison" ? "border-vert bg-vert-clair" : "border-trait bg-white"
              }`}
            >
              <span className="text-base font-extrabold">Livraison</span>
              <span className="text-[13px] text-discret">Le livreur de la pharmacie vient chez vous</span>
            </button>
          )}
        </div>
        {enAttente.length > 0 && (
          <p className="text-[13px] font-semibold text-ambre-fonce">Répondez d&apos;abord à chaque alternative proposée.</p>
        )}
      </Carte>

      <button
        type="button"
        disabled={!peutValider || occupe}
        onClick={() =>
          agir({
            action: "valider",
            mode,
            decisions: Object.entries(decisions).map(([id, accepte]) => ({ id, accepte })),
          })
        }
        className={BOUTON_PRINCIPAL}
      >
        {occupe ? "Envoi…" : "Confirmer ma commande"}
      </button>
      <button
        type="button"
        disabled={occupe}
        onClick={() => {
          if (window.confirm("Chercher une autre pharmacie ?")) agir({ action: "chercher_ailleurs" });
        }}
        className={BOUTON_SECONDAIRE}
      >
        Ça ne me convient pas, chercher ailleurs
      </button>
      <button type="button" onClick={annuler} disabled={occupe} className={BOUTON_DANGER}>
        Annuler ma demande
      </button>
    </>
  );
}

function CodeRemise({ code, mode }: { code: string; mode: "retrait" | "livraison" }) {
  return (
    <Carte titre="Votre code de remise">
      <p className="text-center text-[48px] font-extrabold leading-none tracking-[0.25em]">{code}</p>
      <p className="text-center text-[14px] leading-snug text-discret">
        {mode === "retrait"
          ? "Donnez ce code au pharmacien quand vous récupérez la commande."
          : "Donnez ce code au livreur seulement quand vous avez reçu la commande."}
      </p>
    </Carte>
  );
}

function CommandeEnCours({ suivi }: { suivi: SuiviPatient }) {
  const enRoute = suivi.etat === "en_livraison";
  const reperes = useMemo<Repere[]>(() => {
    const r: Repere[] = [];
    if (suivi.patient.latitude !== null && suivi.patient.longitude !== null) {
      r.push({ latitude: suivi.patient.latitude, longitude: suivi.patient.longitude, couleur: "#14211b", titre: "Vous" });
    }
    if (suivi.pharmacie?.latitude != null && suivi.pharmacie.longitude != null) {
      r.push({ latitude: suivi.pharmacie.latitude, longitude: suivi.pharmacie.longitude, couleur: "#0a6847", titre: suivi.pharmacie.nom });
    }
    if (suivi.livraison?.position) {
      r.push({ latitude: suivi.livraison.position.latitude, longitude: suivi.livraison.position.longitude, couleur: "#b42318", titre: "Livreur" });
    }
    return r;
  }, [suivi.patient.latitude, suivi.patient.longitude, suivi.pharmacie, suivi.livraison?.position]);

  return (
    <>
      <MessageInfo>
        {suivi.mode === "retrait"
          ? "Votre commande est prête. Vous pouvez venir la chercher."
          : enRoute
            ? "Le livreur est en route."
            : "Votre commande est prête, le livreur va partir."}
      </MessageInfo>

      {suivi.mode === "retrait" && <BlocPharmacie suivi={suivi} avecItineraire />}
      {suivi.mode === "livraison" && enRoute && reperes.length > 0 && (
        <Carte titre="Position du livreur">
          {suivi.livraison?.position ? (
            <CarteSimple reperes={reperes} etiquette="Carte de la livraison" />
          ) : (
            <p className="text-[14px] text-discret">Position du livreur en attente…</p>
          )}
          {suivi.livraison?.etat === "arrive" && <Pastille ton="vert">Le livreur est arrivé</Pastille>}
        </Carte>
      )}
      {suivi.mode === "livraison" && !enRoute && <BlocPharmacie suivi={suivi} avecItineraire={false} />}

      {suivi.codeRemise && suivi.mode && <CodeRemise code={suivi.codeRemise} mode={suivi.mode} />}
    </>
  );
}
