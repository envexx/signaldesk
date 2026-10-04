import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `pg` is a native-ish Node module; keep it external to the server bundle.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
