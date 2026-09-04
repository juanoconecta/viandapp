import type { Metadata } from "next";
import { Baloo_2, Inter } from "next/font/google";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MotionProvider from "@/components/landing/MotionProvider";
import "./globals.css";

// Solo 600 y 700: son los únicos pesos de Baloo 2 que se usan en algún
// componente (font-semibold / font-bold combinados con font-display en
// todo el codebase — verificado, ningún font-medium ni font-extrabold
// se aplica junto a font-display). 500 y 800 estaban declarados pero
// nunca se referenciaban, así que el navegador nunca los pedía — pero
// tenerlos en la config igual infla los @font-face que Next genera.
const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://viandapp.ar"),
  title: "ViandApp — Viandas caseras en Rafaela",
  description:
    "Encontrá tu viandera más cerca. Viandas caseras en Rafaela, pedí sin intermediarios.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${baloo.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-paper font-sans text-ink">
        <MotionProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </MotionProvider>
      </body>
    </html>
  );
}
