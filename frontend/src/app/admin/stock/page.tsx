'use client';

import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ManualProductForm } from '@/components/admin/ManualProductForm';
import { useApiKey } from '@/hooks/useAuth';
import { useAdminProducts, useUnmatchedStockPurchases, useUpdateStockPurchase } from '@/hooks/useProducts';
import { formatDate, formatPrice } from '@/lib/utils';

export default function StockUnmatchedPage() {
  const apiKey = useApiKey() || '';
  const { data: purchases, isLoading } = useUnmatchedStockPurchases(apiKey);
  const updatePurchase = useUpdateStockPurchase(apiKey);

  const [productSearch, setProductSearch] = useState('');
  const [activePurchaseForManual, setActivePurchaseForManual] = useState<number | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);

  const { data: productsData, isLoading: isLoadingProducts } = useAdminProducts(apiKey, {
    page: 1,
    limit: 200,
    search: productSearch || undefined,
  });

  const productOptions = useMemo(() => {
    return (productsData?.items || []).map((product) => ({
      id: product.id,
      label: `${product.custom_name || product.original_name}${product.sku ? ` · ${product.sku}` : ''}`,
    }));
  }, [productsData]);

  const handleAssociate = async (purchaseId: number, productId: number) => {
    await updatePurchase.mutateAsync({ purchaseId, productId });
  };

  const getInitialValues = (purchaseId: number | null) => {
    if (!purchaseId || !purchases) return undefined;
    const purchase = purchases.find((p) => p.id === purchaseId);
    if (!purchase) return undefined;
    return {
      name: purchase.description || '',
      sku: purchase.code || '',
      price: purchase.unit_price || '',
      short_description: purchase.description || '',
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compras sin match</h1>
          <p className="text-gray-600">Asociá cada compra con un producto existente o creá uno manual.</p>
        </div>
        <div className="bg-white rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Filtrar productos del combo (nombre, SKU o slug)"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="text-xs text-gray-500">
            {isLoadingProducts ? 'Cargando productos...' : `${productOptions.length} productos en el combo`}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="text-lg font-semibold">Compras sin producto</h2>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-sm text-gray-500">Cargando compras...</div>
          ) : !purchases || purchases.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No hay compras sin match.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto compra</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Asociar a</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {purchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(purchase.purchase_date)}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900 line-clamp-1">
                        {purchase.description || '-'}
                      </div>
                      <div className="text-xs text-gray-500">{purchase.code || '-'}</div>
                    </td>
                    <td className="px-3 py-2 text-right">{purchase.quantity}</td>
                    <td className="px-3 py-2 text-right">{formatPrice(purchase.total_amount)}</td>
                    <td className="px-3 py-2">
                      <select
                        defaultValue=""
                        disabled={updatePurchase.isPending || isLoadingProducts}
                        onChange={(e) => {
                          const productId = Number(e.target.value);
                          if (!productId) return;
                          handleAssociate(purchase.id, productId);
                          e.currentTarget.value = '';
                        }}
                        className="w-full max-w-xs px-2 py-1 text-sm border border-gray-200 rounded hover:border-gray-300 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white"
                      >
                        <option value="">Seleccionar producto...</option>
                        {productOptions.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActivePurchaseForManual(purchase.id);
                          setShowManualModal(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1.5" />
                        Crear manual
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showManualModal && (
        <ManualProductForm
          onClose={() => setShowManualModal(false)}
          onSuccess={async (productId) => {
            if (activePurchaseForManual && productId) {
              await updatePurchase.mutateAsync({ purchaseId: activePurchaseForManual, productId });
            }
            setShowManualModal(false);
            setActivePurchaseForManual(null);
          }}
          initialValues={getInitialValues(activePurchaseForManual)}
          priceAsOriginal
        />
      )}
    </div>
  );
}
