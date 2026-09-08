import type { NextConfig } from "next";

const config: NextConfig = {
  distDir: process.env.E2E_TEST === "true" ? ".next-e2e" : ".next",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "same-origin" },
    ] }];
  },
};
export default config;
