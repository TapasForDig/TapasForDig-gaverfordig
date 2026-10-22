/** @type {import('next').NextConfig} */
const nextConfig = {
  // PGlite (lokal Postgres) og pg skal køre som almindelige Node-pakker på serveren
  serverExternalPackages: ['@electric-sql/pglite', 'pg'],
  experimental: {
    serverActions: { bodySizeLimit: '12mb' }, // produktbilleder
  },
};

export default nextConfig;
