'use client';

import Link from 'next/link';
import { Package, Eye, EyeOff, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useApiKey } from '@/hooks/useAuth';
import { useAdminProducts, useSourceWebsites } from '@/hooks/useProducts';

export default function AdminDashboard() {
  const apiKey = useApiKey();
  const { data: products } = useAdminProducts(apiKey || '', { limit: 100 });
  const { data: sourceWebsites } = useSourceWebsites(apiKey || '');

  const totalProducts = products?.total || 0;
  const enabledProducts = products?.items.filter((p) => p.enabled).length || 0;
  const disabledProducts = totalProducts - enabledProducts;

  const productsWithMarketData = products?.items.filter(
    (p) => p.market_avg_price
  ).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Resumen de tu catálogo</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Productos</p>
                <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Eye className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Habilitados</p>
                <p className="text-2xl font-bold text-gray-900">{enabledProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gray-100 rounded-lg">
                <EyeOff className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Deshabilitados</p>
                <p className="text-2xl font-bold text-gray-900">{disabledProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Con datos de mercado</p>
                <p className="text-2xl font-bold text-gray-900">{productsWithMarketData}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source Websites */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">
              Webs de Origen
            </h2>
          </CardHeader>
          <CardContent>
            {sourceWebsites?.items && sourceWebsites.items.length > 0 ? (
              <ul className="space-y-2">
                {sourceWebsites.items.map((website) => (
                  <li
                    key={website.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {website.display_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {website.product_count} productos
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        website.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {website.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-center py-4">
                No hay webs de origen configuradas
              </p>
            )}
            <Link
              href="/admin/source-websites"
              className="block mt-4 text-center text-sm text-primary-600 hover:text-primary-700"
            >
              Gestionar webs de origen →
            </Link>
          </CardContent>
        </Card>

        {/* Recent Products */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">
              Productos Recientes
            </h2>
          </CardHeader>
          <CardContent>
            {products?.items && products.items.length > 0 ? (
              <ul className="space-y-2">
                {products.items.slice(0, 5).map((product) => (
                  <li
                    key={product.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">
                        {product.custom_name || product.original_name}
                      </p>
                      <p className="text-sm text-gray-500">{product.slug}</p>
                    </div>
                    <span
                      className={`ml-2 px-2 py-1 text-xs rounded-full ${
                        product.enabled
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {product.enabled ? 'Activo' : 'Inactivo'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-center py-4">
                No hay productos
              </p>
            )}
            <Link
              href="/admin/productos"
              className="block mt-4 text-center text-sm text-primary-600 hover:text-primary-700"
            >
              Ver todos los productos →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
