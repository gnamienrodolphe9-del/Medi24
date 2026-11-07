"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import CadreAdmin from "@/components/admin/CadreAdmin";
import Champ from "@/components/admin/Champ";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { dansZoneAbidjan } from "@/lib/garde";
import { normaliserTelephoneCi } from "@/lib/telephone";
import type { PharmacieAdmin } from "@/lib/types";

const FORMULAIRE_VIDE = {
  nom: "",
  adresse: "",
  repere: "",
  latitude: "",
  longitude: "",
  telephoneAlerte1: "",
  telephoneAlerte2: "",
  telephonePublic: "",
  numeroOrdre: "",
};

type Formulaire = typeof FORMULAIRE_VIDE;

// Les nombres peuvent être tapés avec une virgule : 5,3364 devient 5.3364.
function versNombre(texte: string): number {
  return Number(texte.trim().replace(",", "."));
}

// Lien de gestion de la pharmacie (planning de garde et historique) : à lui envoyer une fois.
function LienGestion({ jeton }: { jeton: string }) {
  const [copie, setCopie] = useState(false);
  const [qr, setQr] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const adresse = `${window.location.origin}/pharmacie/gardes?j=${jeton}`;

  useEffect(() => {
    if (!qr) return;
    let annule = false;
    QRCode.toDataURL(adresse, { width: 480, margin: 2, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!annule) setImage(url);
      })
      .catch(() => {
        if (!annule) setImage(null);
      });
    return () => {
      annule = true;
    };
  }, [qr, adresse]);
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-fond p-3">
      <p className="text-[12.5px] font-semibold text-discret">Lien de gestion de la pharmacie (secret)</p>
      <p className="break-all text-[12px]">{adresse}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(adresse);
              setCopie(true);
              setTimeout(() => setCopie(false), 2000);
            } catch {
              window.prompt("Copiez ce lien :", adresse);
            }
          }}
          className="min-h-11 rounded-xl border-[1.5px] border-vert bg-white px-3.5 text-sm font-bold text-vert"
        >
          {copie ? "Copié ✓" : "Copier le lien"}
        </button>
        <button
          type="button"
          onClick={() => setQr((v) => !v)}
          aria-expanded={qr}
          className="min-h-11 rounded-xl border-[1.5px] border-vert bg-white px-3.5 text-sm font-bold text-vert"
        >
          {qr ? "Masquer le QR code" : "Afficher le QR code"}
        </button>
      </div>
      {qr && (
        <div className="flex flex-col items-start gap-2">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="QR code du lien de gestion de la pharmacie" width={240} height={240} className="rounded-xl border-[1.5px] border-trait bg-white" />
          ) : (
            <p className="text-[13px] text-discret">Création du QR code…</p>
          )}
          <p className="text-[12.5px] leading-snug text-discret">
            Faites-le scanner par la pharmacie : sa page s&apos;ouvre, puis « Installer et activer les alertes ».
            Ce QR code donne accès à la pharmacie : montrez-le sur votre écran, ne l&apos;imprimez pas.
          </p>
        </div>
      )}
    </div>
  );
}

