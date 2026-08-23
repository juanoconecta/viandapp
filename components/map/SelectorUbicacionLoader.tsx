"use client";

import dynamic from "next/dynamic";

const SelectorUbicacion = dynamic(() => import("./SelectorUbicacion"), {
  ssr: false,
});

type Props = {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
};

export default function SelectorUbicacionLoader(props: Props) {
  return <SelectorUbicacion {...props} />;
}
