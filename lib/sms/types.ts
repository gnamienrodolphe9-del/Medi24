// Contrat commun à tous les fournisseurs SMS.
// Pour changer de fournisseur, on ajoute un fichier dans ce dossier qui respecte
// cette interface ; le reste de l'application ne change pas.

export type ResultatEnvoiSms = {
  reussi: boolean;
  identifiantFournisseur?: string;
  erreur?: string;
};

export interface FournisseurSms {
  envoyer(telephone: string, message: string): Promise<ResultatEnvoiSms>;
}
