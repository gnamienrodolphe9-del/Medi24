import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Client pour le navigateur : clé publique, soumis aux règles de sécurité de la base.
// Sans connexion, il ne peut lire que l'annuaire des pharmacies de garde et la liste
// des structures. Un administrateur connecté peut en plus gérer pharmacies et gardes.
// Un seul client est créé et réutilisé, pour que la session de connexion soit partagée.
let instance: SupabaseClient | null = null;

export function creerClientNavigateur(): SupabaseClient {
  if (instance) return instance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !cle) {
    throw new Error(
      "Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY (voir .env.example)."
    );
  }

  instance = createClient(url, cle);
  return instance;
}
