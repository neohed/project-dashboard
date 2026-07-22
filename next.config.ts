import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module — keep it external to the server bundle
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: {
      // Cover images are uploaded via a Server Action's FormData — raise the
      // default 1MB body limit to comfortably fit the 5MB cap enforced in
      // src/lib/images.ts.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
