'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useApiKey } from '@/hooks/useAuth';
import { useAdminProducts, useDeleteSale, useSale, useUpdateSale } from '@/hooks/useProducts';
import { formatPrice } from '@/lib/utils';
import type { ProductAdmin } from '@/types';

interface EditItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  delivered: boolean;
  paid: boolean;
}

export default function SaleDetailPage() {
  const params = useParams();
  const saleId = parseInt(params.id as string, 10);
  const router = useRouter();
  const apiKey = useApiKey() || '';

  const { data: sale, isLoading } = useSale(apiKey, saleId);
  const deleteSale = useDeleteSale(apiKey);
  const updateSale = useUpdateSale(apiKey);

  const [isEditing, setIsEditing] = useState(false);
  const [editCustomer, setEditCustomer] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editInstallments, setEditInstallments] = useState('');
  const [editSeller, setEditSeller] = useState<'Facu' | 'Heber'>('Facu');
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [productSearch, setProductSearch] = useState('');

  const { data: productsData } = useAdminProducts(apiKey, {
    page: 1,
    limit: 100,
    search: productSearch || undefined,
  });

  useEffect(() => {
    if (!sale) return;
    setEditCustomer(sale.customer_name || '');
    setEditNotes(sale.notes || '');
    setEditInstallments(sale.installments != null ? String(sale.installments) : '');
    setEditSeller(sale.seller);
    setEditItems(
      sale.items.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name || `Producto #${item.product_id}`,
        quantity: item.quantity,
        unit_price: Number(item.unit_price || 0),
        delivered: !!item.delivered,
        paid: !!item.paid,
      }))
    );
  }, [sale]);

  const totalItems = useMemo(() => {
    return sale?.items.reduce((acc, item) => acc + item.quantity, 0) || 0;
  }, [sale]);

  const editedTotalAmount = useMemo(() => {
    return editItems.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
  }, [editItems]);

  const visibleItems = useMemo(() => {
    if (isEditing) {
      return editItems;
    }
    return (sale?.items || []).map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name || `Producto #${item.product_id}`,
      quantity: item.quantity,
      unit_price: Number(item.unit_price || 0),
      delivered: !!item.delivered,
      paid: !!item.paid,
    }));
  }, [isEditing, editItems, sale?.items]);

  const handleDelete = async () => {
    if (!sale) return;
    if (!confirm('¿Eliminar esta venta y revertir stock entregado?')) return;
    await deleteSale.mutateAsync(sale.id);
    router.push('/admin/ventas');
  };

  const addProductToEdit = (product: ProductAdmin) => {
    const defaultPrice =
      Number(product.custom_price ?? product.original_price ?? 0) *
      (1 + Number(product.markup_percentage ?? 0) / 100);

    setEditItems((prev) => {
      const exists = prev.find((item) => item.product_id === product.id);
      if (exists) {
        return prev.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.custom_name || product.original_name,
          quantity: 1,
          unit_price: Number(defaultPrice || 0),
          delivered: false,
          paid: false,
        },
      ];
    });
  };

  const updateEditItem = (productId: number, patch: Partial<EditItem>) => {
    setEditItems((prev) =>
      prev
        .map((item) => (item.product_id === productId ? { ...item, ...patch } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const removeEditItem = (productId: number) => {
    setEditItems((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const handleSave = async () => {
    if (!sale) return;
    const items = editItems.map((item) => ({
      product_id: item.product_id,
      quantity: Math.max(0, Number(item.quantity || 0)),
      unit_price: Math.max(0, Number(item.unit_price || 0)),
      delivered: !!item.delivered,
      paid: !!item.paid,
    }));

    if (!items.length || items.some((item) => item.quantity <= 0 || item.unit_price <= 0)) {
      alert('La venta debe tener al menos un item.');
      return;
    }

    await updateSale.mutateAsync({
      saleId: sale.id,
      data: {
        customer_name: editCustomer || undefined,
        notes: editNotes || undefined,
        installments: editInstallments ? Number(editInstallments) : undefined,
        seller: editSeller,
        items,
      },
    });
    setIsEditing(false);
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

  const pendingDelivery = Number(sale.total_amount || 0) - Number(sale.delivered_amount || 0);
  const pendingPayment = Number(sale.total_amount || 0) - Number(sale.paid_amount || 0);

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
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>Editar venta</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} isLoading={updateSale.isPending}>
                Guardar cambios
              </Button>
            </>
          )}
          <Button variant="danger" onClick={handleDelete} isLoading={deleteSale.isPending}>
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-lg font-semibold">Items</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing && (
              <div className="border rounded-lg p-3 bg-gray-50">
                <div className="flex items-center gap-2 mb-3">
                  <Input
                    type="search"
                    placeholder="Buscar producto para agregar..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-56 overflow-y-auto space-y-2">
                  {(productsData?.items || []).map((product) => (
                    <div key={product.id} className="flex items-center justify-between border rounded px-3 py-2 bg-white">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 line-clamp-1">
                          {product.custom_name || product.original_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          Stock: {product.stock_qty || 0}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => addProductToEdit(product)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Agregar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {visibleItems.length === 0 ? (
              <p className="text-sm text-gray-500">No hay items.</p>
            ) : (
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cant.</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Entregado</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Pagado</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Precio</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      {isEditing && <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Acción</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {visibleItems.map((item) => (
                      <tr key={item.product_id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-900">{item.product_name}</div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              min="1"
                              className="w-20 px-2 py-1 border rounded text-right"
                              value={item.quantity}
                              onChange={(e) => updateEditItem(item.product_id, { quantity: Number(e.target.value) })}
                            />
                          ) : (
                            item.quantity
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={item.delivered}
                            onChange={(e) => updateEditItem(item.product_id, { delivered: e.target.checked })}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600"
                            disabled={!isEditing}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={item.paid}
                            onChange={(e) => updateEditItem(item.product_id, { paid: e.target.checked })}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600"
                            disabled={!isEditing}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="w-28 px-2 py-1 border rounded text-right"
                              value={item.unit_price}
                              onChange={(e) => updateEditItem(item.product_id, { unit_price: Number(e.target.value) })}
                            />
                          ) : (
                            formatPrice(item.unit_price)
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatPrice(item.quantity * item.unit_price)}
                        </td>
                        {isEditing && (
                          <td className="px-3 py-2 text-right">
                            <Button variant="ghost" size="sm" onClick={() => removeEditItem(item.product_id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </td>
                        )}
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
              {isEditing ? (
                <Input value={editCustomer} onChange={(e) => setEditCustomer(e.target.value)} />
              ) : (
                <span className="font-medium">{sale.customer_name || '-'}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Vendedor</span>
              {isEditing ? (
                <select
                  value={editSeller}
                  onChange={(e) => setEditSeller(e.target.value as 'Facu' | 'Heber')}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="Facu">Facu</option>
                  <option value="Heber">Heber</option>
                </select>
              ) : (
                <span className="font-medium">{sale.seller}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Cuotas</span>
              {isEditing ? (
                <Input
                  type="number"
                  min="0"
                  value={editInstallments}
                  onChange={(e) => setEditInstallments(e.target.value)}
                />
              ) : (
                <span className="font-medium">{sale.installments ?? '-'}</span>
              )}
            </div>
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Total</span>
                <span className="text-lg font-bold text-gray-900">
                  {formatPrice(isEditing ? editedTotalAmount : sale.total_amount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Entregado</span>
                <span className="font-medium">{formatPrice(sale.delivered_amount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Pagado</span>
                <span className="font-medium">{formatPrice(sale.paid_amount)}</span>
              </div>
              {!isEditing && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Pendiente entrega</span>
                    <span className={`font-medium ${pendingDelivery > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {formatPrice(Math.max(0, pendingDelivery))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Pendiente pago</span>
                    <span className={`font-medium ${pendingPayment > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {formatPrice(Math.max(0, pendingPayment))}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div>
              <label className="block text-gray-500 mb-1">Notas</label>
              {isEditing ? (
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              ) : (
                <div className="text-gray-900 whitespace-pre-line">{sale.notes || '-'}</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
