// Service worker de Medi24 : garde la page Urgence, la page hors ligne et les fichiers
// du site en mémoire, pour que l'espace Urgence s'ouvre même sans internet.
// Changer le numéro de version pour forcer la mise à jour de la mémoire.
const VERSION = "medi24-v2";
const PAGES_EN_MEMOIRE = ["/urgence", "/hors-ligne"];

self.addEventListener("install", (evenement) => {
  evenement.waitUntil(
    caches.open(VERSION).then((memoire) => memoire.addAll(PAGES_EN_MEMOIRE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(
    caches
      .keys()
      .then((noms) =>
        Promise.all(noms.filter((nom) => nom !== VERSION).map((nom) => caches.delete(nom)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (evenement) => {
  const requete = evenement.request;
  if (requete.method !== "GET") return;
  const adresse = new URL(requete.url);

  // Fichiers du site (scripts, styles) : la mémoire d'abord, ils ne changent jamais
  // sous le même nom. Nécessaire pour que la page Urgence fonctionne hors ligne.
  if (adresse.origin === self.location.origin && adresse.pathname.startsWith("/_next/static/")) {
    evenement.respondWith(
      caches.match(requete).then(
        (enMemoire) =>
          enMemoire ||
          fetch(requete).then((reponse) => {
            if (reponse.ok) {
              const copie = reponse.clone();
              caches.open(VERSION).then((memoire) => memoire.put(requete, copie));
            }
            return reponse;
          })
      )
    );
    return;
  }

  // Pages : internet d'abord, la mémoire en secours.
  // Les demandes de données (API, base) ne passent jamais par la mémoire.
  if (requete.mode !== "navigate") return;
  evenement.respondWith(
    fetch(requete)
      .then((reponse) => {
        if (adresse.pathname === "/urgence" && reponse.ok) {
          const copie = reponse.clone();
          caches.open(VERSION).then((memoire) => memoire.put(requete, copie));
        }
        return reponse;
      })
      .catch(() =>
        caches
          .match(requete)
          .then((enMemoire) => enMemoire || caches.match("/hors-ligne"))
      )
  );
});
