import type { FournisseurSms, ResultatEnvoiSms } from "./types";

// Fournisseur de développement : n'envoie rien, écrit le SMS dans le terminal
// où tourne `npm run dev`. Permet de tester toute la chaîne sans payer de SMS.
export const fournisseurConsole: FournisseurSms = {
  async envoyer(telephone: string, message: string): Promise<ResultatEnvoiSms> {
    console.log(`\n[SMS simulé] vers ${telephone}\n${message}\n`);
    return { reussi: true, identifiantFournisseur: "console" };
  },
};
