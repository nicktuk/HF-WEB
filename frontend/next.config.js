/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'newredmayorista.com.ar',
      },
      {
        protocol: 'https',
        hostname: '**.mercadolibre.com',
      },
      {
        protocol: 'https',
        hostname: '**.mlstatic.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
      },
      {
        protocol: 'http',
        hostname: '192.168.1.81',
        port: '8000',
      },
    ],
  },
  // Revalidate pages every hour
  experimental: {
    staleTimes: {
      dynamic: 3600,
    },
  },
}

module.exports = nextConfig
