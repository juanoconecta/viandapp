"use client";

import dynamic from "next/dynamic";

const ViandaMap = dynamic(() => import("./ViandaMap"), { ssr: false });

export default function ViandaMapLoader() {
  return <ViandaMap />;
}
