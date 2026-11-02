"use client";

import { useEffect, useRef } from "react";
import type { Map as CarteLeafletType, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";

type ModuleLeaflet = typeof import("leaflet");

export type Repere = {
  latitude: number;
  longitude: number;
  couleur: string; // ex. "#0a6847"
  titre: string;
};

// Carte OpenStreetMap avec quelques points colorés : position du patient, pharmacie, livreur.
export default function CarteSimple({
  reperes,
  etiquette,
  hauteur = "h-64",
}: {
  reperes: Repere[];
  etiquette: string;
  hauteur?: string;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<CarteLeafletType | null>(null);
  const calque = useRef<LayerGroup | null>(null);

  useEffect(() => {
    let annule = false;

    async function dessiner() {
      const module = (await import("leaflet")) as ModuleLeaflet & { default?: ModuleLeaflet };
      const L: ModuleLeaflet = module.default ?? module;
      if (annule || !conteneur.current || reperes.length === 0) return;

      if (!carte.current) {
        carte.current = L.map(conteneur.current).setView([reperes[0].latitude, reperes[0].longitude], 15);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(carte.current);
        calque.current = L.layerGroup().addTo(carte.current);
      }
      const groupe = calque.current;
      if (!groupe || !carte.current) return;
      groupe.clearLayers();

      const points: [number, number][] = [];
      for (const r of reperes) {
        L.marker([r.latitude, r.longitude], {
          title: r.titre,
          icon: L.divIcon({
            className: "",
            html: `<span style="display:block;width:26px;height:26px;border-radius:13px;background:${r.couleur};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
        }).addTo(groupe);
        points.push([r.latitude, r.longitude]);
      }
      if (points.length > 1) {
        carte.current.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 17 });
      } else {
        carte.current.setView(points[0], 16);
      }
    }

    dessiner();
    return () => {
      annule = true;
    };
  }, [reperes]);

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
      aria-label={etiquette}
      className={`${hauteur} w-full overflow-hidden rounded-xl border-[1.5px] border-trait`}
    />
  );
}
