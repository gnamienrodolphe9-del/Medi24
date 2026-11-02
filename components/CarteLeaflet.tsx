"use client";

import { useEffect, useRef } from "react";
import type { Map as CarteLeafletType, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PharmacieGarde } from "@/lib/types";
import { formaterDistance, lienItineraire } from "@/lib/garde";

type ModuleLeaflet = typeof import("leaflet");

type Props = {
  centre: { latitude: number; longitude: number };
  positionConnue: boolean;
  pharmacies: PharmacieGarde[];
};

// Carte OpenStreetMap avec la position du patient (point foncé) et les pharmacies de garde (points verts).
// Le fond de carte vient des serveurs publics d'OpenStreetMap : suffisant pour le pilote.
// Si le trafic grandit, passer à un fournisseur de cartes avec contrat.
export default function CarteLeaflet({ centre, positionConnue, pharmacies }: Props) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<CarteLeafletType | null>(null);
  const calque = useRef<LayerGroup | null>(null);

  // Dessine la carte et les points à chaque changement de position ou de liste.
  useEffect(() => {
    let annule = false;

    async function dessiner() {
      const module = (await import("leaflet")) as ModuleLeaflet & {
        default?: ModuleLeaflet;
      };
      const L: ModuleLeaflet = module.default ?? module;
      if (annule || !conteneur.current) return;

      if (!carte.current) {
        carte.current = L.map(conteneur.current, { zoomControl: true }).setView(
          [centre.latitude, centre.longitude],
          14
        );
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(carte.current);
        calque.current = L.layerGroup().addTo(carte.current);
      }

      const groupe = calque.current;
      if (!groupe) return;
      groupe.clearLayers();

      const pastille = (couleur: string) =>
        L.divIcon({
          className: "",
          html: `<span style="display:block;width:28px;height:28px;border-radius:14px;background:${couleur};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -14],
        });

      const points: [number, number][] = [];

      if (positionConnue) {
        L.marker([centre.latitude, centre.longitude], {
          icon: pastille("#14211b"),
          title: "Vous êtes ici",
        }).addTo(groupe);
        points.push([centre.latitude, centre.longitude]);
      }

      for (const p of pharmacies) {
        // Le contenu de la fenêtre est construit avec du texte simple (jamais du HTML)
        // pour qu'un nom de pharmacie ne puisse pas injecter de code.
        const contenu = document.createElement("div");
        const titre = document.createElement("strong");
        titre.textContent = p.nom;
        const distance = document.createElement("div");
        distance.textContent = formaterDistance(p.distance_m);
        const lien = document.createElement("a");
        lien.href = lienItineraire(p.latitude, p.longitude);
        lien.target = "_blank";
        lien.rel = "noopener noreferrer";
        lien.textContent = "Itinéraire";
        contenu.append(titre, distance, lien);

        L.marker([p.latitude, p.longitude], {
          icon: pastille("#0a6847"),
          title: p.nom,
        })
          .bindPopup(contenu)
          .addTo(groupe);
        points.push([p.latitude, p.longitude]);
      }

      if (points.length > 1 && carte.current) {
        carte.current.fitBounds(L.latLngBounds(points), {
          padding: [30, 30],
          maxZoom: 16,
        });
      } else if (carte.current) {
        carte.current.setView([centre.latitude, centre.longitude], 14);
      }
    }

    dessiner();
    return () => {
      annule = true;
    };
  }, [centre.latitude, centre.longitude, positionConnue, pharmacies]);

  // Supprime la carte quand la page est quittée.
  useEffect(() => {
    return () => {
      carte.current?.remove();
      carte.current = null;
      calque.current = null;
    };
  }, []);

  return (
    <div
      ref={conteneur}
      role="region"
      aria-label="Carte des pharmacies de garde"
      className="h-64 w-full overflow-hidden rounded-xl border-[1.5px] border-trait"
    />
  );
}
