'use client';

import { useState, useRef, type ChangeEvent } from 'react';
import { FileDown, Search, X, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ModalContent, ModalFooter } from '@/components/ui/modal';
import { useApiKey } from '@/hooks/useAuth';
import {
  useAllStockPurchases,
  useStockPurchaseDetail,
  useAddPaymentsToPurchase,
  useDeletePayment,
} from '@/hooks/useProducts';
import { adminApi } from '@/lib/api';
import { formatDate, formatPrice } from '@/lib/utils';
import type { StockPreviewResponse } from '@/types';

const PAYMENT_METHODS = [
  'Efectivo',
  'Transferencia',
  'Tarjeta de débito',
  'Tarjeta de crédito',
  'MercadoPago',
];

export default function ComprasPage() {
  const apiKey = useApiKey() || '';

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

  // Detail modal state
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<number | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

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

  const { data: purchaseDetail } = useStockPurchaseDetail(apiKey, selectedPurchaseId);
  const addPayments = useAddPaymentsToPurchase(apiKey);
  const deletePayment = useDeletePayment(apiKey);

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

  const handleOpenDetail = (purchaseId: number) => {
    setSelectedPurchaseId(purchaseId);
    setShowDetailModal(true);
    setNewPaymentAmount('');
    setNewPaymentMethod(PAYMENT_METHODS[0]);
  };

  const handleAddPayment = async () => {
    if (!selectedPurchaseId || !newPaymentAmount) return;
    const amount = parseFloat(newPaymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    await addPayments.mutateAsync({
      purchaseId: selectedPurchaseId,
      payments: [
        {
          payer: newPaymentPayer,
          amount,
          payment_method: newPaymentMethod,
        },
      ],
    });
    setNewPaymentAmount('');
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!selectedPurchaseId) return;
    if (!confirm('¿Eliminar este pago?')) return;
    await deletePayment.mutateAsync({ purchaseId: selectedPurchaseId, paymentId });
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
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pagos</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {purchasesData.items.map((purchase) => {
                  const isExpanded = expandedRows.has(purchase.id);
                  const totalPaid = purchase.payments?.reduce(
                    (sum: number, p: any) => sum + parseFloat(p.amount),
                    0
                  ) || 0;
                  const remaining = parseFloat(purchase.total_amount) - totalPaid;

                  return (
                    <>
                      <tr
                        key={purchase.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleRowExpand(purchase.id)}
                      >
                        <td className="px-3 py-2">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </td>
                        <td className="px-3 py-2">{formatDate(purchase.purchase_date)}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-900 line-clamp-1">
                            {purchase.product_name || purchase.description || '-'}
                          </div>
                          <div className="text-xs text-gray-500">{purchase.code || '-'}</div>
                        </td>
                        <td className="px-3 py-2 text-right">{purchase.quantity}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatPrice(purchase.total_amount)}</td>
                        <td className="px-3 py-2">
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
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetail(purchase.id);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Pago
                          </Button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${purchase.id}-detail`}>
                          <td colSpan={7} className="bg-gray-50 px-6 py-4">
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
                                              setSelectedPurchaseId(purchase.id);
                                              handleDeletePayment(p.id);
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

      {/* Detail / Add payment modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedPurchaseId(null);
        }}
        title="Agregar pago a compra"
        size="md"
      >
        <ModalContent className="space-y-4">
          {purchaseDetail && (
            <>
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Producto:</span>
                  <span className="font-medium">
                    {purchaseDetail.product_name || purchaseDetail.description || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total compra:</span>
                  <span className="font-medium">{formatPrice(purchaseDetail.total_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Pagado:</span>
                  <span className="font-medium text-green-600">
                    {formatPrice(
                      purchaseDetail.payments?.reduce(
                        (sum: number, p: any) => sum + parseFloat(p.amount),
                        0
                      ) || 0
                    )}
                  </span>
                </div>
              </div>

              {/* Existing payments */}
              {purchaseDetail.payments?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Pagos existentes</h4>
                  <div className="space-y-2">
                    {purchaseDetail.payments.map((p: any) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                      >
                        <div className="text-sm">
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
                            onClick={() => handleDeletePayment(p.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New payment form */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Agregar nuevo pago</h4>
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
                    <label className="block text-xs font-medium text-gray-700 mb-1">Monto</label>
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
              </div>
            </>
          )}
        </ModalContent>
        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => {
              setShowDetailModal(false);
              setSelectedPurchaseId(null);
            }}
          >
            Cerrar
          </Button>
          <Button
            onClick={handleAddPayment}
            disabled={!newPaymentAmount || addPayments.isPending}
            isLoading={addPayments.isPending}
          >
            Agregar pago
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
