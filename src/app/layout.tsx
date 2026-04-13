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
    icon: '/icon.svg',
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
