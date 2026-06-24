/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Vehicle images come from Serper (arbitrary https hosts) — allow remote images.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
