import type { FournisseurSms, ResultatEnvoiSms } from "./types";

// Fournisseur Twilio (appel direct à l'API, sans bibliothèque).
// Variables : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, et TWILIO_FROM (numéro ou nom d'expéditeur)
// ou TWILIO_MESSAGING_SERVICE_SID.
// Un fournisseur local ou un agrégateur se branche de la même façon : copier ce fichier,
// adapter l'appel HTTP, puis l'ajouter dans lib/sms/index.ts.
export const fournisseurTwilio: FournisseurSms = {
  async envoyer(telephone: string, message: string): Promise<ResultatEnvoiSms> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const jeton = process.env.TWILIO_AUTH_TOKEN;
    const expediteur = process.env.TWILIO_FROM;
    const service = process.env.TWILIO_MESSAGING_SERVICE_SID;
    if (!sid || !jeton || (!expediteur && !service)) {
      return { reussi: false, erreur: "Configuration Twilio incomplète" };
    }

    const corps = new URLSearchParams({ To: telephone, Body: message });
    if (service) corps.set("MessagingServiceSid", service);
    else if (expediteur) corps.set("From", expediteur);

    try {
      const reponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: "Basic " + Buffer.from(`${sid}:${jeton}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: corps,
          signal: AbortSignal.timeout(10000),
        }
      );
      const donnees = (await reponse.json().catch(() => ({}))) as {
        sid?: string;
        message?: string;
      };
      if (!reponse.ok) {
        return { reussi: false, erreur: donnees.message ?? `HTTP ${reponse.status}` };
      }
      return { reussi: true, identifiantFournisseur: donnees.sid };
    } catch (e) {
      return { reussi: false, erreur: e instanceof Error ? e.message : "Erreur réseau" };
    }
  },
};
