// Textes des SMS. Ils sont écrits SANS ACCENTS ni caractères spéciaux :
// un seul accent fait passer le SMS en Unicode (70 caractères par SMS au lieu de 160),
// ce qui double ou triple le coût. Garder chaque message sous 160 caractères.

import { sansAccents } from "./validation";

export const LONGUEUR_SMS_MAX = 160;

export function nettoyerSms(texte: string): string {
  return sansAccents(texte)
    .replace(/[’‘]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "");
}

export function smsCodeVerification(code: string): string {
  return nettoyerSms(`Medi24: votre code de verification est ${code}. Valable 10 minutes. Ne le partagez pas.`);
}

export function smsAlertePharmacie(lien: string, distanceTexte: string | null): string {
  const loin = distanceTexte ? ` (a ${distanceTexte})` : "";
  return nettoyerSms(`Medi24: un patient cherche un medicament${loin}. Repondez en 1 clic: ${lien}`);
}

export function smsRappelPharmacie(lien: string): string {
  return nettoyerSms(`Medi24 RAPPEL: un patient attend votre reponse. Repondez en 1 clic: ${lien}`);
}

export function smsLivraisonPharmacie(lien: string): string {
  return nettoyerSms(`Medi24: le patient demande la livraison. Indiquez le livreur ici: ${lien}`);
}

export function smsConfirmationPharmacie(lien: string): string {
  return nettoyerSms(`Medi24: le patient confirme sa commande (retrait). Preparez-la puis cliquez Prete: ${lien}`);
}

export function smsLivreur(lien: string, nomPharmacie: string): string {
  const nom = nomPharmacie.slice(0, 25);
  return nettoyerSms(`Medi24: course chez ${nom}. Ouvrez le lien pour livrer: ${lien}`);
}

export function smsPatientReponse(lien: string): string {
  return nettoyerSms(`Medi24: une pharmacie a repondu a votre demande. Voir et choisir: ${lien}`);
}

export function smsPatientPrete(lien: string): string {
  return nettoyerSms(`Medi24: votre commande est prete. Details et code: ${lien}`);
}

export function smsGardeSoir(lien: string): string {
  return nettoyerSms(`Medi24: etes-vous de garde ce soir ? Confirmez en 1 clic: ${lien}`);
}

export function smsSupervision(texte: string): string {
  return nettoyerSms(`Medi24 ALERTE: ${texte}`).slice(0, LONGUEUR_SMS_MAX);
}
