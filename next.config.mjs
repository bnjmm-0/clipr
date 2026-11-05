/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
};
export default nextConfig;
