import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "O.P.U.C. — Outil de Pilotage Unifié de Chantier",
  description: "Plateforme de gestion et de pilotage intelligent de chantiers de construction. Gérez vos chantiers, le personnel, les stocks et les budgets en un seul endroit.",
  keywords: ["OPUC", "gestion chantier", "construction", "pilotage", "BTP", "Sénégal"],
  authors: [{ name: "OPUC Team" }],
  icons: {
    icon: {
      url: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120' fill='none'><defs><linearGradient id='g' x1='0' y1='0' x2='120' y2='120' gradientUnits='userSpaceOnUse'><stop offset='0%25' stop-color='%23F59E0B'/><stop offset='100%25' stop-color='%23EA580C'/></linearGradient></defs><rect x='4' y='4' width='112' height='112' rx='28' fill='url(%23g)'/><rect x='22' y='38' width='48' height='58' rx='3' fill='white' fillOpacity='0.95'/><rect x='28' y='44' width='8' height='8' rx='1.5' fill='%23EA580C' fillOpacity='0.7'/><rect x='42' y='44' width='8' height='8' rx='1.5' fill='%23EA580C' fillOpacity='0.7'/><rect x='56' y='44' width='8' height='8' rx='1.5' fill='white' fillOpacity='0.85'/><rect x='28' y='58' width='8' height='8' rx='1.5' fill='%23EA580C' fillOpacity='0.7'/><rect x='42' y='58' width='8' height='8' rx='1.5' fill='%23EA580C' fillOpacity='0.7'/><rect x='56' y='58' width='8' height='8' rx='1.5' fill='white' fillOpacity='0.85'/><rect x='28' y='72' width='8' height='8' rx='1.5' fill='%23EA580C' fillOpacity='0.7'/><rect x='42' y='72' width='8' height='8' rx='1.5' fill='%23EA580C' fillOpacity='0.7'/><rect x='56' y='72' width='8' height='8' rx='1.5' fill='white' fillOpacity='0.85'/><rect x='28' y='86' width='8' height='8' rx='1.5' fill='white' fillOpacity='0.85'/><rect x='42' y='86' width='8' height='8' rx='1.5' fill='white' fillOpacity='0.85'/><rect x='56' y='86' width='8' height='8' rx='1.5' fill='white' fillOpacity='0.85'/><rect x='18' y='34' width='56' height='6' rx='2' fill='white' fillOpacity='0.95'/><rect x='76' y='18' width='6' height='78' rx='2' fill='%23FCD34D'/><rect x='42' y='16' width='50' height='5' rx='2' fill='%23FCD34D'/><polygon points='90,13 90,24 98,18.5' fill='%23FCD34D'/><line x1='82' y1='4' x2='95' y2='16' stroke='%23FCD34D' stroke-width='1.5' stroke-linecap='round'/><line x1='82' y1='4' x2='68' y2='16' stroke='%23FCD34D' stroke-width='1.5' stroke-linecap='round'/><line x1='95' y1='18.5' x2='95' y2='32' stroke='%23FCD34D' stroke-width='1.2'/><path d='M91,32 L95,38 L99,32' stroke='%23FCD34D' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/><rect x='14' y='96' width='92' height='4' rx='2' fill='white' fillOpacity='0.3'/><rect x='14' y='72' width='14' height='22' rx='2' fill='white' fillOpacity='0.4'/></svg>`),
      type: 'image/svg+xml',
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
