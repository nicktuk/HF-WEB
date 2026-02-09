'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useApiKey } from '@/hooks/useAuth';
import { useDeleteSale, useSale } from '@/hooks/useProducts';
import { formatPrice } from '@/lib/utils';

export default function SaleDetailPage() {
  const params = useParams();
  const saleId = parseInt(params.id as string, 10);
  const router = useRouter();
  const apiKey = useApiKey() || '';

  const { data: sale, isLoading } = useSale(apiKey, saleId);
  const deleteSale = useDeleteSale(apiKey);

  const totalItems = useMemo(() => {
    return sale?.items.reduce((acc, item) => acc + item.quantity, 0) || 0;
  }, [sale]);

  const handleDelete = async () => {
    if (!sale) return;
    if (!confirm('¿Eliminar esta venta y revertir stock si estaba entregada?')) return;
    await deleteSale.mutateAsync(sale.id);
    router.push('/admin/ventas');
  };

  if (isLoading) {
    return <div className="text-sm text-gray-500">Cargando venta...</div>;
  }

  if (!sale) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-500">Venta no encontrada.</p>
        <Link href="/admin/ventas" className="text-primary-600 hover:text-primary-700">
          Volver a ventas
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/ventas" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Venta #{sale.id}</h1>
            <p className="text-sm text-gray-500">
              {sale.seller} · {sale.customer_name || 'Sin cliente'} · {totalItems} items
            </p>
          </div>
        </div>
        <Button variant="danger" onClick={handleDelete} isLoading={deleteSale.isPending}>
          <Trash2 className="h-4 w-4 mr-2" />
          Eliminar venta
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-lg font-semibold">Items</h2>
          </CardHeader>
          <CardContent>
            {sale.items.length === 0 ? (
              <p className="text-sm text-gray-500">No hay items.</p>
            ) : (
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Precio</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sale.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-900">
                            {item.product_name || `Producto #${item.product_id}`}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatPrice(item.unit_price)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatPrice(item.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Detalle</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Cliente</span>
              <span className="font-medium">{sale.customer_name || '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Vendedor</span>
              <span className="font-medium">{sale.seller}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Cuotas</span>
              <span className="font-medium">{sale.installments ?? '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Entregado</span>
              <span className={`font-medium ${sale.delivered ? 'text-emerald-700' : 'text-amber-700'}`}>
                {sale.delivered ? 'Sí' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Pagado</span>
              <span className={`font-medium ${sale.paid ? 'text-emerald-700' : 'text-amber-700'}`}>
                {sale.paid ? 'Sí' : 'No'}
              </span>
            </div>
            <div className="border-t pt-3 flex items-center justify-between">
              <span className="text-gray-500">Total</span>
              <span className="text-lg font-bold text-gray-900">{formatPrice(sale.total_amount)}</span>
            </div>
            {sale.notes && (
              <div className="border-t pt-3">
                <div className="text-gray-500 mb-1">Notas</div>
                <div className="text-gray-900 whitespace-pre-line">{sale.notes}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
