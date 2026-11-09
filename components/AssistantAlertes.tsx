"use client";

import { useEffect, useState } from "react";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, Carte } from "@/components/ui";
import { useInstallation } from "@/lib/client/installation";
import { VERSION_APP } from "@/lib/version";
import {
  activerPush,
  desactiverPush,
  essayerPush,
  lireEtatPush,
  pushConfigure,
  rafraichirAbonnement,
  type EtatPush,
  type GenrePage,
} from "@/lib/client/push";

type Role = "pharmacie" | "patient" | "livreur";

const TEXTES: Record<Role, { titre: string; explication: string }> = {
  pharmacie: {
    titre: "Recevoir les demandes sur cet appareil",
    explication:
      "Deux étapes, une seule fois : installer Medi24, puis activer les alertes. Chaque demande de patient arrive alors sur cette page, avec une notification qui sonne même écran verrouillé. Le SMS part en même temps, en secours.",
  },
  patient: {
    titre: "Être prévenu dès qu'une pharmacie répond",
    explication:
      "Installez Medi24 et activez les alertes : vous êtes prévenu même si vous quittez cette page ou éteignez l'écran.",
  },
  livreur: {
    titre: "Être prévenu quand la commande est prête",
    explication:
      "Installez Medi24 et activez les alertes : vous êtes prévenu même si vous quittez cette page.",
  },
};