function ContenuPharmacies() {
  const [pharmacies, setPharmacies] = useState<PharmacieAdmin[]>([]);
  const [chargement, setChargement] = useState(true);
  const [formulaire, setFormulaire] = useState<Formulaire>(FORMULAIRE_VIDE);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [appareils, setAppareils] = useState<Record<string, number>>({});

  const charger = useCallback(async () => {
    const supabase = creerClientNavigateur();
    const { data, error } = await supabase.rpc("admin_lister_pharmacies");
    if (error) {
      setErreur("Impossible de charger les pharmacies : " + error.message);
    } else {
      setPharmacies((data ?? []) as PharmacieAdmin[]);
    }
    // Appareils abonnés aux notifications (absent tant que 0007 n'est pas exécuté : sans gravité).
    const { data: appareilsBd } = await supabase.rpc("admin_appareils_push");
    const table: Record<string, number> = {};
    for (const ligne of (appareilsBd ?? []) as { pharmacie_id: string; appareils: number }[]) {
      table[ligne.pharmacie_id] = Number(ligne.appareils);
    }
    setAppareils(table);
    setChargement(false);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  function modifier(champ: keyof Formulaire) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormulaire((f) => ({ ...f, [champ]: e.target.value }));
  }

  async function creer(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);
    setSucces(null);

    const nom = formulaire.nom.trim();
    if (!nom) {
      setErreur("Le nom de la pharmacie est obligatoire.");
      return;
    }

    const latitude = versNombre(formulaire.latitude);
    const longitude = versNombre(formulaire.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setErreur("La latitude et la longitude doivent être des nombres.");
      return;
    }
    if (!dansZoneAbidjan(latitude, longitude)) {
      setErreur(
        "Ces coordonnées ne sont pas à Abidjan. Pour Yopougon, la latitude est proche de 5,3 et la longitude proche de -4,08 (vérifiez qu'elles ne sont pas inversées)."
      );
      return;
    }

    const tel1 = normaliserTelephoneCi(formulaire.telephoneAlerte1);
    if (!tel1) {
      setErreur(
        "Le numéro d'alerte principal doit avoir 10 chiffres, par exemple 07 00 00 00 00."
      );
      return;
    }

    let tel2 = "";
    if (formulaire.telephoneAlerte2.trim()) {
      const n = normaliserTelephoneCi(formulaire.telephoneAlerte2);
      if (!n) {
        setErreur("Le numéro de secours doit avoir 10 chiffres.");
        return;
      }
      tel2 = n;
    }

    let telPublic = "";
    if (formulaire.telephonePublic.trim()) {
      const n = normaliserTelephoneCi(formulaire.telephonePublic);
      if (!n) {
        setErreur("Le numéro affiché au public doit avoir 10 chiffres.");
        return;
      }
      telPublic = n;
    }

    setEnCours(true);
    try {
      const supabase = creerClientNavigateur();
      const { error } = await supabase.rpc("admin_creer_pharmacie", {
        p_nom: nom,
        p_adresse: formulaire.adresse.trim(),
        p_repere: formulaire.repere.trim(),
        p_latitude: latitude,
        p_longitude: longitude,
        p_telephone_alerte_1: tel1,
        p_telephone_alerte_2: tel2,
        p_telephone_public: telPublic,
        p_numero_ordre: formulaire.numeroOrdre.trim(),
      });
      if (error) {
        setErreur("Création impossible : " + error.message);
        return;
      }
      setFormulaire(FORMULAIRE_VIDE);
      setSucces(
        `${nom} est créée. Elle n'apparaît pas encore au public : validez-la après avoir vérifié son numéro d'ordre.`
      );
      await charger();
    } finally {
      setEnCours(false);
    }
  }

  async function changerStatut(
    pharmacie: PharmacieAdmin,
    valeurs: { validee?: boolean; suspendue?: boolean }
  ) {
    setErreur(null);
    setSucces(null);
    const supabase = creerClientNavigateur();
    const { error } = await supabase
      .from("pharmacies")
      .update(valeurs)
      .eq("id", pharmacie.id);
    if (error) {
      setErreur("Modification impossible : " + error.message);
      return;
    }
    await charger();
  }

  return (
    <div className="flex flex-col gap-6">
      {erreur && (
        <p className="rounded-xl bg-rouge-clair p-3 text-sm font-semibold leading-snug text-[#8e1b12]" role="alert">
          {erreur}
        </p>
      )}
      {succes && (
        <p className="rounded-xl bg-vert-clair p-3 text-sm font-semibold leading-snug text-vert-fonce" role="status">
          {succes}
        </p>
      )}

      <form
        onSubmit={creer}
        className="flex flex-col gap-4 rounded-2xl border-[1.5px] border-trait bg-white p-4"
      >
        <h2 className="text-lg font-extrabold">Nouvelle pharmacie</h2>
        <Champ
          libelle="Nom"
          required
          value={formulaire.nom}
          onChange={modifier("nom")}
        />
        <Champ
          libelle="Adresse"
          value={formulaire.adresse}
          onChange={modifier("adresse")}
        />
        <Champ
          libelle="Repère"
          aide="Un point connu des habitants : carrefour, marché, station."
          value={formulaire.repere}
          onChange={modifier("repere")}
        />
        <div className="grid grid-cols-2 gap-3">
          <Champ
            libelle="Latitude"
            inputMode="decimal"
            required
            placeholder="5,3364"
            value={formulaire.latitude}
            onChange={modifier("latitude")}
          />
          <Champ
            libelle="Longitude"
            inputMode="decimal"
            required
            placeholder="-4,0867"
            value={formulaire.longitude}
            onChange={modifier("longitude")}
          />
        </div>
        <p className="-mt-2 text-[12.5px] leading-snug text-discret">
          Pour trouver les coordonnées : dans Google Maps, appuyez longuement sur
          la pharmacie, les deux nombres s&apos;affichent en haut.
        </p>
        <Champ
          libelle="Numéro d'alerte principal"
          aide="Reçoit les SMS de demande. 10 chiffres."
          type="tel"
          required
          placeholder="07 00 00 00 00"
          value={formulaire.telephoneAlerte1}
          onChange={modifier("telephoneAlerte1")}
        />
        <Champ
          libelle="Numéro de secours (facultatif)"
          type="tel"
          value={formulaire.telephoneAlerte2}
          onChange={modifier("telephoneAlerte2")}
        />
        <Champ
          libelle="Numéro affiché au public (facultatif)"
          aide="Celui que les patients appellent depuis l'annuaire."
          type="tel"
          value={formulaire.telephonePublic}
          onChange={modifier("telephonePublic")}
        />
        <Champ
          libelle="Numéro d'ordre (facultatif)"
          value={formulaire.numeroOrdre}
          onChange={modifier("numeroOrdre")}
        />
        <button
          type="submit"
          disabled={enCours}
          className="min-h-14 rounded-2xl bg-vert text-lg font-extrabold text-white disabled:opacity-60"
        >
          {enCours ? "Création…" : "Créer la pharmacie"}
        </button>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold">
          Pharmacies enregistrées ({pharmacies.length})
        </h2>
        {chargement && <p className="text-base text-discret">Chargement…</p>}
        {!chargement && pharmacies.length === 0 && (
          <p className="text-base text-discret">Aucune pharmacie pour le moment.</p>
        )}
        <ul className="flex flex-col gap-3">
          {pharmacies.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-trait bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[17px] font-extrabold leading-tight">
                    <Link href={`/admin/pharmacies/${p.id}`} className="underline decoration-trait underline-offset-4">{p.nom}</Link>
                  </h3>
                  <p className="mt-1 text-[13px] text-discret">
                    {[p.adresse, p.repere].filter(Boolean).join(" · ") || "Adresse non renseignée"}
                  </p>
                </div>
                {p.suspendue ? (
                  <span className="whitespace-nowrap rounded-xl bg-rouge-clair px-2.5 py-1 text-[13px] font-bold text-[#8e1b12]">
                    Suspendue
                  </span>
                ) : p.validee ? (
                  <span className="whitespace-nowrap rounded-xl bg-vert-clair px-2.5 py-1 text-[13px] font-bold text-vert-fonce">
                    Validée
                  </span>
                ) : (
                  <span className="whitespace-nowrap rounded-xl bg-ambre px-2.5 py-1 text-[13px] font-bold text-ambre-fonce">
                    À valider
                  </span>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
                <dt className="text-discret">Alerte</dt>
                <dd className="font-semibold">{p.telephone_alerte_1}</dd>
                <dt className="text-discret">Secours</dt>
                <dd className="font-semibold">{p.telephone_alerte_2 ?? "—"}</dd>
                <dt className="text-discret">Public</dt>
                <dd className="font-semibold">{p.telephone_public ?? "—"}</dd>
                <dt className="text-discret">N° d&apos;ordre</dt>
                <dd className="font-semibold">{p.numero_ordre ?? "—"}</dd>
              </dl>

              <p className="text-[13px] leading-snug text-discret">
                {appareils[p.id]
                  ? `Notifications : ${appareils[p.id]} appareil${appareils[p.id] > 1 ? "s" : ""} abonné${appareils[p.id] > 1 ? "s" : ""}.`
                  : "Notifications : aucun appareil abonné (la pharmacie n'a pas encore activé les alertes)."}
                {" "}
                {p.service_jour === undefined
                  ? ""
                  : p.service_jour
                    ? `Service de jour : oui (${p.jour_debut}–${p.jour_fin}).`
                    : "Service de jour : en pause."}
              </p>

              <LienGestion jeton={p.jeton_gestion} />

              <div className="flex flex-wrap gap-2">
                {!p.validee && (
                  <button
                    type="button"
                    onClick={() => changerStatut(p, { validee: true })}
                    className="min-h-11 rounded-xl bg-vert px-4 text-sm font-bold text-white"
                  >
                    Valider
                  </button>
                )}
                {p.validee && (
                  <button
                    type="button"
                    onClick={() => changerStatut(p, { validee: false })}
                    className="min-h-11 rounded-xl border-[1.5px] border-[#76837b] bg-white px-4 text-sm font-bold"
                  >
                    Retirer la validation
                  </button>
                )}
                {p.suspendue ? (
                  <button
                    type="button"
                    onClick={() => changerStatut(p, { suspendue: false })}
                    className="min-h-11 rounded-xl border-[1.5px] border-vert bg-white px-4 text-sm font-bold text-vert"
                  >
                    Réactiver
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => changerStatut(p, { suspendue: true })}
                    className="min-h-11 rounded-xl border-[1.5px] border-rouge bg-white px-4 text-sm font-bold text-rouge"
                  >
                    Suspendre
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function PagePharmacies() {
  return (
    <CadreAdmin titre="Pharmacies">
      <ContenuPharmacies />
    </CadreAdmin>
  );
}
