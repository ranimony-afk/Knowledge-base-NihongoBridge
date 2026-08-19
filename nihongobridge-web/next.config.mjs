/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    const origin = process.env.API_ORIGIN?.replace(/\/$/, "");
    return origin
      ? [{ source: "/api/:path*", destination: `${origin}/api/:path*` }]
      : [];
  },
};

export default nextConfig;
