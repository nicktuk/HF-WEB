'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useApiKey } from '@/hooks/useAuth';
import { useAdminProducts, useDeleteSale, useSale, useUpdateSale, useUpdateSaleInstallment, useCatalogSellers } from '@/hooks/useProducts';
import { resolveImageUrl } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import type { ProductAdmin, SaleInstallment } from '@/types';

interface EditItem {
  line_id: string;
  product_id?: number;
  product_name: string;
  color?: string | null;
  quantity: number;
  unit_price: number;
  delivered: boolean;
  paid: boolean;
}

const getProductSaleUnitPrice = (product: ProductAdmin): number => {
  const customPrice = Number(product.custom_price ?? 0);
  if (customPrice > 0) return customPrice;
  const originalPrice = Number(product.original_price ?? 0);
  if (originalPrice <= 0) return 0;
  const markup = Number(product.markup_percentage ?? 0);
  return Number((originalPrice * (1 + markup / 100)).toFixed(2));
};

function getProductThumbUrl(product: ProductAdmin): string | null {
  const img = product.images.find((i) => i.is_primary) || product.images[0];
  if (!img) return null;
  return resolveImageUrl(img.url) ?? img.url;
}

function getProductColors(product: ProductAdmin): { color: string; quantity: number | null; name: string | null }[] {
  const colorAggMap = new Map<string, number>();
  for (const cs of product.color_stock || []) {
    colorAggMap.set(cs.color, (colorAggMap.get(cs.color) || 0) + cs.quantity);
  }
  const imageColors = (product.images || []).filter((img) => img.color).map((img) => img.color!);
  const allKeys = Array.from(new Set([...Array.from(colorAggMap.keys()), ...imageColors]));
  const nameMap = Object.fromEntries(
    (product.images || []).filter((img) => img.color && img.alt_text).map((img) => [img.color!, img.alt_text!]),
  );
  return allKeys.map((color) => ({
    color,
    quantity: colorAggMap.has(color) ? (colorAggMap.get(color) ?? 0) : null,
    name: nameMap[color] ?? null,
  }));
}

