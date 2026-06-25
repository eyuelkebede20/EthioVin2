/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server for cPanel/Passenger: `next build` traces a minimal
  // server.js + only the node_modules it actually needs into .next/standalone,
  // so we deploy that instead of uploading the full node_modules or running
  // `npm install` on shared hosting. See .github/workflows/deploy.yml.
  output: "standalone",
  // Vehicle images come from Serper (arbitrary https hosts) — allow remote images.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
