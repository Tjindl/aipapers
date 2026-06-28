import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Tell Next.js to include Prisma engine binaries in the serverless bundle.
  // Required because the client is generated to a custom output path.
  outputFileTracingIncludes: {
    "/**": ["./app/generated/prisma/**/*"],
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
