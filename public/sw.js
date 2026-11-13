// Service worker de Medi24 : garde la page Urgence, la page hors ligne et les fichiers
// du site en mémoire, pour que l'espace Urgence s'ouvre même sans internet.
// Changer le numéro de version pour forcer la mise à jour de la mémoire.
const VERSION = "medi24-v4";
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
  // En développement local, on ne garde rien en mémoire (les fichiers changent sans cesse).
  if (self.location.hostname === "localhost") return;
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

// Notifications push : une alerte de pharmacie, une réponse de pharmacie au patient, etc.
// Le serveur envoie { titre, corps, chemin, etiquette, urgent } ; on l'affiche et, au clic,
// on ouvre la page concernée (ou on revient sur la fenêtre déjà ouverte).
self.addEventListener("push", (evenement) => {
  let donnees = {};
  try {
    donnees = evenement.data ? evenement.data.json() : {};
  } catch (e) {
    donnees = { titre: "Medi24", corps: evenement.data ? evenement.data.text() : "" };
  }
  const urgent = donnees.urgent === true;
  evenement.waitUntil(
    self.registration.showNotification(donnees.titre || "Medi24", {
      body: donnees.corps || "",
      tag: donnees.etiquette || "medi24",
      renotify: true,
      icon: "/icons/icone-192.png",
      badge: "/icons/icone-192.png",
      vibrate: urgent ? [400, 150, 400, 150, 400] : [200, 100, 200],
      requireInteraction: urgent,
      data: { chemin: donnees.chemin || "/" },
    })
  );
});

self.addEventListener("notificationclick", (evenement) => {
  evenement.notification.close();
  const chemin = (evenement.notification.data && evenement.notification.data.chemin) || "/";
  const cible = new URL(chemin, self.location.origin).href;
  evenement.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      for (const fenetre of fenetres) {
        if (fenetre.url === cible && "focus" in fenetre) return fenetre.focus();
      }
      for (const fenetre of fenetres) {
        if ("navigate" in fenetre && "focus" in fenetre) {
          return fenetre.focus().then(() => fenetre.navigate(cible));
        }
      }
      return self.clients.openWindow(cible);
    })
  );
});
