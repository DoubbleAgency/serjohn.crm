/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // pdfkit tem de ficar fora do bundle webpack (lê ficheiros .afm do disco);
    // o file tracing da Vercel inclui o pacote completo de node_modules.
    serverComponentsExternalPackages: ['pdfkit'],
  },
};

module.exports = nextConfig;
