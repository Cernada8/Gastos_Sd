/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Necesario para que formidable funcione en las API routes
  api: {
    bodyParser: false,
  },
  // Cabeceras de seguridad
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
