'use client';

import { useState, useRef, type ChangeEvent } from 'react';
import { FileDown, X, Plus, Trash2, Eye, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ModalContent, ModalFooter } from '@/components/ui/modal';
import { useApiKey } from '@/hooks/useAuth';
import {
  usePurchases,
  useSuppliers,
  usePurchaseDetail,
  useAddPaymentToPurchase,
  useDeletePayment,
  useImportStockWithSupplier,
} from '@/hooks/useProducts';
import { adminApi } from '@/lib/api';
import { downloadCsv } from '@/lib/csv';
import { formatDate, formatPrice } from '@/lib/utils';
import type { StockPreviewResponse } from '@/types';

const PAYMENT_METHODS = [
  'Efectivo',
  'Transferencia',
  'Tarjeta de débito',
  'Tarjeta de crédito',
  'MercadoPago',
];

interface Purchase {
  id: number;
  supplier: string;
  purchase_date: string;
  notes: string | null;
  total_amount: number;
  total_paid: number;
  item_count: number;
  created_at: string;
}

interface PurchaseDetail {
  id: number;
  supplier: string;
  purchase_date: string;
  notes: string | null;
  total_amount: number;
  total_paid: number;
  created_at: string;
  items: Array<{
    id: number;
    product_id: number | null;
    product_name: string | null;
    description: string | null;
    code: string | null;
    quantity: number;
    unit_price: number;
    total_amount: number;
  }>;
  payments: Array<{
    id: number;
    payer: string;
    amount: number;
    payment_method: string;
    created_at: string;
  }>;
}

