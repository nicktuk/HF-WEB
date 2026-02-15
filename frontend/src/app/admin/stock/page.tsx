'use client';

import { useState } from 'react';
import { Search, Plus, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal, ModalContent, ModalFooter } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { ManualProductForm } from '@/components/admin/ManualProductForm';
import { useApiKey } from '@/hooks/useAuth';
import { useUnmatchedStockPurchases, useUpdateStockPurchase, useAdminProducts } from '@/hooks/useProducts';
import { downloadCsv } from '@/lib/csv';
import { formatDate, formatPrice } from '@/lib/utils';

export default function StockUnmatchedPage() {
  const apiKey = useApiKey() || '';
  const { data: purchases, isLoading } = useUnmatchedStockPurchases(apiKey);
  const updatePurchase = useUpdateStockPurchase(apiKey);

  const [selectedPurchaseId, setSelectedPurchaseId] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [showManualModal, setShowManualModal] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<any | null>(null);

  const { data: productsData, isLoading: isLoadingProducts } = useAdminProducts(apiKey, {
    page: 1,
    limit: 20,
    search: productSearch || undefined,
  });

  const selectedPurchase = purchases?.find(p => p.id === selectedPurchaseId) || null;

  const handleExportUnmatchedCsv = () => {
    if (!purchases?.length) return;
    const rows = purchases.map((purchase) => [
      purchase.id,
      formatDate(purchase.purchase_date),
      purchase.description || '',
      purchase.code || '',
      purchase.quantity,
      Number(purchase.unit_price || 0).toFixed(2),
      Number(purchase.total_amount || 0).toFixed(2),
    ]);
    downloadCsv(
      'compras_sin_match.csv',
      ['ID', 'Fecha', 'Descripcion', 'Codigo', 'Cantidad', 'Precio unitario', 'Total'],
      rows,
    );
  };

  const handleAssociate = async (productId: number) => {
    if (!selectedPurchase) return;
    try {
      await updatePurchase.mutateAsync({ purchaseId: selectedPurchase.id, productId });
      setSelectedPurchaseId(null);
    } catch (err: any) {
      const detail = err?.detail;
      if (detail?.error === 'duplicate_stock_purchase') {
        setDuplicateInfo(detail);
      } else {
        alert(err?.message || 'Error al asociar la compra');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Compras sin match</h1>
        <p className="text-gray-600">Seleccioná una compra y asociála a un producto existente.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Unmatched purchases */}
        <div className="bg-white rounded-lg border">
          <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Compras sin producto</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportUnmatchedCsv}
              disabled={!purchases?.length}
            >
              <FileDown className="h-4 w-4 mr-1.5" />
              Exportar CSV
            </Button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-sm text-gray-500">Cargando compras...</div>
            ) : !purchases || purchases.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">No hay compras sin match.</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {purchases.map((purchase) => (
                    <tr
                      key={purchase.id}
                      className={`cursor-pointer hover:bg-gray-50 ${selectedPurchaseId === purchase.id ? 'bg-blue-50' : ''}`}
                      onClick={() => setSelectedPurchaseId(purchase.id)}
                    >
                      <td className="px-3 py-2">{formatDate(purchase.purchase_date)}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900 line-clamp-1">
                          {purchase.description || '-'}
                        </div>
                        <div className="text-xs text-gray-500">{purchase.code || '-'}</div>
                      </td>
                      <td className="px-3 py-2 text-right">{purchase.quantity}</td>
                      <td className="px-3 py-2 text-right">{formatPrice(purchase.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Product search */}
        <div className="bg-white rounded-lg border">
          <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Buscar producto</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowManualModal(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Crear producto manual
            </Button>
          </div>
          <div className="p-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="search"
                placeholder="Buscar por nombre, SKU o slug..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {!selectedPurchase && (
              <div className="text-sm text-gray-500">
                Seleccioná una compra para habilitar la asociación.
              </div>
            )}

            {isLoadingProducts ? (
              <div className="text-sm text-gray-500">Buscando productos...</div>
            ) : !productsData || productsData.items.length === 0 ? (
              <div className="text-sm text-gray-500">No hay resultados.</div>
            ) : (
              <div className="divide-y border rounded-lg">
                {productsData.items.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleAssociate(product.id)}
                    disabled={!selectedPurchase || updatePurchase.isPending}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 line-clamp-1">
                        {product.custom_name || product.original_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        SKU: {product.sku || '-'} · {product.source_website_name || 'Manual'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showManualModal && (
        <ManualProductForm
          onClose={() => setShowManualModal(false)}
          onSuccess={async (productId) => {
            try {
              if (selectedPurchaseId && productId) {
                await updatePurchase.mutateAsync({ purchaseId: selectedPurchaseId, productId });
                setSelectedPurchaseId(null);
              }
              setShowManualModal(false);
            } catch (err: any) {
              const detail = err?.detail;
              if (detail?.error === 'duplicate_stock_purchase') {
                setDuplicateInfo(detail);
              } else {
                alert(err?.message || 'Error al asociar la compra');
              }
            }
          }}
          initialValues={
            selectedPurchase
              ? {
                  name: selectedPurchase.description || '',
                  sku: selectedPurchase.code || '',
                  price: selectedPurchase.unit_price || '',
                  short_description: selectedPurchase.description || '',
                }
              : undefined
          }
          priceAsOriginal
        />
      )}

      <Modal
        isOpen={!!duplicateInfo}
        onClose={() => setDuplicateInfo(null)}
        title="Compra duplicada"
        size="md"
      >
        <ModalContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Ya existe una compra igual asociada a este producto.
          </p>
          {duplicateInfo?.existing && (
            <div className="border rounded-lg p-3 space-y-2 text-sm">
              <div><strong>Descripción:</strong> {duplicateInfo.existing.description || '-'}</div>
              <div><strong>Código:</strong> {duplicateInfo.existing.code || '-'}</div>
              <div><strong>Fecha:</strong> {duplicateInfo.existing.purchase_date}</div>
              <div><strong>Cantidad:</strong> {duplicateInfo.existing.quantity}</div>
              <div><strong>Precio unitario:</strong> {duplicateInfo.existing.unit_price}</div>
              <div><strong>Total:</strong> {duplicateInfo.existing.total_amount}</div>
            </div>
          )}
        </ModalContent>
        <ModalFooter>
          <Button onClick={() => setDuplicateInfo(null)}>Cerrar</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
