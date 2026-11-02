"use client";

import Link from "next/link";
import { useAdmin } from "@/lib/admin/useAdmin";

// Cadre commun des pages d'administration : en-tête, navigation, contrôle d'accès.
// Le contenu (children) n'est affiché que pour un administrateur connecté.
export default function CadreAdmin({
  titre,
  children,
}: {
  titre: string;
  children: React.ReactNode;
}) {
  const { etat, email, deconnexion } = useAdmin();

  return (
    <main className="flex min-h-screen flex-col gap-5 px-5 pb-10 pt-5">
      <header className="flex items-center justify-between gap-3">
        <Link href="/admin" className="text-lg font-extrabold tracking-tight">
          Medi24 · Admin
        </Link>
        {(etat === "admin" || etat === "non-admin") && (
          <button
            type="button"
            onClick={deconnexion}
            className="min-h-11 rounded-xl border-[1.5px] border-[#76837b] bg-white px-3.5 text-sm font-bold"
          >
            Se déconnecter
          </button>
        )}
      </header>

      {etat === "admin" && (
        <nav className="flex flex-wrap gap-2" aria-label="Administration">
          {[
            ["/admin/indicateurs", "Indicateurs"],
            ["/admin/pharmacies", "Pharmacies"],
            ["/admin/gardes", "Gardes"],
            ["/admin/structures", "Structures"],
            ["/admin/journal", "Journal"],
          ].map(([adresse, libelle]) => (
            <Link
              key={adresse}
              href={adresse}
              className="inline-flex min-h-11 items-center rounded-xl bg-vert-clair px-4 text-sm font-bold text-vert-fonce"
            >
              {libelle}
            </Link>
          ))}
        </nav>
      )}

      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight">{titre}</h1>
        {etat === "admin" && email && (
          <p className="mt-0.5 text-[13px] text-discret">Connecté : {email}</p>
        )}
      </div>

      {etat === "chargement" && (
        <p className="text-base text-discret" role="status">
          Chargement…
        </p>
      )}

      {etat === "erreur" && (
        <p className="rounded-xl bg-rouge-clair p-4 text-sm font-semibold leading-snug text-[#8e1b12]" role="alert">
          Connexion à la base impossible. Vérifiez le fichier .env.local (voir
          .env.example) puis relancez le site.
        </p>
      )}

      {etat === "non-admin" && (
        <p className="rounded-xl bg-ambre p-4 text-sm font-semibold leading-snug text-ambre-fonce" role="alert">
          Ce compte n&apos;est pas administrateur. Ajoutez-le à la table admins
          (voir la fin de supabase/migrations/0002_admin_et_annuaire.sql).
        </p>
      )}

      {etat === "admin" && children}
    </main>
  );
}
