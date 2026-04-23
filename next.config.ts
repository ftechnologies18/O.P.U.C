import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages utilise le mode "standalone" natif via @cloudflare/next-on-pages
  // On ne force pas d'output ici — le preset Cloudflare s'en charge
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  // Optimisations pour Cloudflare Pages / Edge
  experimental: {
    // Permet l'utilisation de APIs Node.js (Buffer, process, etc.) sur Cloudflare Workers
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },

  // Headers de sécurité
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
