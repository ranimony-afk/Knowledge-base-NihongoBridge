/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@nihongobridge/knowledge"],
  webpack(config) {
    // Keep workspace package resolution rooted in this app so peer dependencies
    // such as drizzle-orm resolve from this repository's node_modules.
    config.resolve.symlinks = false;
    return config;
  },
};

export default nextConfig;
