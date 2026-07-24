/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Garante que os ficheiros de fontes vão no bundle serverless do PDF
    outputFileTracingIncludes: {
      '/api/propostas/[id]': ['./lib/fonts/**'],
    },
  },
};

module.exports = nextConfig;
