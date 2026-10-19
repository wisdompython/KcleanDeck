import type { NextConfig } from "next";

// In Docker, Caddy routes /api and the backup Django admin to Django before
// requests reach Next.js. Without Caddy (local `npm run dev`, or a two-service
// Render setup) set API_PROXY_URL at build time so Next.js forwards them itself.
// /admin is the Next.js team admin, not Django.
const apiProxy = process.env.API_PROXY_URL?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // Django routes end in "/"; don't let Next.js strip it before proxying.
  skipTrailingSlashRedirect: true,
  images: {
    // 90 for photos (crisper detail); 75 stays the default for everything else.
    qualities: [75, 90],
    formats: ["image/avif", "image/webp"],
  },
  turbopack: {
    rules: {
      // Tailwind transforms the global entrypoint only. Renaming every CSS
      // file to *.css would strip CSS Module exports from *.module.css.
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    if (!apiProxy) return [];
    // Rewrites drop the trailing slash Django's URLs need, so add it back.
    return [
      { source: "/api/:path+", destination: `${apiProxy}/api/:path+/` },
      { source: "/backstage", destination: `${apiProxy}/backstage/` },
      { source: "/backstage/:path+", destination: `${apiProxy}/backstage/:path+/` },
      { source: "/static/:path+", destination: `${apiProxy}/static/:path+` },
      { source: "/media/:path+", destination: `${apiProxy}/media/:path+` },
    ];
  },
};

export default nextConfig;
