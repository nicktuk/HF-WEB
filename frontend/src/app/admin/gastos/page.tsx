'use client';

import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ModalContent, ModalFooter } from '@/components/ui/modal';
import { useApiKey } from '@/hooks/useAuth';
import { useExpenses, useCreateExpense, useDeleteExpense } from '@/hooks/useProducts';
import { adminApi } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import type { ExpenseCreateForm, PaymentMethodConfig } from '@/types';

const formatDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

const today = () => new Date().toISOString().split('T')[0];

export default function GastosPage() {
  const apiKey = useApiKey() || '';
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [formDate, setFormDate] = useState(today());
  const [formDescription, setFormDescription] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const { data, isLoading } = useExpenses(apiKey, {
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });
  const createMutation = useCreateExpense(apiKey);
  const deleteMutation = useDeleteExpense(apiKey);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>([]);

  useEffect(() => {
    if (apiKey) adminApi.getPaymentMethods(apiKey).then(setPaymentMethods).catch(() => {});
  }, [apiKey]);

  const expenses = data?.items ?? [];
  const total = data?.total ?? 0;

  // Group by date descending
  const grouped = useMemo(() => {
    const map: Record<string, typeof expenses> = {};
    for (const e of expenses) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [expenses]);

  const resetForm = () => {
    setFormDate(today());
    setFormDescription('');
    setFormPaymentMethod('');
    setFormAmount('');
    setFormNotes('');
    setEditingId(null);
  };

  const openNew = () => {
    resetForm();
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formDate || !formDescription || !formAmount) return;
    const payload: ExpenseCreateForm = {
      date: formDate,
      description: formDescription.trim(),
      payment_method: formPaymentMethod.trim() || undefined,
      amount: parseFloat(formAmount),
      notes: formNotes.trim() || undefined,
    };
    await createMutation.mutateAsync(payload);
    setShowModal(false);
    resetForm();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    await deleteMutation.mutateAsync(id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gastos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Registro de egresos del negocio</p>
        </div>
        <Button onClick={openNew} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nuevo gasto
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Desde</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="text-xs text-gray-400 hover:text-gray-600 underline self-end pb-1.5"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Total */}
      {expenses.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4">
          <TrendingDown className="h-5 w-5 text-rose-500 shrink-0" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">Total gastos</p>
            <p className="text-2xl font-bold text-rose-700">{formatPrice(Number(total))}</p>
          </div>
          <span className="ml-auto text-sm text-rose-400">{expenses.length} {expenses.length === 1 ? 'gasto' : 'gastos'}</span>
        </div>
      )}

      {/* List grouped by date */}
      {isLoading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p>
      ) : expenses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <TrendingDown className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No hay gastos registrados</p>
          <button onClick={openNew} className="mt-3 text-sm text-primary-600 hover:underline">
            Cargar el primero
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2 px-1">
                {formatDate(date)}
              </p>
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white overflow-hidden">
                {items.map((expense) => (
                  <div key={expense.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{expense.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {expense.payment_method && (
                          <span className="text-xs text-gray-400">{expense.payment_method}</span>
                        )}
                        {expense.notes && (
                          <span className="text-xs text-gray-400 truncate">· {expense.notes}</span>
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-gray-900 tabular-nums shrink-0">
                      {formatPrice(Number(expense.amount))}
                    </span>
                    <button
                      onClick={() => handleDelete(expense.id)}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <div className="flex justify-end px-4 py-2 bg-gray-50">
                  <span className="text-xs font-semibold text-gray-500">
                    Subtotal: {formatPrice(items.reduce((s, e) => s + Number(e.amount), 0))}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal nuevo gasto */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title="Nuevo gasto">
        <ModalContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <Input
              label="Descripción"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Ej: Flete, insumos, etc."
            />
            <Input
              label="Importe"
              type="number"
              min="0"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              placeholder="0"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Forma de pago (opcional)</label>
              <select
                value={formPaymentMethod}
                onChange={(e) => setFormPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">— Sin especificar —</option>
                {paymentMethods.map((m) => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
            <Input
              label="Notas (opcional)"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Detalle adicional"
            />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="outline" onClick={() => { setShowModal(false); resetForm(); }}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={createMutation.isPending}
            disabled={!formDate || !formDescription || !formAmount}
          >
            Guardar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
