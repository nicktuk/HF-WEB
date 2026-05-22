'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Users, TrendingUp, ShoppingBag, Tag } from 'lucide-react';
import { useApiKey } from '@/hooks/useAuth';
import { useCustomers, useCustomerTags } from '@/hooks/useCustomers';
import { formatPrice } from '@/lib/utils';
import type { CustomerListItem } from '@/lib/api';

export default function ClientesPage() {
  const router = useRouter();
  const apiKey = useApiKey() || '';

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, activeTag]);

  const { data, isLoading } = useCustomers(apiKey, {
    search: debouncedSearch || undefined,
    tag: activeTag,
    page,
    limit: 50,
  });

  const { data: predefinedTags = [] } = useCustomerTags(apiKey);

  const handleRowClick = (customer: CustomerListItem) => {
    router.push(`/admin/clientes/${encodeURIComponent(customer.name)}`);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data ? `${data.total} cliente${data.total !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
      </div>

      {/* Search + tag filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full pl-9 pr-9 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {predefinedTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {predefinedTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? undefined : tag)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  activeTag === tag
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary-400'
                }`}
              >
                <Tag className="h-3 w-3" />
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Cargando...</div>
        ) : !data || data.items.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No hay clientes</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Etiquetas</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Compras</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Total gastado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Última compra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.items.map((c) => (
                    <tr
                      key={c.name}
                      onClick={() => handleRowClick(c)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{c.name}</div>
                        {(c.phone || c.email) && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            {c.phone}{c.phone && c.email ? ' · ' : ''}{c.email}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {c.tags.map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full font-medium">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 text-sm text-gray-700">
                          <ShoppingBag className="h-3.5 w-3.5 text-gray-400" />
                          {c.sale_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatPrice(c.total_spent)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(c.last_sale_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm rounded border border-gray-200 disabled:opacity-40 hover:bg-white"
                >
                  Anterior
                </button>
                <span className="text-sm text-gray-500">
                  Página {page} de {data.pages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                  disabled={page === data.pages}
                  className="px-3 py-1.5 text-sm rounded border border-gray-200 disabled:opacity-40 hover:bg-white"
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
