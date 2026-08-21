import type { Metadata } from "next";
import { Baloo_2, Inter } from "next/font/google";
import Header from "@/components/layout/Header";
import MotionProvider from "@/components/landing/MotionProvider";
import "./globals.css";

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
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
          <footer className="border-t border-ink/10">
            <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-sm text-ink/60 sm:flex-row sm:justify-between sm:px-6">
              <p>viandapp © 2026 — Rafaela, Santa Fe</p>
              <a
                href="#sumate"
                className="font-medium text-coral transition-colors hover:text-coral-600"
              >
                ¿Hacés viandas? Sumarte →
              </a>
            </div>
          </footer>
        </MotionProvider>
      </body>
    </html>
  );
}
