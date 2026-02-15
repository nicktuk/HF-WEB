'use client';

import { Fragment, useMemo, useState } from 'react';
import { Plus, Search, X, ExternalLink, Edit2, AlertTriangle, Check } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ModalContent, ModalFooter } from '@/components/ui/modal';
import { useApiKey } from '@/hooks/useAuth';
import { useAdminProducts, useCreateSale, useSales, useUpdateSale, useStockSummary } from '@/hooks/useProducts';
import { adminApi } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import type { ProductAdmin, SaleItemCreate } from '@/types';

interface CartItem {
  id: string;
  product: ProductAdmin | null;
  manualName?: string;
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

export default function VentasPage() {
  const apiKey = useApiKey() || '';
  const [search, setSearch] = useState('');
  const [salesSearch, setSalesSearch] = useState('');
  const [deliveredFilter, setDeliveredFilter] = useState<'all' | 'yes' | 'no' | 'partial'>('all');
  const [paidFilter, setPaidFilter] = useState<'all' | 'yes' | 'no' | 'partial'>('all');
  const [showPartials, setShowPartials] = useState(false);
  const [showCreateSaleModal, setShowCreateSaleModal] = useState(false);
  const [stockShortageOnly, setStockShortageOnly] = useState(false);
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null);
  const [editingSaleId, setEditingSaleId] = useState<number | null>(null);
  const [editCustomer, setEditCustomer] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editInstallments, setEditInstallments] = useState('');
  const [editSeller, setEditSeller] = useState<'Facu' | 'Heber'>('Facu');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [installments, setInstallments] = useState('');
  const [seller, setSeller] = useState<'Facu' | 'Heber'>('Facu');
  const [manualProductName, setManualProductName] = useState('');
  const [manualProductPrice, setManualProductPrice] = useState('');
  const [manualProductQty, setManualProductQty] = useState('1');
  const [isReconcilingStock, setIsReconcilingStock] = useState(false);

  const createSale = useCreateSale(apiKey);
  const { data: salesData, isLoading: isSalesLoading } = useSales(apiKey, 100, salesSearch || undefined);
  const updateSale = useUpdateSale(apiKey);

  const { data: productsData, isLoading } = useAdminProducts(apiKey, {
    page: 1,
    limit: 100,
    search: search || undefined,
  });

  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const addToCart = (product: ProductAdmin) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product?.id === product.id);
      const defaultPrice = getProductSaleUnitPrice(product);
      if (existing) {
        return prev.map((item) =>
          item.product?.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { id: `p-${product.id}`, product, quantity: 1, unit_price: defaultPrice || 0, delivered: false, paid: false }];
    });
  };

  const addManualToCart = () => {
    const name = manualProductName.trim();
    const qty = Math.max(1, Number(manualProductQty || 1));
    const price = Math.max(0, Number(manualProductPrice || 0));
    if (!name) {
      alert('Ingresá el nombre del producto manual.');
      return;
    }
    if (price <= 0) {
      alert('Ingresá un precio mayor a 0 para el producto manual.');
      return;
    }

    setCartItems((prev) => [
      ...prev,
      {
        id: `m-${Date.now()}-${prev.length}`,
        product: null,
        manualName: name,
        quantity: qty,
        unit_price: price,
        delivered: false,
        paid: false,
      },
    ]);
    setManualProductName('');
    setManualProductPrice('');
    setManualProductQty('1');
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, quantity: Math.max(0, quantity) }
          : item
      ).filter((item) => item.quantity > 0)
    );
  };

  const updateUnitPrice = (itemId: string, price: number) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, unit_price: Math.max(0, price) }
          : item
      )
    );
  };

  const removeItem = (itemId: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const updateItemCheck = (itemId: string, field: 'delivered' | 'paid', value: boolean) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, [field]: value }
          : item
      )
    );
  };

  const totalAmount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
  }, [cartItems]);

  const handleCreateSale = async () => {
    const items: SaleItemCreate[] = cartItems.map((item) => ({
      product_id: item.product?.id,
      product_name: item.product ? undefined : item.manualName,
      quantity: item.quantity,
      unit_price: item.unit_price,
      delivered: item.delivered,
      paid: item.paid,
    }));

    await createSale.mutateAsync({
      customer_name: customerName || undefined,
      notes: notes || undefined,
      installments: installments ? Number(installments) : undefined,
      seller,
      items,
    });

    setCartItems([]);
    setCustomerName('');
    setNotes('');
    setInstallments('');
    setShowCreateSaleModal(false);
  };

  const getProgressStatus = (total: number, amount: number): 'none' | 'partial' | 'full' => {
    if (total <= 0 || amount <= 0) return 'none';
    if (amount >= total - 0.01) return 'full';
    return 'partial';
  };

  const renderProgressCheck = (status: 'none' | 'partial' | 'full') => {
    if (status === 'full') {
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check className="h-4 w-4" />
        </span>
      );
    }

    if (status === 'partial') {
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-white">
          <Check className="h-4 w-4" />
        </span>
      );
    }

    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-white" />
    );
  };

  const filteredSales = useMemo(() => {
    if (!salesData) return [];
    return salesData.filter((sale) => {
      const total = Number(sale.total_amount || 0);
      const deliveredAmount = Number(sale.delivered_amount || 0);
      const paidAmount = Number(sale.paid_amount || 0);
      const isDeliveredPartial = total > 0 && deliveredAmount > 0 && deliveredAmount < total;
      const isPaidPartial = total > 0 && paidAmount > 0 && paidAmount < total;

      if (deliveredFilter !== 'all') {
        if (deliveredFilter === 'yes') {
          if (!sale.delivered && !(showPartials && isDeliveredPartial)) return false;
        }
        if (deliveredFilter === 'no') {
          if (sale.delivered) return false;
          if (!showPartials && isDeliveredPartial) return false;
        }
        if (deliveredFilter === 'partial' && !isDeliveredPartial) return false;
      }
      if (paidFilter !== 'all') {
        if (paidFilter === 'yes') {
          if (!sale.paid && !(showPartials && isPaidPartial)) return false;
        }
        if (paidFilter === 'no') {
          if (sale.paid) return false;
          if (!showPartials && isPaidPartial) return false;
        }
        if (paidFilter === 'partial' && !isPaidPartial) return false;
      }
      return true;
    });
  }, [salesData, deliveredFilter, paidFilter, showPartials]);

  const saleProductIds = useMemo(() => {
    const ids = new Set<number>();
    (salesData || []).forEach((sale) => {
      sale.items.forEach((item) => {
        if (item.product_id) ids.add(item.product_id);
      });
    });
    return Array.from(ids);
  }, [salesData]);

  const { data: stockSummary } = useStockSummary(apiKey, saleProductIds);
  const stockMap = useMemo(() => {
    const map = new Map<number, number>();
    stockSummary?.items?.forEach((item) => map.set(item.product_id, item.stock_qty));
    return map;
  }, [stockSummary]);

  const salesWithStockShortage = useMemo(() => {
      return filteredSales.filter((sale) => {
        if (sale.delivered) return false;
        return sale.items.some((item) => {
          if (!item.product_id) return false;
          const available = stockMap.get(item.product_id) ?? 0;
          const deliveredQty = item.delivered ? item.quantity : 0;
          const pendingQty = Math.max(0, item.quantity - deliveredQty);
          return pendingQty > available;
        });
      });
    }, [filteredSales, stockMap]);

  const getShortageQty = (productId: number | undefined, pendingQuantity: number) => {
    if (!productId) return 0;
    const available = stockMap.get(productId) ?? 0;
    return Math.max(0, pendingQuantity - available);
  };

  const groupedSales = useMemo(() => {
    const groups: Record<string, typeof filteredSales> = {};
    filteredSales.forEach((sale) => {
      const key = sale.seller || 'Sin vendedor';
      if (!groups[key]) groups[key] = [];
      groups[key].push(sale);
    });
    return Object.entries(groups).map(([sellerKey, items]) => ({
      seller: sellerKey,
      items,
    }));
  }, [filteredSales]);

  const totals = useMemo(() => {
    const totalSales = salesData?.length || 0;
    const totalItems = (salesData || []).reduce((acc, sale) => acc + sale.items.reduce((sum, item) => sum + item.quantity, 0), 0);
    const totalAmount = (salesData || []).reduce((acc, sale) => acc + Number(sale.delivered_amount || 0), 0);
    return { totalSales, totalItems, totalAmount };
  }, [salesData]);

  const filteredTotals = useMemo(() => {
    const base = stockShortageOnly ? salesWithStockShortage : filteredSales;
    const totalSales = base.length;
    const totalItems = base.reduce((acc, sale) => acc + sale.items.reduce((sum, item) => sum + item.quantity, 0), 0);
    const totalAmount = base.reduce((acc, sale) => acc + Number(sale.delivered_amount || 0), 0);
    return { totalSales, totalItems, totalAmount };
  }, [filteredSales, salesWithStockShortage, stockShortageOnly]);

  const openEditModal = (saleId: number) => {
    const sale = salesData?.find((s) => s.id === saleId);
    if (!sale) return;
    setEditCustomer(sale.customer_name || '');
    setEditNotes(sale.notes || '');
    setEditInstallments(sale.installments != null ? String(sale.installments) : '');
    setEditSeller(sale.seller);
    setEditingSaleId(saleId);
  };

  const handleSaveEdit = async () => {
    if (!editingSaleId) return;
    await updateSale.mutateAsync({
      saleId: editingSaleId,
      data: {
        customer_name: editCustomer || undefined,
        notes: editNotes || undefined,
        installments: editInstallments ? Number(editInstallments) : undefined,
        seller: editSeller,
      },
    });
    setEditingSaleId(null);
  };

  const handleReconcileDeliveredStock = async () => {
    if (!confirm('Esto recalcula todos los descuentos de stock según unidades entregadas. ¿Continuar?')) return;
    setIsReconcilingStock(true);
    try {
      const result = await adminApi.reconcileDeliveredStock(apiKey);
      const lines = [
        `Ventas procesadas: ${result.sales_processed}`,
        `Unidades a descontar: ${result.units_requested}`,
        `Unidades descontadas: ${result.units_deducted}`,
      ];
      if (result.shortages?.length) {
        lines.push('', 'Faltantes:');
        lines.push(...result.shortages.slice(0, 20));
        if (result.shortages.length > 20) {
          lines.push(`... y ${result.shortages.length - 20} más`);
        }
      }
      alert(lines.join('\n'));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al reconciliar stock');
    } finally {
      setIsReconcilingStock(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ventas</h1>
        <p className="text-gray-600">Gestión de ventas y seguimiento de entregas/pagos.</p>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setShowCreateSaleModal(true)}>Nueva venta</Button>
      </div>

      <Modal
        isOpen={showCreateSaleModal}
        onClose={() => setShowCreateSaleModal(false)}
        title="Nueva venta"
        size="xl"
      >
        <ModalContent className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Left: Stock list */}
        <div className="bg-white rounded-lg border">
          <div className="px-4 py-3 border-b flex items-center gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="search"
                placeholder="Buscar producto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <span className="text-xs text-gray-500">
              {productsData?.items.length || 0} productos
            </span>
          </div>
          <div>
            {isLoading ? (
              <div className="p-4 text-sm text-gray-500">Cargando stock...</div>
            ) : !productsData || productsData.items.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">No hay productos.</div>
            ) : (
              <div className="divide-y">
                {productsData.items.map((product) => (
                  <div key={product.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 line-clamp-1">
                        {product.custom_name || product.original_name}
                      </div>
                      <div className={`text-xs ${Number(product.stock_qty || 0) > 0 ? 'text-gray-500' : 'text-amber-700'}`}>
                        Stock: {product.stock_qty || 0} · Precio: {formatPrice(
                          getProductSaleUnitPrice(product)
                        )}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => addToCart(product)}>
                      <Plus className="h-4 w-4 mr-1.5" />
                      Agregar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Sale form */}
        <div className="bg-white rounded-lg border">
          <div className="px-4 py-3 border-b">
            <h2 className="text-lg font-semibold">Venta</h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Cliente"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nombre del cliente"
              />
              <Input
                label="Cuotas"
                type="number"
                min="0"
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendedor</label>
                <select
                  value={seller}
                  onChange={(e) => setSeller(e.target.value as 'Facu' | 'Heber')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="Facu">Facu</option>
                  <option value="Heber">Heber</option>
                </select>
              </div>
              <div />
            </div>

            <div className="border rounded-lg p-3 bg-gray-50 space-y-3">
              <p className="text-sm font-medium text-gray-700">Agregar producto manual</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Input
                  label="Nombre"
                  value={manualProductName}
                  onChange={(e) => setManualProductName(e.target.value)}
                  placeholder="Ej: Producto especial"
                />
                <Input
                  label="Cantidad"
                  type="number"
                  min="1"
                  value={manualProductQty}
                  onChange={(e) => setManualProductQty(e.target.value)}
                />
                <Input
                  label="Precio"
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualProductPrice}
                  onChange={(e) => setManualProductPrice(e.target.value)}
                />
                <div className="flex items-end">
                  <Button type="button" variant="outline" className="w-full" onClick={addManualToCart}>
                    Agregar manual
                  </Button>
                </div>
              </div>
              <p className="text-xs text-amber-700">Los productos manuales no descuentan stock.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionales..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={3}
              />
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 text-sm font-medium text-gray-700">
                Items de la venta
              </div>
              {cartItems.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">No hay items.</div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Entregado</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Pagado</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Precio</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {cartItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-900 line-clamp-1">
                            {item.product ? (item.product.custom_name || item.product.original_name) : (item.manualName || 'Producto manual')}
                          </div>
                          <div className={`text-xs ${item.product && Number(item.product.stock_qty || 0) > 0 ? 'text-gray-500' : 'text-amber-700'}`}>
                            {item.product
                              ? `Stock disponible: ${item.product.stock_qty || 0}${Number(item.product.stock_qty || 0) <= 0 ? ' (Sin unidades)' : ''}`
                              : 'Producto manual sin stock'}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            className="w-20 px-2 py-1 border rounded text-right"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={item.delivered}
                            onChange={(e) => updateItemCheck(item.id, 'delivered', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={item.paid}
                            onChange={(e) => updateItemCheck(item.id, 'paid', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            className="w-28 px-2 py-1 border rounded text-right"
                            value={item.unit_price}
                            onChange={(e) => updateUnitPrice(item.id, Number(e.target.value))}
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatPrice(item.quantity * item.unit_price)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-sm text-gray-600">
                Total
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatPrice(totalAmount)}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleCreateSale}
              disabled={cartItems.length === 0 || createSale.isPending}
              isLoading={createSale.isPending}
            >
              Crear venta
            </Button>
          </div>
        </div>
      </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowCreateSaleModal(false)}>Cerrar</Button>
        </ModalFooter>
      </Modal>

      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Ventas existentes</h2>
              <p className="text-sm text-gray-500">
                El stock se descuenta al marcar items como Entregados.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={handleReconcileDeliveredStock}
                isLoading={isReconcilingStock}
              >
                Reconciliar stock entregado
              </Button>
              <span className="text-xs text-gray-500">
                {filteredSales.length} ventas
              </span>
            </div>
          </div>
          {deliveredFilter === 'all' && paidFilter === 'all' && !salesSearch && !showPartials && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-gray-500 uppercase">Ventas totales</p>
                <p className="text-2xl font-bold text-gray-900">{totals.totalSales}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-gray-500 uppercase">Items vendidos</p>
                <p className="text-2xl font-bold text-gray-900">{totals.totalItems}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-gray-500 uppercase">Valorizado entregado</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(totals.totalAmount)}</p>
              </div>
            </div>
          )}
          {(deliveredFilter !== 'all' || paidFilter !== 'all' || salesSearch || showPartials) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 bg-gray-50">
                <p className="text-xs text-gray-500 uppercase">Ventas filtradas</p>
                <p className="text-2xl font-bold text-gray-900">{filteredTotals.totalSales}</p>
              </div>
              <div className="rounded-lg border p-3 bg-gray-50">
                <p className="text-xs text-gray-500 uppercase">Items vendidos</p>
                <p className="text-2xl font-bold text-gray-900">{filteredTotals.totalItems}</p>
              </div>
              <div className="rounded-lg border p-3 bg-gray-50">
                <p className="text-xs text-gray-500 uppercase">Valorizado entregado</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(filteredTotals.totalAmount)}</p>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="search"
                placeholder="Buscar por cliente o producto..."
                value={salesSearch}
                onChange={(e) => setSalesSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Entregado</label>
              <select
                value={deliveredFilter}
                onChange={(e) => setDeliveredFilter(e.target.value as 'all' | 'yes' | 'no' | 'partial')}
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">Todos</option>
                <option value="yes">Sí</option>
                <option value="no">No</option>
                <option value="partial">Parcial</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Pagado</label>
              <select
                value={paidFilter}
                onChange={(e) => setPaidFilter(e.target.value as 'all' | 'yes' | 'no' | 'partial')}
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">Todos</option>
                <option value="yes">Sí</option>
                <option value="no">No</option>
                <option value="partial">Parcial</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showPartials}
                onChange={(e) => setShowPartials(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600"
              />
              Mostrar parciales
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={stockShortageOnly}
                onChange={(e) => setStockShortageOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600"
              />
              Ventas sin stock
            </label>
          </div>
        </div>
        {isSalesLoading ? (
          <div className="p-4 text-sm text-gray-500">Cargando ventas...</div>
        ) : (stockShortageOnly ? salesWithStockShortage.length === 0 : filteredSales.length === 0) ? (
          <div className="p-4 text-sm text-gray-500">No hay ventas registradas.</div>
        ) : (
          <div className="space-y-4">
            {(stockShortageOnly ? groupedSales.map((group) => ({
              ...group,
              items: group.items.filter((sale) => salesWithStockShortage.some((s) => s.id === sale.id)),
            })).filter((group) => group.items.length > 0) : groupedSales).map((group) => (
              <div key={group.seller} className="border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                  <div className="font-semibold text-gray-900">{group.seller}</div>
                  <div className="text-xs text-gray-500">{group.items.length} ventas</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Items</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          {showPartials ? 'Total entregado' : 'Total'}
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Entregado</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Pagado</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {group.items.map((sale) => (
                        <Fragment key={sale.id}>
                          <tr
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => setExpandedSaleId(expandedSaleId === sale.id ? null : sale.id)}
                          >
                            <td className="px-3 py-2 font-medium text-gray-900">#{sale.id}</td>
                            <td className="px-3 py-2 text-gray-700">{sale.customer_name || '-'}</td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {sale.items.length} item{sale.items.length === 1 ? '' : 's'}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              {formatPrice(showPartials ? sale.delivered_amount : sale.total_amount)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {renderProgressCheck(
                                getProgressStatus(
                                  Number(sale.total_amount || 0),
                                  Number(sale.delivered_amount || 0),
                                ),
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {renderProgressCheck(
                                getProgressStatus(
                                  Number(sale.total_amount || 0),
                                  Number(sale.paid_amount || 0),
                                ),
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex justify-end gap-3">
                                <button
                                  className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditModal(sale.id);
                                  }}
                                >
                                  <Edit2 className="h-3 w-3" />
                                  Editar
                                </button>
                                <Link
                                  href={`/admin/ventas/${sale.id}`}
                                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Ver
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              </div>
                            </td>
                          </tr>
                          {expandedSaleId === sale.id && (
                            <tr className="bg-gray-50">
                              <td colSpan={7} className="px-4 py-3">
                                <div className="overflow-x-auto border rounded-lg bg-white">
                                  <table className="min-w-full text-sm">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cant. pedida</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cant. entregada</th>
                                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Pagado</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Precio</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                      {sale.items.map((item) => {
                                        const effectiveDeliveredQty = item.delivered
                                          ? item.quantity
                                          : 0;
                                        const pendingQty = Math.max(0, item.quantity - effectiveDeliveredQty);
                                        const shortage = getShortageQty(item.product_id, pendingQty);
                                        return (
                                          <tr key={item.id} className={shortage > 0 ? 'bg-amber-50' : undefined}>
                                            <td className="px-3 py-2 text-gray-900">
                                              <div className="flex items-center gap-2">
                                                {shortage > 0 && (
                                                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                                                )}
                                                <span>{item.product_name || (item.product_id ? `Producto #${item.product_id}` : 'Producto manual')}</span>
                                                {shortage > 0 && (
                                                  <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                                    Faltan {shortage}
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                            <td className="px-3 py-2 text-right">{item.quantity}</td>
                                            <td className="px-3 py-2 text-right">{effectiveDeliveredQty}</td>
                                            <td className="px-3 py-2 text-center">{item.paid ? 'Si' : 'No'}</td>
                                            <td className="px-3 py-2 text-right">{formatPrice(item.unit_price)}</td>
                                            <td className="px-3 py-2 text-right font-medium">{formatPrice(item.total_price)}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                      <tr className="bg-gray-50 font-semibold">
                        <td className="px-3 py-2 text-gray-700">Totales</td>
                        <td className="px-3 py-2 text-gray-700">-</td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {group.items.reduce((acc, sale) => acc + sale.items.reduce((sum, item) => sum + item.quantity, 0), 0)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900">
                          {formatPrice(
                            group.items.reduce(
                              (acc, sale) =>
                                acc + Number(showPartials ? sale.delivered_amount || 0 : sale.total_amount || 0),
                              0,
                            ),
                          )}
                        </td>
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2" />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingSaleId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Editar venta #{editingSaleId}</h2>
              <button onClick={() => setEditingSaleId(null)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <Input
                label="Cliente"
                value={editCustomer}
                onChange={(e) => setEditCustomer(e.target.value)}
                placeholder="Nombre del cliente"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendedor</label>
                <select
                  value={editSeller}
                  onChange={(e) => setEditSeller(e.target.value as 'Facu' | 'Heber')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="Facu">Facu</option>
                  <option value="Heber">Heber</option>
                </select>
              </div>
              <Input
                label="Cuotas"
                type="number"
                min="0"
                value={editInstallments}
                onChange={(e) => setEditInstallments(e.target.value)}
                placeholder="0"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Notas adicionales..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <Button variant="outline" onClick={() => setEditingSaleId(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit} isLoading={updateSale.isPending}>
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
