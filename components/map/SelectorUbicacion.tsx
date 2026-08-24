"use client";

import { useEffect, useRef } from "react";
import {
  Map,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const RAFAELA_CENTER: [number, number] = [-61.4882, -31.2527];

setWorkerUrl("/maplibre-gl-worker.mjs");

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

type Props = {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
};

export default function SelectorUbicacion({ lat, lng, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const centro: [number, number] =
      lat != null && lng != null ? [lng, lat] : RAFAELA_CENTER;

    if (lat == null || lng == null) {
      onChangeRef.current(centro[1], centro[0]);
    }

    mapRef.current = new Map({
      container: containerRef.current,
      style: STYLE,
      center: centro,
      zoom: 14,
    });

    mapRef.current.addControl(
      new NavigationControl({ showCompass: false }),
      "top-right",
    );

    const marker = new Marker({ draggable: true, color: "#D85A30" })
      .setLngLat(centro)
      .addTo(mapRef.current);

    marker.on("dragend", () => {
      const posicion = marker.getLngLat();
      onChangeRef.current(posicion.lat, posicion.lng);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-[40vh] min-h-[280px] w-full overflow-hidden rounded-2xl"
    />
  );
}
