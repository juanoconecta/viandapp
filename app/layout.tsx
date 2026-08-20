import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Header from "@/components/layout/Header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-black/10 py-6">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 text-sm text-neutral-500 sm:flex-row sm:justify-between sm:px-6">
            <p>viandapp © 2026 — Rafaela, Santa Fe</p>
            <Link href="/productores" className="text-coral hover:text-coral-600">
              ¿Hacés viandas? Sumarte →
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
