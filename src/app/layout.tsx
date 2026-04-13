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
      url: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120' fill='none'><defs><linearGradient id='g' x1='0' y1='0' x2='120' y2='120' gradientUnits='userSpaceOnUse'><stop offset='0%25' stop-color='%23FBBF24'/><stop offset='100%25' stop-color='%23D97706'/></linearGradient></defs><rect x='4' y='4' width='112' height='112' rx='28' fill='url(%23g)'/><rect x='18' y='36' width='50' height='62' rx='3' fill='%231C1917'/><rect x='14' y='32' width='58' height='6' rx='2.5' fill='%231C1917'/><rect x='24' y='42' width='8' height='8' rx='1.5' fill='%23FEF3C7' opacity='0.95'/><rect x='52' y='42' width='8' height='8' rx='1.5' fill='%2344403C' opacity='0.5'/><rect x='38' y='56' width='8' height='8' rx='1.5' fill='%23FEF3C7' opacity='0.95'/><rect x='24' y='70' width='8' height='8' rx='1.5' fill='%23FEF3C7' opacity='0.95'/><rect x='52' y='70' width='8' height='8' rx='1.5' fill='%2344403C' opacity='0.5'/><rect x='38' y='84' width='8' height='8' rx='1.5' fill='%2344403C' opacity='0.5'/><rect x='6' y='70' width='16' height='26' rx='2' fill='%23292524'/><rect x='78' y='14' width='7' height='84' rx='2.5' fill='%23451A03'/><rect x='40' y='12' width='52' height='6' rx='2.5' fill='%23451A03'/><polygon points='90,8 90,20 99,14' fill='%23451A03'/><line x1='84' y1='0' x2='98' y2='12' stroke='%23FCD34D' stroke-width='2' stroke-linecap='round'/><line x1='84' y1='0' x2='66' y2='12' stroke='%23FCD34D' stroke-width='2' stroke-linecap='round'/><line x1='96' y1='14' x2='96' y2='34' stroke='%23FCD34D' stroke-width='1.8'/><path d='M92,34 L96,41 L100,34' stroke='%23FCD34D' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/><rect x='2' y='96' width='116' height='5' rx='2' fill='%2378350F' opacity='0.5'/></svg>`),
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