export default function SaleDetailPage() {
  const params = useParams();
  const saleId = parseInt(params.id as string, 10);
  const router = useRouter();
  const searchParams = useSearchParams();
  const apiKey = useApiKey() || '';

  const { data: sale, isLoading } = useSale(apiKey, saleId);
  const deleteSale = useDeleteSale(apiKey);
  const updateSale = useUpdateSale(apiKey);
  const updateInstallmentMutation = useUpdateSaleInstallment(apiKey);
  const [togglingInstallmentId, setTogglingInstallmentId] = useState<number | null>(null);

  const [isEditing, setIsEditing] = useState(() => searchParams?.get('mode') === 'edit');
  const [editCustomer, setEditCustomer] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editInstallments, setEditInstallments] = useState('');
  const [editSellerId, setEditSellerId] = useState<number | ''>('');
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [productSearch, setProductSearch] = useState('');

  const { data: sellers } = useCatalogSellers(apiKey, true);

  const { data: productsData } = useAdminProducts(apiKey, {
    page: 1,
    limit: 100,
    search: productSearch || undefined,
  });

  const sortedProducts = useMemo(() => {
    const items = productsData?.items || [];
    return [...items].sort((a, b) => {
      const sA = Number(a.stock_qty || 0);
      const sB = Number(b.stock_qty || 0);
      if (sA > 0 && sB <= 0) return -1;
      if (sA <= 0 && sB > 0) return 1;
      return 0;
    });
  }, [productsData]);

  // Map for quick product lookup by id (used for color selectors in items table)
  const productMap = useMemo(() => {
    const map = new Map<number, ProductAdmin>();
    for (const p of productsData?.items || []) {
      map.set(p.id, p);
    }
    return map;
  }, [productsData]);

  useEffect(() => {
    if (!sale) return;
    setEditCustomer(sale.customer_name || '');
    setEditNotes(sale.notes || '');
    setEditInstallments(sale.installments != null ? String(sale.installments) : '');
    setEditSellerId(sale.seller_id);
    setEditItems(
      sale.items.map((item) => ({
        line_id: `sale-item-${item.id}`,
        product_id: item.product_id ?? undefined,
        product_name: item.product_name || (item.product_id ? `Producto #${item.product_id}` : 'Producto manual'),
        color: item.color ?? null,
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
      line_id: `sale-item-${item.id}`,
      product_id: item.product_id ?? undefined,
      product_name: item.product_name || (item.product_id ? `Producto #${item.product_id}` : 'Producto manual'),
      color: item.color ?? null,
      quantity: item.quantity,
      unit_price: Number(item.unit_price || 0),
      delivered: !!item.delivered,
      paid: !!item.paid,
    }));
  }, [isEditing, editItems, sale?.items]);

  const handleDelete = async () => {
    if (!sale) return;
    if (!confirm('¿Eliminar esta venta y revertir stock entregado?')) return;
    try {
      await deleteSale.mutateAsync({ saleId: sale.id });
      router.push('/admin/ventas');
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('stock') || msg.includes('revertir')) {
        if (confirm('No se pudo revertir el stock (ya fue consumido). ¿Eliminar la venta de todas formas?')) {
          try {
            await deleteSale.mutateAsync({ saleId: sale.id, force: true });
            router.push('/admin/ventas');
          } catch (e2) {
            alert(e2 instanceof Error ? e2.message : 'Error al eliminar la venta');
          }
        }
      } else {
        alert(msg || 'Error al eliminar la venta');
      }
    }
  };

  const addProductToEdit = (product: ProductAdmin, color?: string | null) => {
    const colorKey = color ?? 'none';
    const lineId = `new-product-${product.id}-${colorKey}`;
    const defaultPrice = getProductSaleUnitPrice(product);

    setEditItems((prev) => {
      const exists = prev.find((item) => item.line_id === lineId);
      if (exists) {
        return prev.map((item) =>
          item.line_id === lineId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          line_id: lineId,
          product_id: product.id,
          product_name: product.custom_name || product.original_name || '',
          color: color ?? null,
          quantity: 1,
          unit_price: Number(defaultPrice || 0),
          delivered: false,
          paid: false,
        },
      ];
    });
  };

  const updateEditItem = (lineId: string, patch: Partial<EditItem>) => {
    setEditItems((prev) =>
      prev
        .map((item) => (item.line_id === lineId ? { ...item, ...patch } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const removeEditItem = (lineId: string) => {
    setEditItems((prev) => prev.filter((item) => item.line_id !== lineId));
  };

  const handleSave = async () => {
    if (!sale) return;

    // Validate color only for items not yet delivered (already-delivered items skip this)
    const missingColor = editItems.filter((item) => {
      if (!item.product_id) return false;
      if (item.delivered) return false;
      const product = productMap.get(item.product_id);
      if (!product) return false;
      const hasColors = getProductColors(product).length > 0;
      return hasColors && !item.color;
    });
    if (missingColor.length > 0) {
      const names = missingColor.map((i) => i.product_name).join(', ');
      alert(`Seleccionar color obligatorio para: ${names}`);
      return;
    }

    const items = editItems.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_id ? undefined : item.product_name,
      color: item.color ?? undefined,
      quantity: Math.max(0, Number(item.quantity || 0)),
      unit_price: Math.max(0, Number(item.unit_price || 0)),
      delivered: !!item.delivered,
      paid: !!item.paid,
    }));

    if (!items.length || items.some((item) => item.quantity <= 0 || item.unit_price <= 0)) {
      alert('La venta debe tener al menos un item.');
      return;
    }

    const baseData = {
      customer_name: editCustomer || undefined,
      notes: editNotes || undefined,
      installments: editInstallments ? Number(editInstallments) : undefined,
      seller_id: editSellerId || undefined,
      items,
    };

    try {
      await updateSale.mutateAsync({ saleId: sale.id, data: baseData });
      setIsEditing(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('stock') || msg.includes('revertir')) {
        if (confirm('No se pudo revertir el stock de los productos eliminados (ya fue consumido). ¿Guardar los cambios de todas formas?')) {
          try {
            await updateSale.mutateAsync({ saleId: sale.id, data: { ...baseData, force: true } });
            setIsEditing(false);
          } catch (e2) {
            alert(e2 instanceof Error ? e2.message : 'Error al guardar los cambios');
          }
        }
      } else {
        alert(msg || 'Error al guardar los cambios');
      }
    }
  };

  const handleToggleInstallment = async (inst: SaleInstallment, newPaid: boolean) => {
    if (!sale) return;
    setTogglingInstallmentId(inst.id);
    try {
      await updateInstallmentMutation.mutateAsync({ saleId: sale.id, installmentId: inst.id, data: { paid: newPaid } });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al actualizar la cuota');
    } finally {
      setTogglingInstallmentId(null);
    }
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
              {sale.seller_nombre} · {sale.customer_name || 'Sin cliente'} · {totalItems} items
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
              <Button onClick={() => void handleSave()} isLoading={updateSale.isPending}>
                Guardar cambios
              </Button>
            </>
          )}
          <Button variant="danger" onClick={() => void handleDelete()} isLoading={deleteSale.isPending}>
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
                  {sortedProducts.map((product) => {
                    const productColors = getProductColors(product);
                    const inStock = Number(product.stock_qty || 0) > 0;
                    const thumbUrl = getProductThumbUrl(product);
                    return (
                      <div key={product.id} className="flex items-center justify-between border rounded px-3 py-2 bg-white gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-20 h-20 rounded-lg border border-gray-100 bg-gray-50 shrink-0 overflow-hidden flex items-center justify-center">
                            {thumbUrl ? (
                              <Image src={thumbUrl} alt="" width={80} height={80} className="object-contain w-full h-full" />
                            ) : (
                              <div className="w-full h-full bg-gray-200 rounded-lg" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {product.display_name_with_code}
                            </p>
                            <p className="text-xs text-gray-500">
                              Stock: {product.stock_qty || 0}
                            </p>
                          </div>
                        </div>
                        {productColors.length > 0 ? (
                          <div className="flex flex-wrap gap-1 justify-end shrink-0">
                            {productColors.map(({ color, quantity, name }) => (
                              <button
                                key={color}
                                onClick={() => addProductToEdit(product, color)}
                                title={quantity !== null ? `${name || color} · ${quantity} disponibles` : (name || color)}
                                className="flex items-center gap-1 px-1.5 py-1 rounded border border-gray-300 text-xs bg-white hover:border-gray-500 transition-colors"
                              >
                                <span className="w-3 h-3 rounded-full border border-gray-200 shrink-0" style={{ backgroundColor: color }} />
                                {name && <span>{name}</span>}
                                {quantity !== null && <span className="text-gray-400">({quantity})</span>}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant={inStock ? 'outline' : 'ghost'}
                            onClick={() => addProductToEdit(product)}
                            className={!inStock ? 'text-gray-400 border border-dashed border-gray-300 hover:text-gray-600' : ''}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            {inStock ? 'Agregar' : 'Agregar igual'}
                          </Button>
                        )}
                      </div>
                    );
                  })}
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
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cobrado</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Precio</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      {isEditing && <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Acción</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {visibleItems.map((item) => {
                      const product = item.product_id ? productMap.get(item.product_id) : undefined;
                      const productColors = product ? getProductColors(product) : [];
                      const colorNameMap = product
                        ? Object.fromEntries(
                            (product.images || []).filter((img) => img.color && img.alt_text).map((img) => [img.color!, img.alt_text!]),
                          )
                        : {};
                      const missingColorWarning = isEditing && productColors.length > 0 && !item.color;
                      const thumbUrl = product ? getProductThumbUrl(product) : null;

                      return (
                        <tr key={item.line_id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <div className="flex items-start gap-2">
                              {thumbUrl && (
                                <div className="w-9 h-9 rounded border border-gray-100 bg-gray-50 shrink-0 overflow-hidden flex items-center justify-center">
                                  <Image src={thumbUrl} alt="" width={36} height={36} className="object-contain w-full h-full" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  {item.color && (
                                    <span
                                      className="w-3 h-3 rounded-full border border-gray-300 shrink-0"
                                      style={{ backgroundColor: item.color }}
                                    />
                                  )}
                                  {missingColorWarning && (
                                    <span className="text-amber-500 shrink-0" title="Color requerido">
                                      <AlertTriangle className="h-3.5 w-3.5" />
                                    </span>
                                  )}
                                  {item.product_id ? (
                                    <Link href={`/admin/productos/${item.product_id}`} className="font-medium text-blue-600 hover:text-blue-800 hover:underline">
                                      {item.product_name}
                                    </Link>
                                  ) : (
                                    <div className="font-medium text-gray-900">{item.product_name}</div>
                                  )}
                                </div>
                                {item.color && (
                                  <p className="text-xs text-gray-400 mt-0.5">{colorNameMap[item.color] || item.color}</p>
                                )}
                                {missingColorWarning && (
                                  <p className="text-xs text-amber-600 mt-0.5 font-medium">Color requerido</p>
                                )}
                                {/* Color selector in edit mode */}
                                {isEditing && productColors.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {productColors.map(({ color, quantity, name }) => (
                                      <button
                                        key={color}
                                        type="button"
                                        onClick={() =>
                                          updateEditItem(item.line_id, {
                                            color: item.color === color ? null : color,
                                          })
                                        }
                                        title={quantity !== null ? `${name || color} · ${quantity} disponibles` : (name || color)}
                                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded border transition-all text-xs ${
                                          item.color === color
                                            ? 'border-gray-800 bg-gray-50'
                                            : 'border-gray-300 hover:border-gray-500'
                                        } ${quantity !== null && quantity <= 0 ? 'opacity-40' : ''}`}
                                      >
                                        <span
                                          className="w-3 h-3 rounded-full border border-gray-200 shrink-0"
                                          style={{ backgroundColor: color }}
                                        />
                                        {name && <span className="text-gray-700">{name}</span>}
                                        {quantity !== null && <span className="text-gray-400">({quantity})</span>}
                                      </button>
                                    ))}
                                    {item.color && (
                                      <button
                                        type="button"
                                        onClick={() => updateEditItem(item.line_id, { color: null })}
                                        className="text-xs text-gray-400 hover:text-red-500"
                                        title="Quitar color"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {isEditing ? (
                              <input
                                type="number"
                                min="1"
                                className="w-20 px-2 py-1 border rounded text-right"
                                value={item.quantity}
                                onChange={(e) => updateEditItem(item.line_id, { quantity: Number(e.target.value) })}
                              />
                            ) : (
                              item.quantity
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={item.delivered}
                              onChange={(e) => updateEditItem(item.line_id, { delivered: e.target.checked })}
                              className="h-4 w-4 rounded border-gray-300 text-primary-600"
                              disabled={!isEditing}
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={item.paid}
                              onChange={(e) => updateEditItem(item.line_id, { paid: e.target.checked })}
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
                                onChange={(e) => updateEditItem(item.line_id, { unit_price: Number(e.target.value) })}
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
                              <Button variant="ghost" size="sm" onClick={() => removeEditItem(item.line_id)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
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
            {sale.phone && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Teléfono</span>
                <a href={`tel:${sale.phone}`} className="font-medium text-blue-600 hover:underline">{sale.phone}</a>
              </div>
            )}
            {sale.email && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Email</span>
                <a href={`mailto:${sale.email}`} className="font-medium text-blue-600 hover:underline">{sale.email}</a>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Vendedor</span>
              {isEditing ? (
                <select
                  value={editSellerId}
                  onChange={(e) => setEditSellerId(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {sellers?.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              ) : (
                <span className="font-medium flex items-center gap-2">
                  {sale.seller_nombre}
                  {sale.seller_nombre === 'Web' && (
                    <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full uppercase">Pedido web</span>
                  )}
                </span>
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
                <span className="text-gray-500">Cobrado</span>
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

      {sale.installment_list && sale.installment_list.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Cuotas</h2>
              <span className="text-sm text-gray-500">
                Cobrado: {formatPrice(Number(sale.paid_amount || 0))} / {formatPrice(Number(sale.total_amount || 0))}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sale.installment_list.map((inst) => (
                <div
                  key={inst.id}
                  className={`rounded-lg border p-3 flex items-center justify-between gap-3 ${
                    inst.paid ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'
                  }`}
                >
                  <div>
                    <p className="text-xs text-gray-500">Cuota {inst.number}</p>
                    <p className="text-base font-semibold text-gray-900">{formatPrice(Number(inst.amount))}</p>
                    {inst.paid_at && (
                      <p className="text-xs text-emerald-600 mt-0.5">
                        Pagada {new Date(inst.paid_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggleInstallment(inst, !inst.paid)}
                    disabled={togglingInstallmentId === inst.id}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                      inst.paid
                        ? 'bg-emerald-100 border-emerald-300 text-emerald-800 hover:bg-emerald-200'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {togglingInstallmentId === inst.id ? (
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />
                    ) : inst.paid ? (
                      'Pagada'
                    ) : (
                      'Marcar como pagada'
                    )}
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
