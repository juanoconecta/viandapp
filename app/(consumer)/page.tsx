import type { Metadata } from "next";
import { Suspense } from "react";
import PortadaHero from "@/components/landing/PortadaHero";
import FranjaValor from "@/components/landing/FranjaValor";
import DescubriHoy from "@/components/landing/DescubriHoy";
import CocinasFundadoras from "@/components/landing/CocinasFundadoras";
import RecorridoConsumidor from "@/components/landing/RecorridoConsumidor";
import ResultsSkeleton from "@/components/consumer/ResultsSkeleton";
import MobileBottomNav from "@/components/consumer/MobileBottomNav";

export const metadata: Metadata = {
  title: "ViandApp — Viandas caseras en Rafaela, directo por WhatsApp",
  description:
    "Encontrá viandas preparadas por cocinas de Rafaela. Mirá el menú y coordiná directo por WhatsApp.",
};

export default function HomePage() {
  return (
    <div className="flex flex-col overflow-x-clip pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
      <PortadaHero />
      <FranjaValor />
      <Suspense fallback={<div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6"><ResultsSkeleton /></div>}>
        <DescubriHoy />
      </Suspense>
      <CocinasFundadoras />
      <RecorridoConsumidor />
      <MobileBottomNav />
    </div>
  );
}
