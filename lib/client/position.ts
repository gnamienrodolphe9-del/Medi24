// Position du téléphone, demandée seulement quand la personne appuie sur un bouton.
export type PositionSimple = { latitude: number; longitude: number };

export function lirePosition(): Promise<PositionSimple> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("Votre téléphone ne partage pas sa position."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? "Position refusée. Autorisez la position dans les réglages, ou indiquez un repère."
              : "Position introuvable. Réessayez dehors ou indiquez un repère."
          )
        ),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });
}