// Guide « une seule fois » : installe l'application sur l'appareil (téléphone ou ordinateur) et
// active les notifications, sans que la personne ait à chercher comment faire.
export default function AssistantAlertes({
  genre,
  jeton,
  role,
}: {
  genre: GenrePage;
  jeton: string;
  role: Role;
}) {
  const installation = useInstallation();
  const [push, setPush] = useState<EtatPush>("inconnu");
  const [occupe, setOccupe] = useState(false);
  const [aideInstallation, setAideInstallation] = useState(false);
  const [message, setMessage] = useState<{ ton: "info" | "erreur"; texte: string } | null>(null);
  const cles = pushConfigure();

  useEffect(() => {
    let annule = false;
    lireEtatPush().then((etat) => {
      if (annule) return;
      setPush(etat);
      if (etat === "actif") void rafraichirAbonnement(genre, jeton);
    });
    return () => {
      annule = true;
    };
  }, [genre, jeton]);

  // Activation automatique : dès l'ouverture, on demande l'autorisation des notifications, sans
  // attendre un clic. (Le navigateur affiche sa propre fenêtre « Autoriser » : il est impossible de
  // l'accepter à la place de la personne.) Une seule tentative par ouverture ; le bouton reste
  // disponible si la personne a refusé ou si le navigateur exige un toucher (iPhone).
  const { pret, ios: iosDetecte, installee: installeeDetectee } = installation;
  useEffect(() => {
    if (!pret || !cles || push !== "inactif") return;
    if (iosDetecte && !installeeDetectee) return;
    try {
      const cle = `medi24-auto-${genre}`;
      if (sessionStorage.getItem(cle)) return;
      sessionStorage.setItem(cle, "1");
    } catch {
      // Sans mémoire de session, on tente quand même une fois par rendu : sans gravité.
    }
    void (async () => {
      const r = await activerPush(genre, jeton);
      setPush(r.ok ? "actif" : await lireEtatPush());
    })();
  }, [pret, cles, push, iosDetecte, installeeDetectee, genre, jeton]);

  if (!installation.pret) return null;

  const { installee, installable, ios, android, integre } = installation;
  const texte = TEXTES[role];
  const alertesActives = push === "actif";
  // Application installée et alertes actives : plus rien à faire, l'encart disparaît pour laisser
  // la place au reste de la page. Il ne reste qu'une ligne discrète.
  const toutEstPret = installee && alertesActives;

  async function installerApp() {
    setMessage(null);
    if (installable) {
      const r = await installation.installer();
      // Le navigateur n'a pas ouvert sa fenêtre : on montre comment installer à la main.
      if (r === "indisponible") setAideInstallation(true);
    } else {
      setAideInstallation(true);
    }
  }

  async function activer() {
    setOccupe(true);
    setMessage(null);
    const r = await activerPush(genre, jeton);
    if (r.ok) {
      setPush("actif");
      setMessage({ ton: "info", texte: "Alertes activées. Touchez « Essayer » pour vérifier." });
    } else {
      setPush(await lireEtatPush());
      setMessage({ ton: "erreur", texte: r.message });
    }
    setOccupe(false);
  }

  async function essayer() {
    setOccupe(true);
    const r = await essayerPush(genre, jeton);
    setMessage({ ton: r.ok ? "info" : "erreur", texte: r.message });
    setOccupe(false);
  }

  async function desactiver() {
    setOccupe(true);
    await desactiverPush(genre, jeton);
    setPush("inactif");
    setMessage(null);
    setOccupe(false);
  }

  if (toutEstPret) {
    return (
      <p className="text-center text-[12.5px] text-discret" role="status">
        ✓ Les alertes et notifications sont activées · {VERSION_APP}
      </p>
    );
  }

  return (
    <Carte titre={texte.titre}>
      <p className="text-[15px] leading-snug text-discret">{texte.explication}</p>

      {/* ÉTAPE 1 : installer l'application */}
      <div className="flex flex-col gap-2">
        <p className={`text-[15px] font-bold ${installee ? "text-vert-fonce" : ""}`}>
          {installee ? "✓ 1. Application installée" : "1. Installer l'application"}
        </p>

        {!installee && integre && (
          <p className="rounded-xl bg-ambre p-3 text-sm font-semibold leading-snug text-ambre-fonce">
            Vous êtes dans le navigateur d&apos;une autre application. Ouvrez ce lien dans <strong>Chrome</strong> (menu ⋮,
            puis « Ouvrir dans le navigateur ») pour pouvoir installer Medi24.
          </p>
        )}

        {!installee && ios && (
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[15px] leading-snug">
            <li>
              Touchez le bouton <strong>Partager</strong> (le carré avec une flèche) en bas de Safari.
            </li>
            <li>
              Choisissez <strong>« Sur l&apos;écran d&apos;accueil »</strong>, puis <strong>Ajouter</strong>.
            </li>
            <li>
              Ouvrez <strong>Medi24</strong> depuis votre écran d&apos;accueil : l&apos;étape 2 s&apos;y active.
            </li>
          </ol>
        )}

        {!installee && !ios && (
          <button type="button" onClick={installerApp} className={BOUTON_PRINCIPAL}>
            Installer l&apos;application
          </button>
        )}

        {!installee && !ios && (aideInstallation || !installable) && (
          <div className="rounded-xl bg-fond p-3 text-[14px] leading-snug">
            <p className="font-bold">
              {installable ? "Si rien ne s'ouvre, installez à la main :" : "Installez à la main :"}
            </p>
            {android ? (
              <p className="mt-1">
                Touchez les trois points <strong>⋮</strong> en haut à droite de Chrome, puis{" "}
                <strong>« Installer l&apos;application »</strong> (ou « Ajouter à l&apos;écran d&apos;accueil »).
              </p>
            ) : (
              <p className="mt-1">
                Sur ordinateur (Chrome ou Edge) : cliquez sur l&apos;icône d&apos;installation à droite de la barre d&apos;adresse
                (un écran avec une flèche), ou sur le menu <strong>⋮</strong>, puis <strong>« Installer Medi24 »</strong>.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ÉTAPE 2 : activer les alertes */}
      <div className="flex flex-col gap-2">
        <p
          className={`text-[15px] font-bold ${alertesActives ? "text-vert-fonce" : push === "bloque" ? "text-rouge" : ""}`}
        >
          {alertesActives
            ? "✓ Les alertes et notifications sont activées"
            : push === "bloque"
              ? "✕ 2. Alertes bloquées dans le navigateur"
              : "2. Activer les alertes"}
        </p>

        {!cles && (
          <p className="text-[13px] leading-snug text-discret">
            Les notifications ne sont pas encore configurées sur ce site (clés manquantes). Vous pouvez quand même
            installer l&apos;application.
          </p>
        )}

        {cles && push === "bloque" && (
          <p className="text-[14px] leading-snug text-discret">
            Pour les débloquer : touchez le cadenas à côté de l&apos;adresse du site, ouvrez « Notifications » et choisissez
            « Autoriser ». Puis rechargez la page.
          </p>
        )}

        {cles && ios && !installee && !alertesActives && (
          <p className="text-[13px] leading-snug text-discret">
            Sur iPhone, les alertes ne s&apos;activent qu&apos;après l&apos;installation (étape 1).
          </p>
        )}

        {cles && !alertesActives && push !== "bloque" && !(ios && !installee) && (
          <button
            type="button"
            onClick={activer}
            disabled={occupe}
            className={installee || ios ? BOUTON_PRINCIPAL : BOUTON_SECONDAIRE}
          >
            {occupe ? "Un instant…" : "Activer les alertes"}
          </button>
        )}

        {alertesActives && (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={essayer} disabled={occupe} className={BOUTON_SECONDAIRE}>
              Essayer
            </button>
            <button type="button" onClick={desactiver} disabled={occupe} className={BOUTON_SECONDAIRE}>
              Désactiver
            </button>
          </div>
        )}
      </div>

      <p className="text-[11.5px] text-discret">Version {VERSION_APP}</p>

      {message && (
        <p
          className={`rounded-xl p-3 text-sm font-semibold leading-snug ${
            message.ton === "info" ? "bg-vert-clair text-vert-fonce" : "bg-rouge-clair text-rouge-fonce"
          }`}
          role={message.ton === "erreur" ? "alert" : "status"}
        >
          {message.texte}
        </p>
      )}
    </Carte>
  );
}
