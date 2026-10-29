import type { Metadata, Viewport } from "next";
import { Lexend, Literata } from "next/font/google";
import "./globals.css";

const lexend = Lexend({ variable: "--font-lexend", subsets: ["latin", "latin-ext"], display: "swap" });
const literata = Literata({ variable: "--font-literata", subsets: ["latin", "latin-ext"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "SIELE Trainer Pro", template: "%s · SIELE Trainer Pro" },
  description:
    "Plataforma independiente de simulacros, evaluación y preparación personalizada del español. No afiliada a SIELE.",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1d3557",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${lexend.variable} ${literata.variable} h-full antialiased`}>
      <body className="min-h-full">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
