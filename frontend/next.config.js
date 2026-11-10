const BACKEND_BASE = (
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000/api/v1'
).replace(/\/api\/v1\/?$/, '')

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
        hostname: 'www.redlenic.uno',
      },
      {
        protocol: 'https',
        hostname: 'redlenic.uno',
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
      {
        protocol: 'https',
        hostname: '**.railway.app',
      },
      {
        protocol: 'https',
        hostname: 'bunny-cdn.ventasxmayor.com',
      },
      {
        protocol: 'https',
        hostname: 'i.ibb.co',
      },
    ],
  },
  // Revalidate pages every hour
  experimental: {
    staleTimes: {
      dynamic: 3600,
    },
  },
  // Los archivos subidos (/uploads/...) se sirven desde el backend. En Railway,
  // INTERNAL_API_URL apunta a la red privada, así el optimizador de imágenes no
  // pasa por el dominio público (que limita con 429). Se lee en el build.
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: `${BACKEND_BASE}/uploads/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
