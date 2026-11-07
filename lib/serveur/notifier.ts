import type { SupabaseClient } from "@supabase/supabase-js";
import { options } from "@/lib/options";
import { envoyerPush, type CiblePush, type ContenuPush } from "./push";

// Envoie une notification push et la note dans le journal (sans jamais bloquer l'application).
// Le journal ne garde que le nombre d'appareils joints ; en MODE_TEST il garde aussi le titre,
// le texte et le chemin cliquable pour la page Admin > Messages.
export async function notifier(
  db: SupabaseClient,
  cible: CiblePush,
  contenu: ContenuPush,
  meta: { evenement: string; demandeId?: string | null }
): Promise<number> {
  const joints = await envoyerPush(db, cible, contenu);
  try {
    // Sans appareil abonné, on ne note rien en fonctionnement normal : le journal reste lisible.
    if (joints > 0 || options.modeTest()) {
      await db.from("journal_alertes").insert({
        demande_id: meta.demandeId ?? null,
        evenement: joints > 0 ? `push_${meta.evenement}` : `push_aucun_${meta.evenement}`,
        detail: {
          appareils: joints,
          cible: cible.type,
          ...(options.modeTest()
            ? { titre: contenu.titre, corps: contenu.corps, chemin: contenu.chemin }
            : {}),
        },
      });
    }
  } catch {
    // Le journal est secondaire.
  }
  return joints;
}
