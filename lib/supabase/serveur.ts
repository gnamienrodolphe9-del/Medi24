import { createClient } from "@supabase/supabase-js";

// Client pour le serveur uniquement (fonctions serveur, routes API, tâches planifiées).
// Il utilise la clé de service, qui contourne les règles de sécurité :
// ne jamais l'importer dans un composant client ni dans une page affichée au navigateur.
export function creerClientServeur() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !cleService) {
    throw new Error(
      "Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY (voir .env.example)."
    );
  }

  return createClient(url, cleService, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
