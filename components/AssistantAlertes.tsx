"use client";

import { useEffect, useState } from "react";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, Carte } from "@/components/ui";
import { associerManifeste, useInstallation } from "@/lib/client/installation";
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
      "Installez Medi24 et activez les alertes : chaque demande de patient sonne ici, même quand la page est fermée. Le SMS part aussi, en secours.",
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
  const [message, setMessage] = useState<{ ton: "info" | "erreur"; texte: string } | null>(null);

  // L'icône installée doit rouvrir la page de cette personne (avec son jeton).
  useEffect(() => {
    associerManifeste();
  }, []);

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

  // Les clés des notifications ne sont pas configurées sur ce site : l'assistant reste caché.
  if (!pushConfigure() || !installation.pret) return null;

  const { installee, installable, ios } = installation;
  const texte = TEXTES[role];

  async function lancer() {
    setOccupe(true);
    setMessage(null);
    // Si le navigateur propose l'installation, on la présente d'abord, puis on active les alertes.
    if (!installee && installable) await installation.installer();
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

  const alertesActives = push === "actif";
  // Sur iPhone, les notifications ne fonctionnent qu'une fois l'application installée.
  const iosAInstaller = ios && !installee && !alertesActives;

  return (
    <Carte titre={alertesActives && installee ? "Alertes activées sur cet appareil" : texte.titre}>
      {!(alertesActives && installee) && (
        <p className="text-[15px] leading-snug text-discret">{texte.explication}</p>
      )}

      <ul className="flex flex-col gap-1.5 text-[15px] font-semibold" aria-label="État de cet appareil">
        <li className={installee ? "text-vert-fonce" : "text-discret"}>
          {installee ? "✓ Application installée" : "○ Application pas encore installée"}
        </li>
        <li className={alertesActives ? "text-vert-fonce" : push === "bloque" ? "text-rouge" : "text-discret"}>
          {alertesActives
            ? "✓ Alertes activées"
            : push === "bloque"
              ? "✕ Alertes bloquées dans le navigateur"
              : "○ Alertes pas encore activées"}
        </li>
      </ul>

      {iosAInstaller && (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[15px] leading-snug">
          <li>
            Touchez le bouton <strong>Partager</strong> (le carré avec une flèche) en bas de Safari.
          </li>
          <li>
            Choisissez <strong>« Sur l&apos;écran d&apos;accueil »</strong>, puis <strong>Ajouter</strong>.
          </li>
          <li>
            Ouvrez <strong>Medi24</strong> depuis votre écran d&apos;accueil, puis touchez{" "}
            <strong>« Activer les alertes »</strong>.
          </li>
        </ol>
      )}

      {push === "bloque" && (
        <p className="text-[14px] leading-snug text-discret">
          Pour les débloquer : touchez le cadenas à côté de l&apos;adresse du site, ouvrez « Notifications » et choisissez
          « Autoriser ». Puis rechargez la page.
        </p>
      )}

      {!alertesActives && !iosAInstaller && push !== "bloque" && (
        <button type="button" onClick={lancer} disabled={occupe} className={BOUTON_PRINCIPAL}>
          {occupe ? "Un instant…" : !installee && installable ? "Installer et activer les alertes" : "Activer les alertes"}
        </button>
      )}

      {!installee && !installable && !ios && (
        <p className="text-[13px] leading-snug text-discret">
          Pour installer l&apos;application : ouvrez le menu du navigateur (⋮ ou ⋯), puis « Installer l&apos;application »
          ou « Ajouter à l&apos;écran d&apos;accueil ».
        </p>
      )}

      {!installee && installable && alertesActives && (
        <button type="button" onClick={() => installation.installer()} className={BOUTON_SECONDAIRE}>
          Installer l&apos;application
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

      {message && (
        <p
          className={`rounded-xl p-3 text-sm font-semibold leading-snug ${
            message.ton === "info" ? "bg-vert-clair text-vert-fonce" : "bg-rouge-clair text-[#8e1b12]"
          }`}
          role={message.ton === "erreur" ? "alert" : "status"}
        >
          {message.texte}
        </p>
      )}
    </Carte>
  );
}
