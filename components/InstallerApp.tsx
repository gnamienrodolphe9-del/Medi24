"use client";

import { useEffect, useState } from "react";
import { BOUTON_PRINCIPAL } from "@/components/ui";
import { useInstallation } from "@/lib/client/installation";

// Invitation à installer Medi24, pour le patient qui arrive pour la première fois (page d'accueil).
// Disparaît dès que l'application est installée, ou si la personne choisit « Plus tard » (jusqu'à
// la fermeture de l'onglet).
export default function InstallerApp() {
  const installation = useInstallation();
  const [masque, setMasque] = useState(false);
  const [aide, setAide] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("medi24-installer-plus-tard")) setMasque(true);
    } catch {
      // Sans mémoire de session, l'invitation reste affichée : sans gravité.
    }
  }, []);

  if (!installation.pret || installation.installee || masque) return null;
  const { installable, ios, android, integre } = installation;

  async function installer() {
    if (installable) {
      const r = await installation.installer();
      if (r === "indisponible") setAide(true);
    } else {
      setAide(true);
    }
  }

  function plusTard() {
    try {
      sessionStorage.setItem("medi24-installer-plus-tard", "1");
    } catch {
      // Rien à faire.
    }
    setMasque(true);
  }

  return (
    <section className="flex flex-col gap-2.5 rounded-[14px] border-[1.5px] border-vert bg-vert-clair p-4" aria-label="Installer Medi24">
      <p className="text-base font-extrabold text-vert-fonce">Installez Medi24 sur votre téléphone</p>
      <p className="text-[14px] leading-snug text-discret">
        Un seul toucher pour l&apos;ouvrir, et vous êtes prévenu dès qu&apos;une pharmacie répond, même écran éteint.
      </p>

      {integre && (
        <p className="rounded-xl bg-ambre p-3 text-sm font-semibold leading-snug text-ambre-fonce">
          Vous êtes dans le navigateur d&apos;une autre application. Ouvrez ce lien dans <strong>Chrome</strong> (menu ⋮, puis
          « Ouvrir dans le navigateur ») pour pouvoir installer Medi24.
        </p>
      )}

      {ios ? (
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-[14px] leading-snug">
          <li>
            Touchez <strong>Partager</strong> (le carré avec une flèche) en bas de Safari.
          </li>
          <li>
            Choisissez <strong>« Sur l&apos;écran d&apos;accueil »</strong>, puis <strong>Ajouter</strong>.
          </li>
        </ol>
      ) : (
        <button type="button" onClick={installer} className={BOUTON_PRINCIPAL}>
          Installer l&apos;application
        </button>
      )}

      {!ios && (aide || !installable) && (
        <p className="rounded-xl bg-white p-3 text-[14px] leading-snug">
          {android ? (
            <>
              Si rien ne s&apos;ouvre : touchez les trois points <strong>⋮</strong> de Chrome, puis{" "}
              <strong>« Installer l&apos;application »</strong> (ou « Ajouter à l&apos;écran d&apos;accueil »).
            </>
          ) : (
            <>
              Sur ordinateur (Chrome ou Edge) : cliquez sur l&apos;icône d&apos;installation à droite de la barre d&apos;adresse, ou sur le
              menu <strong>⋮</strong>, puis <strong>« Installer Medi24 »</strong>.
            </>
          )}
        </p>
      )}

      <button type="button" onClick={plusTard} className="min-h-11 self-start text-sm font-semibold text-discret underline">
        Plus tard
      </button>
    </section>
  );
}
