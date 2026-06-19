import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { OfflineStatusIndicator } from "@/components/pwa/offline-status-indicator";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: '#059669',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  display: 'standalone',
};

export const metadata: Metadata = {
  title: "O.P.U.C. — Outil de Pilotage Unifié de Chantier",
  description: "O.P.U.C. — Plateforme SaaS de gestion et pilotage de chantiers BTP en Côte d'Ivoire. Pointage mobile, budgets, stocks, documents. Essai gratuit 14 jours.",
  keywords: ["OPUC", "gestion chantier", "construction", "pilotage BTP", "Côte d'Ivoire", "pointage mobile", "logiciel chantier", "SaaS BTP", "Abidjan"],
  authors: [{ name: "OPUC Team" }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'O.P.U.C.',
  },
  icons: {
    icon: [
      { url: '/pwa-icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/pwa-icon-512.png', sizes: '512x512' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="O.P.U.C." />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ServiceWorkerRegistration />
        {children}
        <Toaster />
        <OfflineStatusIndicator />
      </body>
    </html>
  );
}
