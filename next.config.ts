import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: [
    "better-sqlite3",
    "@prisma/adapter-better-sqlite3",
    "@prisma/adapter-pg",
    "pg",
    "sanitize-html",
  ],
  outputFileTracingIncludes: {
    "/": ["./dev.db"],
    "/companies": ["./dev.db"],
    "/jobs/[id]": ["./dev.db"],
  },
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
