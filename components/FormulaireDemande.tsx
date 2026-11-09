"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { appeler, envoyerJson } from "@/lib/client/api";
import { compresserImage } from "@/lib/client/image";
import { memoriserDemande } from "@/lib/client/memoire";
import { lirePosition, type PositionSimple } from "@/lib/client/position";
import { LIMITES, validerDemande, type TypeDemande } from "@/lib/validation";
import { NUMERO_SAMU } from "@/lib/urgence";
import {
  BOUTON_PRINCIPAL,
  BOUTON_SECONDAIRE,
  CHAMP,
  Carte,
  MessageAttention,
  MessageErreur,
  MessageInfo,
} from "@/components/ui";

const TYPES: { id: TypeDemande; titre: string; aide: string }[] = [
  { id: "medicament", titre: "Un médicament", aide: "Je connais le nom" },
  { id: "ordonnance", titre: "Mon ordonnance", aide: "Photo ou import" },
  { id: "symptomes", titre: "Mes symptômes", aide: "Je ne connais pas le nom" },
];

export default function FormulaireDemande() {
  const routeur = useRouter();
  const [type, setType] = useState<TypeDemande>("medicament");
  const [produits, setProduits] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [preparationPhoto, setPreparationPhoto] = useState(false);
  const [symptomes, setSymptomes] = useState("");
  const [age, setAge] = useState("");
  const [poids, setPoids] = useState("");
  const [grossesse, setGrossesse] = useState(false);
  const [allergies, setAllergies] = useState("");
  const [traitements, setTraitements] = useState("");
  const [position, setPosition] = useState<PositionSimple | null>(null);
  const [messagePosition, setMessagePosition] = useState<string | null>(null);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  const [repere, setRepere] = useState("");
  const [telephone, setTelephone] = useState("");
  const [codeEnvoye, setCodeEnvoye] = useState(false);
  const [code, setCode] = useState("");
  const [codeDev, setCodeDev] = useState<string | null>(null);
  const [envoiCode, setEnvoiCode] = useState(false);
  const [consentement, setConsentement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Libère l'aperçu de la photo quand elle change.
  useEffect(() => {
    if (!photo) {
      setApercu(null);
      return;
    }
    const adresse = URL.createObjectURL(photo);
    setApercu(adresse);
    return () => URL.revokeObjectURL(adresse);
  }, [photo]);

  const listeProduits = useMemo(
    () => produits.split("\n").map((l) => l.trim()).filter(Boolean),
    [produits]
  );

  async function choisirPhoto(evenement: React.ChangeEvent<HTMLInputElement>) {
    const fichier = evenement.target.files?.[0];
    // Permet de choisir deux fois de suite la même photo (sinon le navigateur ne réagit pas).
    evenement.target.value = "";
    if (!fichier) return;
    setErreur(null);
    setPreparationPhoto(true);
    try {
      setPhoto(await compresserImage(fichier));
    } catch (e) {
      setPhoto(null);
      setErreur(e instanceof Error ? e.message : "Photo illisible.");
    } finally {
      setPreparationPhoto(false);
    }
  }

  async function utiliserPosition() {
    setMessagePosition(null);
    setRechercheEnCours(true);
    try {
      setPosition(await lirePosition());
      setMessagePosition("Position trouvée.");
    } catch (e) {
      setPosition(null);
      setMessagePosition(e instanceof Error ? e.message : "Position introuvable.");
    } finally {
      setRechercheEnCours(false);
    }
  }

  function entree() {
    return {
      type,
      telephone,
      produits: listeProduits,
      texteLibre: symptomes,
      age,
      poidsKg: poids,
      grossesse,
      allergies,
      traitements,
      consentement,
      latitude: position?.latitude ?? null,
      longitude: position?.longitude ?? null,
      repere,
      avecOrdonnance: photo !== null,
    };
  }

  async function recevoirCode() {
    setErreur(null);
    const verification = validerDemande(entree());
    // Le consentement et le code se règlent juste après : on bloque seulement le reste.
    if (!verification.ok) {
      const bloquantes = verification.erreurs.filter((e) => !e.includes("accepter l'utilisation"));
      if (bloquantes.length > 0) {
        setErreur(bloquantes.join(" "));
        return;
      }
    }
    setEnvoiCode(true);
    const r = await envoyerJson<{ codeDev?: string }>("/api/telephone/code", { telephone });
    setEnvoiCode(false);
    if (!r.ok) {
      setErreur(r.erreur);
      return;
    }
    setCodeEnvoye(true);
    setCodeDev(r.donnees.codeDev ?? null);
  }

  async function envoyer(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);
    const verification = validerDemande(entree());
    if (!verification.ok) {
      setErreur(verification.erreurs.join(" "));
      return;
    }
    if (!/^\d{5}$/.test(code.trim())) {
      setErreur("Entrez le code à 5 chiffres reçu par SMS.");
      return;
    }

    setEnCours(true);
    const formulaire = new FormData();
    formulaire.set(
      "donnees",
      JSON.stringify({ ...entree(), code: code.trim(), photo: undefined, avecOrdonnance: undefined })
    );
    if (photo) formulaire.set("ordonnance", photo);

    const r = await appeler<{ jeton: string }>("/api/demandes", { method: "POST", body: formulaire });
    if (!r.ok) {
      setEnCours(false);
      setErreur(r.erreur);
      return;
    }
    memoriserDemande(r.donnees.jeton);
    routeur.push(`/suivi/${r.donnees.jeton}`);
  }

  return (
    <form onSubmit={envoyer} className="flex flex-col gap-5">
      <div role="tablist" aria-label="Type de demande" className="grid grid-cols-3 gap-2">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={type === t.id}
            onClick={() => setType(t.id)}
            className={`flex min-h-20 flex-col items-center justify-center gap-0.5 rounded-2xl border-[1.5px] px-1.5 py-2 text-center ${
              type === t.id ? "border-vert bg-vert-clair text-vert-fonce" : "border-trait bg-white"
            }`}
          >
            <span className="text-[15px] font-extrabold leading-tight">{t.titre}</span>
            <span className="text-[12px] leading-tight text-discret">{t.aide}</span>
          </button>
        ))}
      </div>

      {type === "medicament" && (
        <Carte titre="Quels médicaments ?">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Un produit par ligne
            <textarea
              value={produits}
              onChange={(e) => setProduits(e.target.value)}
              rows={4}
              placeholder={"Doliprane 1000\nAmoxicilline 500 x2"}
              className={CHAMP}
            />
            <span className="text-[12.5px] font-normal leading-snug text-discret">
              Nom du médicament ou de la molécule. Pour plusieurs boîtes, ajoutez « x2 ». {LIMITES.produitsMax} produits au plus.
            </span>
          </label>
        </Carte>
      )}

      {type === "ordonnance" && (
        <Carte titre="Photo de l'ordonnance">
          <p className="text-sm font-semibold">Photo bien à plat, avec de la lumière</p>
          <div className="grid grid-cols-2 gap-3">
            {/* Deux entrées distinctes : « capture » ouvre directement l'appareil photo,
                sans « capture » le téléphone propose la galerie et les fichiers. */}
            <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-vert px-3 text-center text-[15px] font-bold text-white focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-vert">
              Prendre une photo
              <input type="file" accept="image/*" capture="environment" onChange={choisirPhoto} className="sr-only" />
            </label>
            <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-[1.5px] border-vert bg-white px-3 text-center text-[15px] font-bold text-vert focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-vert">
              Importer une photo
              <input type="file" accept="image/*" onChange={choisirPhoto} className="sr-only" />
            </label>
          </div>
          {preparationPhoto && <p className="text-sm text-discret">Préparation de la photo…</p>}
          {apercu && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={apercu} alt="Aperçu de l'ordonnance" className="max-h-64 w-full rounded-xl border-[1.5px] border-trait object-contain" />
          )}
          <MessageAttention>
            Votre ordonnance est vue seulement par les pharmacies alertées. Elle est effacée 90 jours après la remise.
          </MessageAttention>
        </Carte>
      )}

      {type === "symptomes" && (
        <Carte titre="Vos symptômes">
          <MessageAttention>
            Si la personne respire mal, est inconsciente, saigne beaucoup ou convulse :{" "}
            <Link href="/urgence" className="underline">
              ouvrez l&apos;espace Urgence
            </Link>{" "}
            ou appelez le {NUMERO_SAMU}.
          </MessageAttention>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Que ressent la personne ?
            <textarea
              value={symptomes}
              onChange={(e) => setSymptomes(e.target.value)}
              rows={4}
              maxLength={LIMITES.symptomesMax}
              placeholder="Ex. : fièvre depuis hier soir, maux de tête, frissons"
              className={CHAMP}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Âge
              <input value={age} onChange={(e) => setAge(e.target.value)} placeholder="34 ans" maxLength={40} className={CHAMP} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Poids (kg)
              <input value={poids} onChange={(e) => setPoids(e.target.value)} inputMode="decimal" placeholder="Facultatif" className={CHAMP} />
            </label>
          </div>
          <label className="flex min-h-12 items-center gap-3 text-[15px] font-semibold">
            <input type="checkbox" checked={grossesse} onChange={(e) => setGrossesse(e.target.checked)} className="h-6 w-6 accent-vert" />
            La personne est enceinte
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Allergies connues (facultatif)
            <input value={allergies} onChange={(e) => setAllergies(e.target.value)} maxLength={LIMITES.champCourtMax} className={CHAMP} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Traitements en cours (facultatif)
            <input value={traitements} onChange={(e) => setTraitements(e.target.value)} maxLength={LIMITES.champCourtMax} className={CHAMP} />
          </label>
          <p className="text-[12.5px] leading-snug text-discret">
            Le pharmacien vous donnera son avis. Medi24 ne pose pas de diagnostic.
          </p>
        </Carte>
      )}

      <Carte titre="Où êtes-vous ?">
        <button type="button" onClick={utiliserPosition} disabled={rechercheEnCours} className={BOUTON_SECONDAIRE}>
          {rechercheEnCours ? "Recherche…" : position ? "Position trouvée ✓ (actualiser)" : "Utiliser ma position"}
        </button>
        {messagePosition && <p className="text-sm text-discret">{messagePosition}</p>}
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Repère {position ? "(facultatif)" : ""}
          <input
            value={repere}
            onChange={(e) => setRepere(e.target.value)}
            maxLength={LIMITES.repereMax}
            placeholder="Quartier, carrefour, maison de couleur…"
            className={CHAMP}
          />
        </label>
      </Carte>

      <Carte titre="Votre numéro">
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
          <button type="button" onClick={recevoirCode} disabled={envoiCode} className={BOUTON_SECONDAIRE}>
            {envoiCode ? "Envoi…" : "Recevoir un code par SMS"}
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
            <button type="button" onClick={recevoirCode} disabled={envoiCode} className="min-h-11 text-sm font-semibold text-vert underline">
              Renvoyer le code
            </button>
          </>
        )}
      </Carte>

      <label className="flex items-start gap-3 text-[14px] leading-snug">
        <input
          type="checkbox"
          checked={consentement}
          onChange={(e) => setConsentement(e.target.checked)}
          className="mt-0.5 h-6 w-6 shrink-0 accent-vert"
        />
        <span>
          J&apos;accepte que Medi24 transmette ma demande, ma position et mon numéro aux pharmacies de garde pour me répondre. Je comprends que Medi24 n&apos;est pas un avis médical : le pharmacien décide de ce qu&apos;il me remet.
        </span>
      </label>

      {erreur && <MessageErreur>{erreur}</MessageErreur>}

      <button type="submit" disabled={enCours || !codeEnvoye} className={BOUTON_PRINCIPAL}>
        {enCours ? "Envoi aux pharmacies…" : "Envoyer ma demande"}
      </button>
      {!codeEnvoye && (
        <p className="-mt-3 text-center text-[13px] text-discret">
          Recevez d&apos;abord le code par SMS pour pouvoir envoyer.
        </p>
      )}
    </form>
  );
}
