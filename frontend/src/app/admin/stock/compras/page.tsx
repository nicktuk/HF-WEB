'use client';

import { useState, useRef, type ChangeEvent } from 'react';
import { FileDown, X, Plus, Trash2, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ModalContent, ModalFooter } from '@/components/ui/modal';
import { useApiKey } from '@/hooks/useAuth';
import {
  useAllStockPurchases,
  useAddPaymentsToPurchase,
  useDeletePayment,
} from '@/hooks/useProducts';
import { adminApi } from '@/lib/api';
import { formatDate, formatPrice } from '@/lib/utils';
import type { StockPreviewResponse } from '@/types';
import { useQueryClient } from '@tanstack/react-query';

const PAYMENT_METHODS = [
  'Efectivo',
  'Transferencia',
  'Tarjeta de débito',
  'Tarjeta de crédito',
  'MercadoPago',
];

export default function ComprasPage() {
  const apiKey = useApiKey() || '';
  const queryClient = useQueryClient();

  // Filters
  const [page, setPage] = useState(1);
  const [payer, setPayer] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Import state
  const [isImportingStock, setIsImportingStock] = useState(false);
  const [stockImportResult, setStockImportResult] = useState<{
    created: number;
    skipped: number;
    errors: string[];
    touched_products: number;
  } | null>(null);
  const [stockPreview, setStockPreview] = useState<StockPreviewResponse | null>(null);
  const [stockPreviewPage, setStockPreviewPage] = useState(1);
  const [stockPreviewFile, setStockPreviewFile] = useState<File | null>(null);
  const stockFileInputRef = useRef<HTMLInputElement>(null);

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showBulkPaymentModal, setShowBulkPaymentModal] = useState(false);
  const [isAddingBulkPayment, setIsAddingBulkPayment] = useState(false);

  // Payment form state
  const [newPaymentPayer, setNewPaymentPayer] = useState<'Facu' | 'Heber'>('Facu');
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentMethod, setNewPaymentMethod] = useState(PAYMENT_METHODS[0]);

  // Expanded rows for inline view
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Data hooks
  const { data: purchasesData, isLoading } = useAllStockPurchases(apiKey, {
    page,
    limit: 50,
    payer: payer || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  const deletePayment = useDeletePayment(apiKey);

  // Calculate selected totals
  const selectedPurchases = purchasesData?.items.filter((p: any) => selectedIds.includes(p.id)) || [];
  const selectedTotal = selectedPurchases.reduce((sum: number, p: any) => sum + parseFloat(p.total_amount), 0);
  const selectedPaidTotal = selectedPurchases.reduce((sum: number, p: any) => {
    const paid = p.payments?.reduce((s: number, pay: any) => s + parseFloat(pay.amount), 0) || 0;
    return sum + paid;
  }, 0);
  const selectedPending = selectedTotal - selectedPaidTotal;

  // Import handlers
  const handleImportStockClick = () => {
    stockFileInputRef.current?.click();
  };

  const handleImportStockFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportingStock(true);
    try {
      const preview = await adminApi.previewStockCsv(apiKey, file);
      setStockPreview(preview);
      setStockPreviewPage(1);
      setStockPreviewFile(file);
    } catch (error) {
      setStockImportResult({
        created: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : 'Error al importar stock'],
        touched_products: 0,
      });
    } finally {
      setIsImportingStock(false);
      if (stockFileInputRef.current) {
        stockFileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmImport = async () => {
    if (!stockPreviewFile) return;
    setIsImportingStock(true);
    try {
      const result = await adminApi.importStockCsv(apiKey, stockPreviewFile);
      setStockImportResult(result);
      setStockPreview(null);
      setStockPreviewFile(null);
    } catch (error) {
      setStockImportResult({
        created: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : 'Error al importar stock'],
        touched_products: 0,
      });
    } finally {
      setIsImportingStock(false);
    }
  };

  const handleDownloadErrors = () => {
    if (!stockImportResult?.errors?.length) return;
    const content = stockImportResult.errors.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'errores-importacion-stock.txt';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleAddBulkPayment = async () => {
    if (selectedIds.length === 0 || !newPaymentAmount) return;
    const totalAmount = parseFloat(newPaymentAmount);
    if (isNaN(totalAmount) || totalAmount <= 0) return;

    setIsAddingBulkPayment(true);
    try {
      // Distribute payment proportionally across selected purchases
      for (const purchase of selectedPurchases) {
        const purchaseTotal = parseFloat(purchase.total_amount);
        const proportion = purchaseTotal / selectedTotal;
        const paymentAmount = Math.round(totalAmount * proportion * 100) / 100;

        if (paymentAmount > 0) {
          await adminApi.addPaymentsToPurchase(apiKey, purchase.id, [
            {
              payer: newPaymentPayer,
              amount: paymentAmount,
              payment_method: newPaymentMethod,
            },
          ]);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['all-stock-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchases-by-payer'] });
      setShowBulkPaymentModal(false);
      setSelectedIds([]);
      setNewPaymentAmount('');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al agregar pagos');
    } finally {
      setIsAddingBulkPayment(false);
    }
  };

  const handleDeletePayment = async (purchaseId: number, paymentId: number) => {
    if (!confirm('¿Eliminar este pago?')) return;
    await deletePayment.mutateAsync({ purchaseId, paymentId });
  };

  const toggleSelection = (purchaseId: number) => {
    setSelectedIds((prev) =>
      prev.includes(purchaseId)
        ? prev.filter((id) => id !== purchaseId)
        : [...prev, purchaseId]
    );
  };

  const toggleSelectAll = () => {
    if (!purchasesData) return;
    const allIds = purchasesData.items.map((p: any) => p.id);
    if (selectedIds.length === allIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allIds);
    }
  };

  const toggleRowExpand = (purchaseId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(purchaseId)) {
      newExpanded.delete(purchaseId);
    } else {
      newExpanded.add(purchaseId);
    }
    setExpandedRows(newExpanded);
  };

  const clearFilters = () => {
    setPayer('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compras de Stock</h1>
          <p className="text-gray-600">Importa compras desde CSV y registra pagos.</p>
        </div>
        <Button onClick={handleImportStockClick} disabled={isImportingStock}>
          <FileDown className="mr-2 h-4 w-4" />
          Importar CSV
        </Button>
      </div>

      <input
        ref={stockFileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleImportStockFile}
      />

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pagador</label>
            <select
              value={payer}
              onChange={(e) => {
                setPayer(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Todos</option>
              <option value="Facu">Facu</option>
              <option value="Heber">Heber</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-40"
            />
          </div>
          {(payer || dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Selection bar */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-blue-900">
                <Check className="h-5 w-5" />
                <span className="font-medium">{selectedIds.length} compras seleccionadas</span>
              </div>
              <div className="text-sm text-blue-700">
                <span>Total: <strong>{formatPrice(selectedTotal)}</strong></span>
                <span className="mx-2">|</span>
                <span>Pagado: <strong className="text-green-700">{formatPrice(selectedPaidTotal)}</strong></span>
                <span className="mx-2">|</span>
                <span>Pendiente: <strong className={selectedPending > 0 ? 'text-red-600' : 'text-gray-600'}>{formatPrice(selectedPending)}</strong></span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  setNewPaymentAmount(selectedPending > 0 ? selectedPending.toFixed(2) : '');
                  setShowBulkPaymentModal(true);
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Registrar pago
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds([])}
                className="text-blue-700 hover:text-blue-900 hover:bg-blue-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Purchases table */}
      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Listado de compras</h2>
          {purchasesData && (
            <span className="text-sm text-gray-500">
              {purchasesData.total} compras
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-4 text-sm text-gray-500">Cargando compras...</div>
          ) : !purchasesData || purchasesData.items.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No hay compras registradas.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === purchasesData.items.length && purchasesData.items.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pagos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {purchasesData.items.map((purchase) => {
                  const isExpanded = expandedRows.has(purchase.id);
                  const isSelected = selectedIds.includes(purchase.id);
                  const totalPaid = purchase.payments?.reduce(
                    (sum: number, p: any) => sum + parseFloat(p.amount),
                    0
                  ) || 0;
                  const remaining = parseFloat(purchase.total_amount) - totalPaid;

                  return (
                    <>
                      <tr
                        key={purchase.id}
                        className={`hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`}
                      >
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection(purchase.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-2" onClick={() => toggleRowExpand(purchase.id)}>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </td>
                        <td className="px-3 py-2" onClick={() => toggleRowExpand(purchase.id)}>{formatDate(purchase.purchase_date)}</td>
                        <td className="px-3 py-2" onClick={() => toggleRowExpand(purchase.id)}>
                          <div className="font-medium text-gray-900 line-clamp-1">
                            {purchase.product_name || purchase.description || '-'}
                          </div>
                          <div className="text-xs text-gray-500">{purchase.code || '-'}</div>
                        </td>
                        <td className="px-3 py-2 text-right" onClick={() => toggleRowExpand(purchase.id)}>{purchase.quantity}</td>
                        <td className="px-3 py-2 text-right" onClick={() => toggleRowExpand(purchase.id)}>
                          <div className="font-medium">{formatPrice(purchase.total_amount)}</div>
                          {remaining > 0 && remaining < parseFloat(purchase.total_amount) && (
                            <div className="text-xs text-amber-600">Pend: {formatPrice(remaining)}</div>
                          )}
                        </td>
                        <td className="px-3 py-2" onClick={() => toggleRowExpand(purchase.id)}>
                          {purchase.payments?.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {purchase.payments.map((p: any) => (
                                <span
                                  key={p.id}
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    p.payer === 'Facu'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-green-100 text-green-800'
                                  }`}
                                >
                                  {p.payer}: {formatPrice(p.amount)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Sin pagos</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${purchase.id}-detail`}>
                          <td colSpan={8} className="bg-gray-50 px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Purchase info */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Detalle de compra</h4>
                                <dl className="text-sm space-y-1">
                                  <div className="flex justify-between">
                                    <dt className="text-gray-500">Precio unitario:</dt>
                                    <dd className="font-medium">{formatPrice(purchase.unit_price)}</dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-gray-500">Cantidad:</dt>
                                    <dd className="font-medium">{purchase.quantity}</dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-gray-500">Total:</dt>
                                    <dd className="font-medium">{formatPrice(purchase.total_amount)}</dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-gray-500">Pagado:</dt>
                                    <dd className="font-medium text-green-600">{formatPrice(totalPaid)}</dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-gray-500">Pendiente:</dt>
                                    <dd className={`font-medium ${remaining > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                      {formatPrice(remaining)}
                                    </dd>
                                  </div>
                                </dl>
                              </div>
                              {/* Payments */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Pagos registrados</h4>
                                {purchase.payments?.length > 0 ? (
                                  <div className="space-y-2">
                                    {purchase.payments.map((p: any) => (
                                      <div
                                        key={p.id}
                                        className="flex items-center justify-between bg-white rounded-lg border px-3 py-2"
                                      >
                                        <div>
                                          <span
                                            className={`font-medium ${
                                              p.payer === 'Facu' ? 'text-blue-700' : 'text-green-700'
                                            }`}
                                          >
                                            {p.payer}
                                          </span>
                                          <span className="mx-2 text-gray-400">-</span>
                                          <span className="text-gray-600">{p.payment_method}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold">{formatPrice(p.amount)}</span>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeletePayment(purchase.id, p.id);
                                            }}
                                            className="text-red-500 hover:text-red-700"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500">No hay pagos registrados.</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {/* Pagination */}
        {purchasesData && purchasesData.pages > 1 && (
          <div className="flex justify-center gap-2 p-4 border-t">
            <Button
              variant="outline"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              Anterior
            </Button>
            <span className="px-4 py-2 text-gray-600">
              Página {page} de {purchasesData.pages}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage(Math.min(purchasesData.pages, page + 1))}
              disabled={page === purchasesData.pages}
            >
              Siguiente
            </Button>
          </div>
        )}
      </div>

      {/* Bulk payment modal */}
      <Modal
        isOpen={showBulkPaymentModal}
        onClose={() => {
          setShowBulkPaymentModal(false);
          setNewPaymentAmount('');
        }}
        title="Registrar pago"
        size="md"
      >
        <ModalContent className="space-y-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-blue-800 space-y-2">
              <div className="flex justify-between">
                <span>Compras seleccionadas:</span>
                <span className="font-semibold">{selectedIds.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Total de compras:</span>
                <span className="font-semibold">{formatPrice(selectedTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Ya pagado:</span>
                <span className="font-semibold text-green-700">{formatPrice(selectedPaidTotal)}</span>
              </div>
              <div className="flex justify-between border-t border-blue-200 pt-2">
                <span>Pendiente:</span>
                <span className={`font-bold ${selectedPending > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                  {formatPrice(selectedPending)}
                </span>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-600">
            El monto ingresado se distribuirá proporcionalmente entre las compras seleccionadas.
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Pagador</label>
              <select
                value={newPaymentPayer}
                onChange={(e) => setNewPaymentPayer(e.target.value as 'Facu' | 'Heber')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="Facu">Facu</option>
                <option value="Heber">Heber</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Monto total</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={newPaymentAmount}
                onChange={(e) => setNewPaymentAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Método</label>
              <select
                value={newPaymentMethod}
                onChange={(e) => setNewPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview distribution */}
          {newPaymentAmount && parseFloat(newPaymentAmount) > 0 && (
            <div className="border rounded-lg">
              <div className="px-3 py-2 border-b bg-gray-50 text-sm font-medium text-gray-700">
                Vista previa de distribución
              </div>
              <div className="max-h-48 overflow-y-auto">
                {selectedPurchases.map((purchase: any) => {
                  const proportion = parseFloat(purchase.total_amount) / selectedTotal;
                  const paymentAmount = Math.round(parseFloat(newPaymentAmount) * proportion * 100) / 100;
                  return (
                    <div key={purchase.id} className="px-3 py-2 text-sm border-b last:border-b-0 flex justify-between">
                      <span className="text-gray-600 truncate max-w-[60%]">
                        {purchase.product_name || purchase.description || `Compra #${purchase.id}`}
                      </span>
                      <span className="font-medium">{formatPrice(paymentAmount)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </ModalContent>
        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => {
              setShowBulkPaymentModal(false);
              setNewPaymentAmount('');
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleAddBulkPayment}
            disabled={!newPaymentAmount || isAddingBulkPayment}
            isLoading={isAddingBulkPayment}
          >
            Registrar pago
          </Button>
        </ModalFooter>
      </Modal>

      {/* Import preview / result modal */}
      <Modal
        isOpen={!!stockPreview || !!stockImportResult}
        onClose={() => {
          setStockPreview(null);
          setStockImportResult(null);
          setStockPreviewFile(null);
        }}
        title={stockPreview ? 'Previsualización de importación de stock' : 'Resumen de importación de stock'}
        size="xl"
      >
        <ModalContent className="space-y-4">
          {stockPreview && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-500 uppercase">Total</p>
                  <p className="text-xl font-semibold text-gray-900">{stockPreview.summary.total}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-500 uppercase">OK</p>
                  <p className="text-xl font-semibold text-gray-900">{stockPreview.summary.ok}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-500 uppercase">Duplicados</p>
                  <p className="text-xl font-semibold text-gray-900">{stockPreview.summary.duplicate}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-500 uppercase">Errores</p>
                  <p className="text-xl font-semibold text-gray-900">{stockPreview.summary.error}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-500 uppercase">Sin match</p>
                  <p className="text-xl font-semibold text-gray-900">{stockPreview.summary.unmatched}</p>
                </div>
              </div>

              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fila</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Precio</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Errores</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {stockPreview.rows
                      .slice((stockPreviewPage - 1) * 50, stockPreviewPage * 50)
                      .map((row) => (
                        <tr key={row.row_number} className="hover:bg-gray-50">
                          <td className="px-3 py-2">{row.row_number}</td>
                          <td className="px-3 py-2">{row.product_name || row.description || '-'}</td>
                          <td className="px-3 py-2">
                            {row.code || '-'}
                            {row.derived_code ? <span className="ml-1 text-xs text-gray-400">(derivado)</span> : null}
                          </td>
                          <td className="px-3 py-2 text-right">{row.quantity ?? '-'}</td>
                          <td className="px-3 py-2 text-right">{row.unit_price ?? '-'}</td>
                          <td className="px-3 py-2 text-right">{row.total_amount ?? '-'}</td>
                          <td className="px-3 py-2">
                            {row.status === 'ok' && <span className="text-emerald-700 font-medium">OK</span>}
                            {row.status === 'duplicate' && <span className="text-amber-700 font-medium">Duplicado</span>}
                            {row.status === 'error' && <span className="text-red-600 font-medium">Error</span>}
                            {row.status === 'unmatched' && <span className="text-slate-600 font-medium">Sin match</span>}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">
                            {row.errors?.length ? row.errors.join('; ') : '-'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Página {stockPreviewPage} de {Math.max(1, Math.ceil(stockPreview.rows.length / 50))}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setStockPreviewPage(Math.max(1, stockPreviewPage - 1))}
                    disabled={stockPreviewPage === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setStockPreviewPage(Math.min(Math.ceil(stockPreview.rows.length / 50), stockPreviewPage + 1))
                    }
                    disabled={stockPreviewPage >= Math.ceil(stockPreview.rows.length / 50)}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </>
          )}

          {stockImportResult && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-500 uppercase">Creados</p>
                  <p className="text-xl font-semibold text-gray-900">{stockImportResult.created}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-500 uppercase">Omitidos</p>
                  <p className="text-xl font-semibold text-gray-900">{stockImportResult.skipped}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-500 uppercase">Errores</p>
                  <p className="text-xl font-semibold text-gray-900">{stockImportResult.errors?.length || 0}</p>
                </div>
              </div>

              {stockImportResult.errors?.length > 0 && (
                <div className="border rounded-lg">
                  <div className="px-3 py-2 border-b bg-gray-50 text-sm font-medium text-gray-700">
                    Detalle de errores
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {stockImportResult.errors.map((err, idx) => (
                      <div key={idx} className="px-3 py-2 text-sm text-gray-700 border-b last:border-b-0">
                        {err}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </ModalContent>
        <ModalFooter>
          {stockPreview ? (
            <>
              <Button variant="outline" onClick={() => setStockPreview(null)}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={(stockPreview.summary.ok + stockPreview.summary.unmatched) === 0 || isImportingStock}
                isLoading={isImportingStock}
              >
                Confirmar importación
              </Button>
            </>
          ) : (
            <>
              {stockImportResult?.errors?.length ? (
                <Button variant="outline" onClick={handleDownloadErrors}>
                  Descargar errores
                </Button>
              ) : null}
              <Button onClick={() => setStockImportResult(null)}>Cerrar</Button>
            </>
          )}
        </ModalFooter>
      </Modal>
    </div>
  );
}
