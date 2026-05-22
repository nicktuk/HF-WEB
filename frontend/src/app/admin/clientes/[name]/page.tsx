'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Phone, Mail, Tag, X, Plus, Save, ShoppingBag, CheckCircle, XCircle, StickyNote } from 'lucide-react';
import { useApiKey } from '@/hooks/useAuth';
import { useCustomerByName, useUpdateCustomer, useCustomerTags } from '@/hooks/useCustomers';
import { formatPrice } from '@/lib/utils';
import type { CustomerSale } from '@/lib/api';

export default function ClienteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const apiKey = useApiKey() || '';
  const name = decodeURIComponent(params.name as string);

  const { data: customer, isLoading } = useCustomerByName(apiKey, name);
  const { data: predefinedTags = [] } = useCustomerTags(apiKey);
  const updateMutation = useUpdateCustomer(apiKey);

  const [editingPhone, setEditingPhone] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [initialized, setInitialized] = useState(false);

  if (customer && !initialized) {
    setPhone(customer.phone || '');
    setEmail(customer.email || '');
    setNotes(customer.notes || '');
    setInitialized(true);
  }

  const save = async (fields: Parameters<typeof updateMutation.mutateAsync>[0]['data']) => {
    if (!customer) return;
    await updateMutation.mutateAsync({ id: customer.id, data: fields });
  };

  const toggleTag = async (tag: string) => {
    if (!customer) return;
    const current = customer.tags || [];
    const next = current.includes(tag)
      ? current.filter(t => t !== tag)
      : [...current, tag];
    await save({ tags: next });
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (isLoading) {
    return <div className="py-16 text-center text-gray-400 text-sm">Cargando...</div>;
  }

  if (!customer) {
    return <div className="py-16 text-center text-gray-400 text-sm">Cliente no encontrado</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <button
        onClick={() => router.push('/admin/clientes')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ChevronLeft className="h-4 w-4" />
        Clientes
      </button>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <ShoppingBag className="h-4 w-4" />
                {customer.sale_count} compra{customer.sale_count !== 1 ? 's' : ''}
              </span>
              <span className="font-semibold text-gray-800">{formatPrice(customer.total_spent)}</span>
            </div>
          </div>
        </div>

        {/* Contact info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Phone */}
          <div>
            <label className="text-xs font-medium text-gray-500 flex items-center gap-1 mb-1">
              <Phone className="h-3.5 w-3.5" /> Teléfono
            </label>
            {editingPhone ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-400"
                />
                <button
                  onClick={async () => { await save({ phone }); setEditingPhone(false); }}
                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                >
                  <Save className="h-4 w-4" />
                </button>
                <button onClick={() => { setPhone(customer.phone || ''); setEditingPhone(false); }} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingPhone(true)}
                className="text-sm text-gray-700 hover:text-primary-600 w-full text-left px-2 py-1 rounded hover:bg-gray-50"
              >
                {customer.phone || <span className="text-gray-300 italic">Agregar teléfono</span>}
              </button>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="text-xs font-medium text-gray-500 flex items-center gap-1 mb-1">
              <Mail className="h-3.5 w-3.5" /> Email
            </label>
            {editingEmail ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-400"
                />
                <button
                  onClick={async () => { await save({ email }); setEditingEmail(false); }}
                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                >
                  <Save className="h-4 w-4" />
                </button>
                <button onClick={() => { setEmail(customer.email || ''); setEditingEmail(false); }} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingEmail(true)}
                className="text-sm text-gray-700 hover:text-primary-600 w-full text-left px-2 py-1 rounded hover:bg-gray-50"
              >
                {customer.email || <span className="text-gray-300 italic">Agregar email</span>}
              </button>
            )}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs font-medium text-gray-500 flex items-center gap-1 mb-2">
            <Tag className="h-3.5 w-3.5" /> Etiquetas
          </label>
          <div className="flex flex-wrap gap-2">
            {predefinedTags.map(tag => {
              const active = (customer.tags || []).includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-primary-400'
                  }`}
                >
                  {active ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-medium text-gray-500 flex items-center gap-1 mb-1">
            <StickyNote className="h-3.5 w-3.5" /> Notas
          </label>
          {editingNotes ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-400 resize-none"
                placeholder="Notas internas sobre el cliente..."
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => { await save({ notes }); setEditingNotes(false); }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                >
                  <Save className="h-3.5 w-3.5" /> Guardar
                </button>
                <button
                  onClick={() => { setNotes(customer.notes || ''); setEditingNotes(false); }}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditingNotes(true)}
              className="text-sm text-gray-700 hover:text-primary-600 w-full text-left px-2 py-1.5 rounded hover:bg-gray-50 min-h-[36px]"
            >
              {customer.notes || <span className="text-gray-300 italic">Agregar notas...</span>}
            </button>
          )}
        </div>
      </div>

      {/* Sale history */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Historial de compras</h2>
        <div className="space-y-3">
          {customer.sales.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 py-10 text-center text-gray-400 text-sm">
              Sin ventas registradas
            </div>
          ) : (
            customer.sales.map((sale: CustomerSale) => (
              <div key={sale.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">
                      {formatDate(sale.created_at)}
                    </span>
                    <span className="text-xs text-gray-400">#{sale.id}</span>
                    {sale.payment_method && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {sale.payment_method}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs">
                      {sale.paid
                        ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                        : <XCircle className="h-3.5 w-3.5 text-red-400" />
                      }
                      {sale.paid ? 'Pagado' : 'Sin pagar'}
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      {formatPrice(sale.total_amount)}
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-gray-50">
                  {sale.items.map(item => (
                    <div key={item.id} className="flex items-center justify-between px-4 py-2 text-sm">
                      <div className="text-gray-700">
                        {item.product_name || 'Producto sin nombre'}
                        {item.color && <span className="ml-1.5 text-xs text-gray-400">({item.color})</span>}
                        <span className="ml-2 text-xs text-gray-400">x{item.quantity}</span>
                      </div>
                      <span className="text-gray-600">{formatPrice(item.total_price)}</span>
                    </div>
                  ))}
                </div>
                {sale.notes && (
                  <div className="px-4 py-2 bg-amber-50 text-xs text-amber-700 border-t border-amber-100">
                    {sale.notes}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
