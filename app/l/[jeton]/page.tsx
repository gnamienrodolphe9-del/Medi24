"use client";

import AssistantAlertes from "@/components/AssistantAlertes";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import CarteSimple, { type Repere } from "@/components/CarteSimple";
import {
  BOUTON_PRINCIPAL,
  BOUTON_SECONDAIRE,
  CHAMP,
  Carte,
  Chargement,
  MessageAttention,
  MessageErreur,
  MessageInfo,
} from "@/components/ui";
import { envoyerJson, useSondage } from "@/lib/client/api";
import { lienItineraire } from "@/lib/garde";

type VueLivreur = {
  etat: "creee" | "parti" | "arrive" | "remis";
  terminee: boolean;
  annulee: boolean;
  commandePrete: boolean;
  codeBloque: boolean;
  pharmacie: {
    nom: string;
    adresse: string | null;
    repere: string | null;
    telephone: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  patient: {
    repere: string | null;
    telephone: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
};

const INTERVALLE_POSITION_MS = 8000;

// Page du livreur : ouverte depuis le lien reçu par SMS, sans compte ni installation.
export default function PageLivreur() {
  const { jeton } = useParams<{ jeton: string }>();
  const { donnees: vue, erreur, statut, chargement, rafraichir } = useSondage<VueLivreur>(
    `/api/livreur/${jeton}`,
    5000
  );
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [code, setCode] = useState("");
  const [gps, setGps] = useState<"inactif" | "ok" | "refuse">("inactif");
  const derniereEnvoi = useRef(0);

  const enRoute = vue?.etat === "parti" || vue?.etat === "arrive";

  // Partage de la position pendant la course, avec écran maintenu allumé si possible.
  useEffect(() => {
    if (!enRoute || !("geolocation" in navigator)) return;
    let verrou: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    nav.wakeLock?.request("screen").then((v) => (verrou = v)).catch(() => undefined);

    const surveillance = navigator.geolocation.watchPosition(
      (p) => {
        setGps("ok");
        const maintenant = Date.now();
        if (maintenant - derniereEnvoi.current < INTERVALLE_POSITION_MS) return;
        derniereEnvoi.current = maintenant;
        void envoyerJson(`/api/livreur/${jeton}`, {
          action: "position",
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
        });
      },
      () => setGps("refuse"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => {
      navigator.geolocation.clearWatch(surveillance);
      verrou?.release().catch(() => undefined);
    };
  }, [enRoute, jeton]);

  async function agir(corps: Record<string, unknown>) {
    setErreurAction(null);
    setOccupe(true);
    const r = await envoyerJson(`/api/livreur/${jeton}`, corps);
    setOccupe(false);
    if (!r.ok) {
      setErreurAction(r.erreur);
      return;
    }
    await rafraichir();
  }

  const reperes = useMemo<Repere[]>(() => {
    const r: Repere[] = [];
    if (vue?.pharmacie?.latitude != null && vue.pharmacie.longitude != null) {
      r.push({ latitude: vue.pharmacie.latitude, longitude: vue.pharmacie.longitude, couleur: "#0a6847", titre: "Pharmacie" });
    }
    if (vue?.patient?.latitude != null && vue.patient.longitude != null) {
      r.push({ latitude: vue.patient.latitude, longitude: vue.patient.longitude, couleur: "#14211b", titre: "Patient" });
    }
    return r;
  }, [vue?.pharmacie, vue?.patient]);

  return (
    <main className="flex min-h-screen flex-col gap-4 px-5 pb-10 pt-5">
      <header className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-vert">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <span className="text-[22px] font-extrabold tracking-tight">Medi24 · Livraison</span>
      </header>

      {chargement && <Chargement />}
      {statut === 404 && <MessageErreur>Ce lien n&apos;est pas valide.</MessageErreur>}
      {erreur && statut !== 404 && !vue && <MessageErreur>{erreur}</MessageErreur>}
      {erreurAction && <MessageErreur>{erreurAction}</MessageErreur>}

      {vue?.annulee && <MessageAttention>Cette commande a été annulée. Ne livrez rien.</MessageAttention>}
      {vue?.etat === "remis" && <MessageInfo>Livraison terminée. Merci ! Votre position n&apos;est plus partagée.</MessageInfo>}

      {vue && !vue.terminee && !vue.annulee && (
        <>
          {vue.pharmacie && (
            <Carte titre={`1. Récupérer chez ${vue.pharmacie.nom}`}>
              <p className="text-[14px] leading-snug text-discret">
                {[vue.pharmacie.adresse, vue.pharmacie.repere].filter(Boolean).join(" · ")}
              </p>
              <div className="flex gap-2">
                {vue.pharmacie.telephone && (
                  <a href={`tel:${vue.pharmacie.telephone}`} className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-vert px-3 text-base font-bold text-white">
                    Appeler
                  </a>
                )}
                {vue.pharmacie.latitude != null && vue.pharmacie.longitude != null && (
                  <a href={lienItineraire(vue.pharmacie.latitude, vue.pharmacie.longitude)} target="_blank" rel="noopener noreferrer" className="flex min-h-12 flex-1 items-center justify-center rounded-xl border-[1.5px] border-vert bg-white px-3 text-base font-bold text-vert">
                    Itinéraire
                  </a>
                )}
              </div>
            </Carte>
          )}

          {vue.etat === "creee" && (
            <>
              {!vue.commandePrete && <MessageAttention>La pharmacie prépare la commande. Ce bouton s&apos;activera quand elle sera prête.</MessageAttention>}
              <button type="button" disabled={!vue.commandePrete || occupe} onClick={() => agir({ action: "parti" })} className={BOUTON_PRINCIPAL}>
                J&apos;ai la commande : je pars
              </button>
              <p className="text-[12.5px] leading-snug text-discret">
                En partant, vous acceptez de partager votre position avec le patient jusqu&apos;à la remise. Elle est supprimée ensuite.
              </p>
            </>
          )}

          {enRoute && vue.patient && (
            <>
              <Carte titre="2. Livrer le patient">
                {vue.patient.repere && <p className="text-[15px] font-semibold leading-snug">Repère : {vue.patient.repere}</p>}
                <div className="flex gap-2">
                  <a href={`tel:${vue.patient.telephone}`} className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-vert px-3 text-base font-bold text-white">
                    Appeler le patient
                  </a>
                  {vue.patient.latitude != null && vue.patient.longitude != null && (
                    <a href={lienItineraire(vue.patient.latitude, vue.patient.longitude)} target="_blank" rel="noopener noreferrer" className="flex min-h-12 flex-1 items-center justify-center rounded-xl border-[1.5px] border-vert bg-white px-3 text-base font-bold text-vert">
                      Itinéraire
                    </a>
                  )}
                </div>
                {reperes.length > 0 && <CarteSimple reperes={reperes} etiquette="Carte de la livraison" hauteur="h-52" />}
                {gps === "refuse" && (
                  <MessageAttention>Position non partagée : autorisez la position dans les réglages du téléphone pour que le patient vous voie.</MessageAttention>
                )}
              </Carte>

              {vue.etat === "parti" && (
                <button type="button" disabled={occupe} onClick={() => agir({ action: "arrive" })} className={BOUTON_SECONDAIRE}>
                  Je suis arrivé
                </button>
              )}

              <Carte titre="3. Remise : code du patient">
                {vue.codeBloque ? (
                  <MessageErreur>Trop d&apos;essais. Contactez la pharmacie.</MessageErreur>
                ) : (
                  <>
                    <p className="text-[14px] leading-snug text-discret">Demandez au patient son code à 4 chiffres, puis saisissez-le.</p>
                    <input inputMode="numeric" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className={`${CHAMP} text-center text-3xl font-extrabold tracking-[0.4em]`} aria-label="Code du patient" />
                    <button type="button" disabled={occupe || code.length !== 4} onClick={() => agir({ action: "remis", code })} className={BOUTON_PRINCIPAL}>
                      Valider la remise
                    </button>
                  </>
                )}
              </Carte>
            </>
          )}
        </>
      )}

      {vue && !vue.terminee && !vue.annulee && <AssistantAlertes genre="livreur" jeton={jeton} role="livreur" />}
    </main>
  );
}
