// Types partagés par l'annuaire et l'administration.

// Une ligne renvoyée par la fonction de base de données pharmacies_de_garde.
export type PharmacieGarde = {
  id: string;
  nom: string;
  adresse: string | null;
  repere: string | null;
  telephone_public: string | null;
  latitude: number;
  longitude: number;
  distance_m: number;
  garde_fin: string; // date ISO
  garde_confirmee: boolean;
};

// Une ligne renvoyée par la fonction admin_lister_pharmacies.
export type PharmacieAdmin = {
  id: string;
  nom: string;
  adresse: string | null;
  repere: string | null;
  numero_ordre: string | null;
  telephone_alerte_1: string;
  telephone_alerte_2: string | null;
  telephone_public: string | null;
  validee: boolean;
  suspendue: boolean;
  latitude: number;
  longitude: number;
  jeton_gestion: string;
};

export type GardeAdmin = {
  id: string;
  debut: string;
  fin: string;
  confirmee: boolean;
  nom_pharmacie: string;
};
