"use client";

import { useEffect, useRef } from "react";
import {
  Map,
  NavigationControl,
  setWorkerUrl,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const RAFAELA_CENTER: [number, number] = [-61.4882, -31.2527];

// Turbopack drops the worker's sibling chunk when it's bundled inline
// (https://github.com/vercel/next.js/issues/86495), which stalls style
// loading entirely — even for a style with no vector layers, since MapLibre
// still hands off style setup to the worker pool. The worker is served as a
// static asset from public/ instead so the handshake actually completes.
setWorkerUrl("/maplibre-gl-worker.mjs");

// Raster tiles instead of a vector style: no protobuf parsing needed, so
// there's nothing left riding on the worker even if the handshake above
// were ever to regress.
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

export default function ViandaMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = new Map({
      container: containerRef.current,
      style: STYLE,
      center: RAFAELA_CENTER,
      zoom: 13,
    });

    mapRef.current.addControl(
      new NavigationControl({ showCompass: false }),
      "top-right",
    );

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-[55vh] min-h-[320px] w-full overflow-hidden rounded-2xl"
    />
  );
}
