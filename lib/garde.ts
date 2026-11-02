// Fonctions utilitaires pour les pharmacies de garde : distances, heures, liens.

// Centre approximatif de Yopougon, utilisé quand la position du patient n'est pas connue.
export const CENTRE_YOPOUGON = { latitude: 5.3364, longitude: -4.0867 };

// Zone dans laquelle une pharmacie doit se trouver (Abidjan). Sert à repérer une
// erreur de saisie, par exemple latitude et longitude inversées.
// À élargir quand Medi24 s'ouvrira à d'autres villes.
export const ZONE_ABIDJAN = {
  latMin: 5.1,
  latMax: 5.6,
  lngMin: -4.3,
  lngMax: -3.8,
};

export function dansZoneAbidjan(latitude: number, longitude: number): boolean {
  return (
    latitude >= ZONE_ABIDJAN.latMin &&
    latitude <= ZONE_ABIDJAN.latMax &&
    longitude >= ZONE_ABIDJAN.lngMin &&
    longitude <= ZONE_ABIDJAN.lngMax
  );
}

// 850 m ou 1,2 km
export function formaterDistance(metres: number): string {
  if (metres < 1000) return `${Math.max(10, Math.round(metres / 10) * 10)} m`;
  return `${(metres / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;
}

// Abidjan est à l'heure UTC toute l'année (pas de changement d'heure).
// Toutes les heures de garde sont donc enregistrées et affichées en UTC,
// quel que soit le fuseau de l'ordinateur ou du téléphone.
export function formaterHeureAbidjan(dateIso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateIso));
}

export function formaterDateHeureAbidjan(dateIso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateIso));
}

// Ouvre l'application de navigation du téléphone (Google Maps) jusqu'à la pharmacie.
export function lienItineraire(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
}

// Un champ <input type="datetime-local"> donne "2026-10-23T19:00".
// On l'interprète comme une heure d'Abidjan (UTC).
export function champVersInstantAbidjan(valeurChamp: string): string {
  return `${valeurChamp.slice(0, 16)}:00Z`;
}

function instantVersChamp(date: Date): string {
  return date.toISOString().slice(0, 16);
}

// Proposition de garde de nuit : de 19 h à 7 h le lendemain (heure d'Abidjan).
// Avant 7 h du matin, on propose la nuit qui a commencé la veille.
export function propositionNuit(): { debut: string; fin: string } {
  const maintenant = new Date();
  const minuitAujourdhui = Date.UTC(
    maintenant.getUTCFullYear(),
    maintenant.getUTCMonth(),
    maintenant.getUTCDate()
  );
  const jourDebut =
    maintenant.getUTCHours() < 7 ? minuitAujourdhui - 24 * 3600 * 1000 : minuitAujourdhui;
  return {
    debut: instantVersChamp(new Date(jourDebut + 19 * 3600 * 1000)),
    fin: instantVersChamp(new Date(jourDebut + 31 * 3600 * 1000)),
  };
}
