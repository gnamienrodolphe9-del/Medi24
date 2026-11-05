import type { FournisseurSms, ResultatEnvoiSms } from "./types";

// Fournisseur SMS Pro Africa (https://smspro.africa), API v3.
// Variables : SMSPRO_CLE (jeton API du compte) et SMSPRO_EXPEDITEUR (nom affiché, 11 caractères
// au plus, par exemple "Medi24" ; certains pays exigent que le nom soit approuvé d'abord).
const ADRESSE_ENVOI = "https://app.smspro.africa/api/v3/sms/send";

// L'API attend le numéro au format international sans "+" : 2250700000000.
export function numeroPourSmsPro(telephone: string): string {
  return telephone.replace(/\D/g, "");
}

type ReponseSmsPro = {
  status?: string;
  message?: string | null;
  data?: unknown;
};

function identifiant(data: unknown): string | undefined {
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const cle of ["uid", "id"]) {
      if (typeof o[cle] === "string" || typeof o[cle] === "number") return String(o[cle]);
    }
  }
  return undefined;
}

async function appel(cle: string, corps: Record<string, string>): Promise<Response> {
  return fetch(ADRESSE_ENVOI, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cle}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(corps),
    signal: AbortSignal.timeout(10000),
  });
}

export const fournisseurSmsPro: FournisseurSms = {
  async envoyer(telephone: string, message: string): Promise<ResultatEnvoiSms> {
    const cle = process.env.SMSPRO_CLE;
    const expediteur = process.env.SMSPRO_EXPEDITEUR || "Medi24";
    if (!cle) return { reussi: false, erreur: "SMSPRO_CLE manquante" };

    const corps = {
      recipient: numeroPourSmsPro(telephone),
      sender_id: expediteur,
      type: "plain",
      message,
    };

    try {
      let reponse = await appel(cle, corps);
      // L'API limite à 60 requêtes par minute : une seule nouvelle tentative après une courte pause.
      if (reponse.status === 429) {
        await new Promise((r) => setTimeout(r, 1500));
        reponse = await appel(cle, corps);
      }

      const json = (await reponse.json().catch(() => ({}))) as ReponseSmsPro;
      if (reponse.ok && json.status === "success") {
        return { reussi: true, identifiantFournisseur: identifiant(json.data) };
      }
      return {
        reussi: false,
        erreur: json.message ?? `HTTP ${reponse.status}`,
      };
    } catch (e) {
      return { reussi: false, erreur: e instanceof Error ? e.message : "Erreur réseau" };
    }
  },
};
