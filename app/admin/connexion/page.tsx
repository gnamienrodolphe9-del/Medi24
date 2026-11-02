"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Champ from "@/components/admin/Champ";
import { creerClientNavigateur } from "@/lib/supabase/client";

export default function ConnexionAdmin() {
  const routeur = useRouter();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function envoyer(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      const supabase = creerClientNavigateur();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: motDePasse,
      });
      if (error) {
        setErreur("E-mail ou mot de passe incorrect.");
        return;
      }
      routeur.replace("/admin");
    } catch {
      setErreur(
        "Connexion à la base impossible. Vérifiez le fichier .env.local puis relancez le site."
      );
    } finally {
      setEnCours(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col gap-5 px-5 py-8">
      <h1 className="text-[28px] font-extrabold tracking-tight">
        Connexion administrateur
      </h1>
      <form onSubmit={envoyer} className="flex flex-col gap-4">
        <Champ
          libelle="Adresse e-mail"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Champ
          libelle="Mot de passe"
          type="password"
          autoComplete="current-password"
          required
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
        />
        {erreur && (
          <p className="rounded-xl bg-rouge-clair p-3 text-sm font-semibold text-[#8e1b12]" role="alert">
            {erreur}
          </p>
        )}
        <button
          type="submit"
          disabled={enCours}
          className="min-h-14 rounded-2xl bg-vert text-lg font-extrabold text-white disabled:opacity-60"
        >
          {enCours ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </main>
  );
}