export default function ComprasPage() {
  const apiKey = useApiKey() || '';

  // Filters
  const [page, setPage] = useState(1);
  const [supplier, setSupplier] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Import state
  const [isImportingStock, setIsImportingStock] = useState(false);
  const [stockImportResult, setStockImportResult] = useState<{
    purchase_id: number;
    created: number;
    skipped: number;
    errors: string[];
    touched_products: number;
  } | null>(null);
  const [stockPreview, setStockPreview] = useState<StockPreviewResponse | null>(null);
  const [stockPreviewPage, setStockPreviewPage] = useState(1);
  const [stockPreviewFile, setStockPreviewFile] = useState<File | null>(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const stockFileInputRef = useRef<HTMLInputElement>(null);

  // Detail modal state
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<number | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Payment form state
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [newPaymentPayer, setNewPaymentPayer] = useState<'Facu' | 'Heber'>('Facu');
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentMethod, setNewPaymentMethod] = useState(PAYMENT_METHODS[0]);
  // Data hooks
  const { data: purchasesData, isLoading } = usePurchases(apiKey, {
    page,
    limit: 20,
    supplier: supplier || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  const { data: suppliersData } = useSuppliers(apiKey);
  const { data: purchaseDetail, isLoading: isLoadingDetail } = usePurchaseDetail(apiKey, selectedPurchaseId);
  const addPayment = useAddPaymentToPurchase(apiKey);
  const deletePayment = useDeletePayment(apiKey);
  const importStock = useImportStockWithSupplier(apiKey);

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
      setShowSupplierModal(true);
    } catch (error) {
      setStockImportResult({
        purchase_id: 0,
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
      const result = await importStock.mutateAsync({
        file: stockPreviewFile,
      });
      setStockImportResult(result);
      setStockPreview(null);
      setStockPreviewFile(null);
      setShowSupplierModal(false);
    } catch (error) {
      setStockImportResult({
        purchase_id: 0,
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

  const handleAddPayment = async () => {
    if (!selectedPurchaseId || !newPaymentAmount) return;
    const amount = parseFloat(newPaymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    try {
      await addPayment.mutateAsync({
        purchaseId: selectedPurchaseId,
        payment: {
          payer: newPaymentPayer,
          amount,
          payment_method: newPaymentMethod,
        },
      });
      setShowPaymentForm(false);
      setNewPaymentAmount('');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al agregar pago');
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!selectedPurchaseId || !confirm('¿Eliminar este pago?')) return;
    await deletePayment.mutateAsync({ purchaseId: selectedPurchaseId, paymentId });
  };

  const openDetailModal = (purchaseId: number) => {
    setSelectedPurchaseId(purchaseId);
    setShowDetailModal(true);
    setShowPaymentForm(false);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedPurchaseId(null);
    setShowPaymentForm(false);
    setNewPaymentAmount('');
  };

  const clearFilters = () => {
    setSupplier('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const detail = purchaseDetail as PurchaseDetail | undefined;
  const remaining = detail ? detail.total_amount - detail.total_paid : 0;
  const handleExportPurchasesCsv = () => {
    if (!purchasesData?.items?.length) return;
    const rows = purchasesData.items.map((purchase: Purchase) => {
      const pending = Number(purchase.total_amount || 0) - Number(purchase.total_paid || 0);
      return [
        purchase.id,
        formatDate(purchase.purchase_date),
        purchase.supplier,
        purchase.item_count,
        Number(purchase.total_amount || 0).toFixed(2),
        Number(purchase.total_paid || 0).toFixed(2),
        pending.toFixed(2),
        purchase.notes || '',
      ];
    });
    downloadCsv(
      `compras_pagina_${page}.csv`,
      ['ID', 'Fecha', 'Mayorista', 'Items', 'Total', 'Pagado', 'Pendiente', 'Notas'],
      rows,
    );
  };

  const handleExportPurchaseDetailItemsCsv = () => {
    if (!detail?.items?.length) return;
    const rows = detail.items.map((item) => [
      item.id,
      item.product_name || item.description || '',
      item.code || '',
      item.quantity,
      Number(item.unit_price || 0).toFixed(2),
      Number(item.total_amount || 0).toFixed(2),
    ]);
    downloadCsv(
      `compra_${detail.id}_items.csv`,
      ['ID', 'Producto', 'Codigo', 'Cantidad', 'Precio unitario', 'Total'],
      rows,
    );
  };

  const handleExportPurchaseDetailPaymentsCsv = () => {
    if (!detail?.payments?.length) return;
    const rows = detail.payments.map((payment) => [
      payment.id,
      payment.payer,
      payment.payment_method,
      Number(payment.amount || 0).toFixed(2),
      formatDate(payment.created_at),
    ]);
    downloadCsv(
      `compra_${detail.id}_pagos.csv`,
      ['ID', 'Pagador', 'Metodo', 'Monto', 'Fecha'],
      rows,
    );
  };

  const handleExportPreviewCsv = () => {
    if (!stockPreview?.rows?.length) return;
    const rows = stockPreview.rows.map((row) => [
      row.row_number,
      row.product_name || row.description || '',
      row.code || '',
      row.quantity ?? '',
      row.unit_price ?? '',
      row.total_amount ?? '',
      row.status,
      row.supplier || '',
      (row.errors || []).join(' | '),
    ]);
    downloadCsv(
      'preview_importacion_compras.csv',
      ['Fila', 'Producto', 'Codigo', 'Cantidad', 'Precio', 'Total', 'Estado', 'Mayorista', 'Errores'],
      rows,
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compras</h1>
          <p className="text-gray-600">Importa compras desde CSV y registra pagos por mayorista.</p>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Mayorista</label>
            <select
              value={supplier}
              onChange={(e) => {
                setSupplier(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500 min-w-[150px]"
            >
              <option value="">Todos</option>
              {suppliersData?.suppliers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
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
          {(supplier || dateFrom || dateTo) && (
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
          <div className="flex items-center gap-3">
            {purchasesData && (
              <span className="text-sm text-gray-500">
                {purchasesData.total} compras
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPurchasesCsv}
              disabled={!purchasesData?.items?.length}
            >
              <FileDown className="h-4 w-4 mr-1" />
              Exportar CSV
            </Button>
          </div>
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
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mayorista</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Items</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Pagado</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Pendiente</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {purchasesData.items.map((purchase: Purchase) => {
                  const pendingAmount = purchase.total_amount - purchase.total_paid;
                  return (
                    <tr key={purchase.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{formatDate(purchase.purchase_date)}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{purchase.supplier}</span>
                        {purchase.notes && (
                          <p className="text-xs text-gray-500 truncate max-w-xs">{purchase.notes}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <Package className="h-3 w-3 mr-1" />
                          {purchase.item_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatPrice(purchase.total_amount)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={purchase.total_paid > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
                          {formatPrice(purchase.total_paid)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={pendingAmount > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                          {formatPrice(pendingAmount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetailModal(purchase.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
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

      {/* Purchase detail modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={closeDetailModal}
        title="Detalle de compra"
        size="xl"
      >
        <ModalContent className="space-y-4">
          {isLoadingDetail ? (
            <div className="py-8 text-center text-gray-500">Cargando...</div>
          ) : detail ? (
            <>
              {/* Header info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Mayorista</p>
                    <p className="font-semibold text-gray-900">{detail.supplier}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Fecha</p>
                    <p className="font-semibold text-gray-900">{formatDate(detail.purchase_date)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total</p>
                    <p className="font-semibold text-gray-900">{formatPrice(detail.total_amount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Pendiente</p>
                    <p className={`font-semibold ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatPrice(remaining)}
                    </p>
                  </div>
                </div>
                {detail.notes && (
                  <p className="mt-3 text-sm text-gray-600 border-t pt-3">{detail.notes}</p>
                )}
              </div>

              {/* Items */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-gray-700">Items ({detail.items.length})</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportPurchaseDetailItemsCsv}
                    disabled={!detail.items.length}
                  >
                    <FileDown className="h-4 w-4 mr-1" />
                    Exportar CSV
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cant.</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">P.Unit</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {detail.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-900">
                              {item.product_name || item.description || '-'}
                            </div>
                            {item.code && (
                              <div className="text-xs text-gray-500">{item.code}</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">{formatPrice(item.unit_price)}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatPrice(item.total_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">Pagos</h3>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleExportPurchaseDetailPaymentsCsv}
                      disabled={!detail.payments.length}
                    >
                      <FileDown className="h-4 w-4 mr-1" />
                      Exportar CSV
                    </Button>
                    {!showPaymentForm && (
                      <Button size="sm" variant="outline" onClick={() => setShowPaymentForm(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Agregar pago
                      </Button>
                    )}
                  </div>
                </div>

                {/* Payment form */}
                {showPaymentForm && (
                  <div className="border rounded-lg p-4 mb-3 bg-blue-50">
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
                          placeholder={remaining > 0 ? remaining.toFixed(2) : '0.00'}
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
                    <div className="flex justify-end gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowPaymentForm(false);
                          setNewPaymentAmount('');
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleAddPayment}
                        disabled={!newPaymentAmount || addPayment.isPending}
                        isLoading={addPayment.isPending}
                      >
                        Guardar
                      </Button>
                    </div>
                  </div>
                )}

                {/* Payments list */}
                {detail.payments.length > 0 ? (
                  <div className="space-y-2">
                    {detail.payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between bg-white rounded-lg border px-4 py-3"
                      >
                        <div className="flex items-center gap-4">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              p.payer === 'Facu'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {p.payer}
                          </span>
                          <span className="text-gray-600 text-sm">{p.payment_method}</span>
                          <span className="text-xs text-gray-400">{formatDate(p.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900">{formatPrice(p.amount)}</span>
                          <button
                            onClick={() => handleDeletePayment(p.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            disabled={deletePayment.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-4 text-center border rounded-lg bg-gray-50">
                    No hay pagos registrados.
                  </p>
                )}

                {/* Summary */}
                <div className="mt-4 pt-4 border-t flex justify-end gap-6 text-sm">
                  <div>
                    <span className="text-gray-500">Total pagado:</span>
                    <span className="ml-2 font-semibold text-green-600">{formatPrice(detail.total_paid)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Pendiente:</span>
                    <span className={`ml-2 font-semibold ${remaining > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {formatPrice(remaining)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-gray-500">Error al cargar la compra.</div>
          )}
        </ModalContent>
        <ModalFooter>
          <Button variant="outline" onClick={closeDetailModal}>
            Cerrar
          </Button>
        </ModalFooter>
      </Modal>

      {/* Supplier input modal (before confirming import) */}
      <Modal
        isOpen={showSupplierModal && !!stockPreview}
        onClose={() => {
          setShowSupplierModal(false);
          setStockPreview(null);
          setStockPreviewFile(null);
        }}
        title="Importar compra"
        size="xl"
      >
        <ModalContent className="space-y-4">
          {/* Preview summary */}
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

              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleExportPreviewCsv} disabled={!stockPreview.rows.length}>
                  <FileDown className="h-4 w-4 mr-1" />
                  Exportar CSV preview
                </Button>
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
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mayorista</th>
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
                          <td className="px-3 py-2">{row.supplier || '-'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {stockPreview.rows.length > 50 && (
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
              )}
            </>
          )}
        </ModalContent>
        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => {
              setShowSupplierModal(false);
              setStockPreview(null);
              setStockPreviewFile(null);
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmImport}
            disabled={
              !stockPreview ||
              (stockPreview.summary.ok + stockPreview.summary.unmatched) === 0 ||
              isImportingStock
            }
            isLoading={isImportingStock}
          >
            Confirmar importación
          </Button>
        </ModalFooter>
      </Modal>

      {/* Import result modal */}
      <Modal
        isOpen={!!stockImportResult}
        onClose={() => setStockImportResult(null)}
        title="Resumen de importación"
        size="md"
      >
        <ModalContent className="space-y-4">
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

              {stockImportResult.purchase_id > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-green-700">
                    Compra creada con ID: <strong>#{stockImportResult.purchase_id}</strong>
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      openDetailModal(stockImportResult.purchase_id);
                      setStockImportResult(null);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Ver compra
                  </Button>
                </div>
              )}

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
          {stockImportResult?.errors?.length ? (
            <Button variant="outline" onClick={handleDownloadErrors}>
              Descargar errores
            </Button>
          ) : null}
          <Button onClick={() => setStockImportResult(null)}>Cerrar</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

