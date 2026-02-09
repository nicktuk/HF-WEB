'use client';

import { useMemo, useState } from 'react';
import { CheckCircle, CreditCard, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiKey } from '@/hooks/useAuth';
import { useAdminProducts, useCreateSale } from '@/hooks/useProducts';
import { formatPrice } from '@/lib/utils';
import type { ProductAdmin, SaleItemCreate } from '@/types';

interface CartItem {
  product: ProductAdmin;
  quantity: number;
  unit_price: number;
}

export default function VentasPage() {
  const apiKey = useApiKey() || '';
  const [search, setSearch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [installments, setInstallments] = useState('');
  const [seller, setSeller] = useState<'Facu' | 'Heber'>('Facu');
  const [delivered, setDelivered] = useState(false);
  const [paid, setPaid] = useState(false);

  const createSale = useCreateSale(apiKey);

  const { data: productsData, isLoading } = useAdminProducts(apiKey, {
    page: 1,
    limit: 100,
    in_stock: true,
    search: search || undefined,
  });

  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const addToCart = (product: ProductAdmin) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      const defaultPrice = Number(product.final_price ?? product.custom_price ?? product.original_price ?? 0);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1, unit_price: defaultPrice || 0 }];
    });
  };

  const updateQuantity = (productId: number, quantity: number) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: Math.max(0, quantity) }
          : item
      ).filter((item) => item.quantity > 0)
    );
  };

  const updateUnitPrice = (productId: number, price: number) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, unit_price: Math.max(0, price) }
          : item
      )
    );
  };

  const removeItem = (productId: number) => {
    setCartItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const totalAmount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
  }, [cartItems]);

  const handleCreateSale = async () => {
    const items: SaleItemCreate[] = cartItems.map((item) => ({
      product_id: item.product.id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }));

    await createSale.mutateAsync({
      customer_name: customerName || undefined,
      notes: notes || undefined,
      installments: installments ? Number(installments) : undefined,
      seller,
      delivered,
      paid,
      items,
    });

    setCartItems([]);
    setCustomerName('');
    setNotes('');
    setInstallments('');
    setDelivered(false);
    setPaid(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ventas</h1>
        <p className="text-gray-600">Productos en stock y armado de venta.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left: Stock list */}
        <div className="bg-white rounded-lg border">
          <div className="px-4 py-3 border-b flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="search"
                placeholder="Buscar en stock..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <span className="text-xs text-gray-500">
              {productsData?.items.length || 0} productos
            </span>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-sm text-gray-500">Cargando stock...</div>
            ) : !productsData || productsData.items.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">No hay productos en stock.</div>
            ) : (
              <div className="divide-y">
                {productsData.items.map((product) => (
                  <div key={product.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 line-clamp-1">
                        {product.custom_name || product.original_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        Stock: {product.stock_qty || 0} · Precio: {formatPrice(product.final_price ?? product.custom_price ?? product.original_price ?? 0)}
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
              <div className="flex items-center gap-3 mt-6 md:mt-7">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={delivered}
                    onChange={(e) => setDelivered(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600"
                  />
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  Entregado
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={paid}
                    onChange={(e) => setPaid(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600"
                  />
                  <CreditCard className="h-4 w-4 text-blue-600" />
                  Pagado
                </label>
              </div>
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
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Precio</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {cartItems.map((item) => (
                      <tr key={item.product.id}>
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-900 line-clamp-1">
                            {item.product.custom_name || item.product.original_name}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            className="w-20 px-2 py-1 border rounded text-right"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.product.id, Number(e.target.value))}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            className="w-28 px-2 py-1 border rounded text-right"
                            value={item.unit_price}
                            onChange={(e) => updateUnitPrice(item.product.id, Number(e.target.value))}
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatPrice(item.quantity * item.unit_price)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button variant="ghost" size="sm" onClick={() => removeItem(item.product.id)}>
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
    </div>
  );
}
