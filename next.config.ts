import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a phone on the same Wi-Fi open the dev server (npm run dev:phone). Add your computer's address if it changes.
  allowedDevOrigins: ['192.168.254.135', '192.168.137.1'], // home Wi-Fi, and this PC's mobile hotspot
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
