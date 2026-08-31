import type { NextConfig } from "next";

const isPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  basePath: isPages ? "/veilpass" : "",
  assetPrefix: isPages ? "/veilpass/" : "",
};
export default nextConfig;
