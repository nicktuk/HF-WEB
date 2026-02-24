'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import {
  Plus,
  Search,
  X,
  Edit2,
  Trash2,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Upload,
  Link as LinkIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiKey } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import type { Order, OrderItemCreate, OrderAttachmentCreate, OrderClose } from '@/types';

// Custom price formatter for ARS
const formatPrice = (price: number | null | undefined) => {
  if (price === null || price === undefined) return '-';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0
  }).format(price);
};

// Format date as DD/MM/YYYY HH:mm
const formatOrderDate = (dateString?: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

export default function PedidosPage() {
  const apiKey = useApiKey() || '';
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  // Initial status filter from URL params
  const initialStatus = searchParams?.get('status') || 'all';

  // State management
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>(() => {
    if (initialStatus === 'active') return 'active';
    if (initialStatus === 'closed' || initialStatus === 'completed_sale' || initialStatus === 'completed_no_sale') return 'closed';
    return 'all';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewOrderForm, setShowNewOrderForm] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);

  // Modals state
  const [closeWithSaleModal, setCloseWithSaleModal] = useState<number | null>(null);
  const [closeNoSaleModal, setCloseNoSaleModal] = useState<number | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<number | null>(null);

  // Close modals data
  const [saleIdInput, setSaleIdInput] = useState('');
  const [noSaleReasonInput, setNoSaleReasonInput] = useState('');

  // New order form state
  const [newOrder, setNewOrder] = useState({
    customer_name: '',
    seller: 'Facu' as 'Facu' | 'Heber',
    notes: '',
    items: [{ description: '', quantity: 1, estimated_price: null as number | null }] as OrderItemCreate[],
    attachments: [] as OrderAttachmentCreate[]
  });

  // Edit order form state
  const [editOrder, setEditOrder] = useState<typeof newOrder | null>(null);

  // Attachment inputs
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [newAttachmentLabel, setNewAttachmentLabel] = useState('');

  // Fetch orders
  const statusParam = statusFilter === 'all' ? undefined :
    statusFilter === 'active' ? 'active' :
    undefined;

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', statusParam, searchQuery],
    queryFn: () => adminApi.listOrders(apiKey, {
      status: statusParam,
      search: searchQuery || undefined,
      limit: 200
    }),
    enabled: !!apiKey
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['order-stats'],
    queryFn: () => adminApi.getOrderStats(apiKey),
    enabled: !!apiKey
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: typeof newOrder) => adminApi.createOrder(apiKey, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
      setShowNewOrderForm(false);
      resetNewOrderForm();
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ orderId, data }: { orderId: number; data: typeof newOrder }) =>
      adminApi.updateOrder(apiKey, orderId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setEditingOrderId(null);
      setEditOrder(null);
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    }
  });

  const closeMutation = useMutation({
    mutationFn: ({ orderId, data }: { orderId: number; data: OrderClose }) =>
      adminApi.closeOrder(apiKey, orderId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
      setCloseWithSaleModal(null);
      setCloseNoSaleModal(null);
      setSaleIdInput('');
      setNoSaleReasonInput('');
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    }
  });

  const reopenMutation = useMutation({
    mutationFn: (orderId: number) => adminApi.reopenOrder(apiKey, orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (orderId: number) => adminApi.deleteOrder(apiKey, orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
      setDeleteConfirmModal(null);
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    }
  });

  // Filter orders
  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    let filtered = [...orders];

    // Apply status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter(o => o.status === 'active');
    } else if (statusFilter === 'closed') {
      filtered = filtered.filter(o => o.status === 'completed_sale' || o.status === 'completed_no_sale');
    }

    return filtered;
  }, [orders, statusFilter]);

  // Helper functions
  const resetNewOrderForm = () => {
    setNewOrder({
      customer_name: '',
      seller: 'Facu',
      notes: '',
      items: [{ description: '', quantity: 1, estimated_price: null }],
      attachments: []
    });
  };

  const addItem = (isEdit = false) => {
    const target = isEdit ? editOrder : newOrder;
    const setter = isEdit ? setEditOrder : setNewOrder;
    if (!target) return;

    setter({
      ...target,
      items: [...target.items, { description: '', quantity: 1, estimated_price: null }]
    });
  };

  const removeItem = (index: number, isEdit = false) => {
    const target = isEdit ? editOrder : newOrder;
    const setter = isEdit ? setEditOrder : setNewOrder;
    if (!target) return;

    setter({
      ...target,
      items: target.items.filter((_, i) => i !== index)
    });
  };

  const updateItem = (index: number, field: keyof OrderItemCreate, value: any, isEdit = false) => {
    const target = isEdit ? editOrder : newOrder;
    const setter = isEdit ? setEditOrder : setNewOrder;
    if (!target) return;

    const updated = [...target.items];
    updated[index] = { ...updated[index], [field]: value };
    setter({ ...target, items: updated });
  };

  const addAttachment = (isEdit = false) => {
    if (!newAttachmentUrl.trim()) {
      alert('Ingresá una URL');
      return;
    }

    const target = isEdit ? editOrder : newOrder;
    const setter = isEdit ? setEditOrder : setNewOrder;
    if (!target) return;

    // Detect if it's an image URL
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(newAttachmentUrl);

    setter({
      ...target,
      attachments: [
        ...target.attachments,
        {
          url: newAttachmentUrl,
          type: isImage ? 'image' : 'link',
          label: newAttachmentLabel || undefined
        }
      ]
    });

    setNewAttachmentUrl('');
    setNewAttachmentLabel('');
  };

  const removeAttachment = (index: number, isEdit = false) => {
    const target = isEdit ? editOrder : newOrder;
    const setter = isEdit ? setEditOrder : setNewOrder;
    if (!target) return;

    setter({
      ...target,
      attachments: target.attachments.filter((_, i) => i !== index)
    });
  };

  const handleCreateOrder = () => {
    if (!newOrder.customer_name.trim()) {
      alert('Ingresá el nombre del cliente');
      return;
    }
    if (newOrder.items.length === 0 || !newOrder.items.some(i => i.description.trim())) {
      alert('Agregá al menos un item con descripción');
      return;
    }

    // Filter out empty items
    const validItems = newOrder.items.filter(i => i.description.trim());

    createMutation.mutate({
      ...newOrder,
      items: validItems
    });
  };

  const handleUpdateOrder = () => {
    if (!editOrder || !editingOrderId) return;

    if (!editOrder.customer_name.trim()) {
      alert('Ingresá el nombre del cliente');
      return;
    }
    if (editOrder.items.length === 0 || !editOrder.items.some(i => i.description.trim())) {
      alert('Agregá al menos un item con descripción');
      return;
    }

    const validItems = editOrder.items.filter(i => i.description.trim());

    updateMutation.mutate({
      orderId: editingOrderId,
      data: {
        ...editOrder,
        items: validItems
      }
    });
  };

  const handleCloseWithSale = () => {
    if (!closeWithSaleModal) return;
    const saleId = parseInt(saleIdInput);
    if (!saleId || saleId <= 0) {
      alert('Ingresá un ID de venta válido');
      return;
    }

    closeMutation.mutate({
      orderId: closeWithSaleModal,
      data: { action: 'sale', linked_sale_id: saleId }
    });
  };

  const handleCloseNoSale = () => {
    if (!closeNoSaleModal) return;
    if (!noSaleReasonInput.trim()) {
      alert('Ingresá un motivo');
      return;
    }

    closeMutation.mutate({
      orderId: closeNoSaleModal,
      data: { action: 'no_sale', no_sale_reason: noSaleReasonInput }
    });
  };

  const startEdit = (order: Order) => {
    setEditingOrderId(order.id);
    setEditOrder({
      customer_name: order.customer_name,
      seller: order.seller as 'Facu' | 'Heber',
      notes: order.notes || '',
      items: order.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        estimated_price: item.estimated_price
      })),
      attachments: order.attachments.map(att => ({
        url: att.url,
        type: att.type,
        label: att.label || undefined
      }))
    });
  };

  const cancelEdit = () => {
    setEditingOrderId(null);
    setEditOrder(null);
  };

  const calculateTotal = (items: OrderItemCreate[]) => {
    return items.reduce((sum, item) => {
      const price = item.estimated_price || 0;
      return sum + (item.quantity * price);
    }, 0);
  };

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Activo
          </span>
        );
      case 'completed_sale':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Venta
          </span>
        );
      case 'completed_no_sale':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Sin venta
          </span>
        );
    }
  };

  // Render order form (used for both new and edit)
  const renderOrderForm = (isEdit = false) => {
    const data = isEdit ? editOrder : newOrder;
    if (!data) return null;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Nombre del cliente *"
            value={data.customer_name}
            onChange={(e) => {
              if (isEdit) {
                setEditOrder({ ...data, customer_name: e.target.value });
              } else {
                setNewOrder({ ...data, customer_name: e.target.value });
              }
            }}
            placeholder="Nombre del cliente"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendedor *
            </label>
            <select
              value={data.seller}
              onChange={(e) => {
                const seller = e.target.value as 'Facu' | 'Heber';
                if (isEdit) {
                  setEditOrder({ ...data, seller });
                } else {
                  setNewOrder({ ...data, seller });
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="Facu">Facu</option>
              <option value="Heber">Heber</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notas
          </label>
          <textarea
            value={data.notes}
            onChange={(e) => {
              if (isEdit) {
                setEditOrder({ ...data, notes: e.target.value });
              } else {
                setNewOrder({ ...data, notes: e.target.value });
              }
            }}
            placeholder="Notas adicionales..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500"
            rows={3}
          />
        </div>

        {/* Items table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Items del pedido *
            </label>
            <Button
              size="sm"
              variant="outline"
              onClick={() => addItem(isEdit)}
              type="button"
            >
              <Plus className="h-4 w-4 mr-1" />
              Agregar item
            </Button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Descripción
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">
                    Cant.
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">
                    Precio est.
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">
                    Subtotal
                  </th>
                  <th className="px-3 py-2 w-16"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value, isEdit)}
                        placeholder="Descripción del producto"
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1, isEdit)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.estimated_price ?? ''}
                        onChange={(e) => updateItem(index, 'estimated_price', e.target.value ? parseFloat(e.target.value) : null, isEdit)}
                        placeholder="Opcional"
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 font-medium">
                      {formatPrice(item.quantity * (item.estimated_price || 0))}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(index, isEdit)}
                        className="text-red-600 hover:text-red-800"
                        disabled={data.items.length === 1}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right text-sm font-medium text-gray-700">
                    Total estimado:
                  </td>
                  <td className="px-3 py-2 text-sm font-bold text-gray-900">
                    {formatPrice(calculateTotal(data.items))}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Attachments */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Adjuntos
          </label>

          {/* Add attachment */}
          <div className="border border-gray-300 rounded-lg p-3 bg-gray-50 space-y-2 mb-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newAttachmentUrl}
                onChange={(e) => setNewAttachmentUrl(e.target.value)}
                placeholder="URL de imagen o link"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
              <input
                type="text"
                value={newAttachmentLabel}
                onChange={(e) => setNewAttachmentLabel(e.target.value)}
                placeholder="Etiqueta (opcional)"
                className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => addAttachment(isEdit)}
                type="button"
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar link
              </Button>
            </div>
          </div>

          {/* List attachments */}
          {data.attachments.length > 0 && (
            <div className="space-y-2">
              {data.attachments.map((att, index) => (
                <div key={index} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg bg-white">
                  {att.type === 'image' ? (
                    <img src={att.url} alt={att.label || 'Adjunto'} className="w-12 h-12 object-cover rounded" />
                  ) : (
                    <LinkIcon className="h-5 w-5 text-gray-400" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {att.label || 'Sin etiqueta'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{att.url}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index, isEdit)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Form actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => {
              if (isEdit) {
                cancelEdit();
              } else {
                setShowNewOrderForm(false);
                resetNewOrderForm();
              }
            }}
            type="button"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (isEdit) {
                handleUpdateOrder();
              } else {
                handleCreateOrder();
              }
            }}
            isLoading={isEdit ? updateMutation.isPending : createMutation.isPending}
            type="button"
          >
            {isEdit ? 'Guardar cambios' : 'Crear pedido'}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-gray-600">Gestión de pedidos de clientes</p>
        </div>
        <Button onClick={() => setShowNewOrderForm(!showNewOrderForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Pedido
        </Button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Activos</p>
                <p className="text-3xl font-bold text-gray-900">{stats.active_count}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <div className="w-6 h-6 bg-yellow-500 rounded-full" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Cerrados con venta</p>
                <p className="text-3xl font-bold text-gray-900">{stats.completed_sale_count}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <div className="w-6 h-6 bg-green-500 rounded-full" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Cerrados sin venta</p>
                <p className="text-3xl font-bold text-gray-900">{stats.completed_no_sale_count}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <div className="w-6 h-6 bg-red-500 rounded-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* New order form */}
      {showNewOrderForm && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Nuevo Pedido</h2>
          </CardHeader>
          <CardContent>
            {renderOrderForm(false)}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Status tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  statusFilter === 'all'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                Todos
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  statusFilter === 'active'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                Activos
              </button>
              <button
                onClick={() => setStatusFilter('closed')}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  statusFilter === 'closed'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                Cerrados
              </button>
            </div>

            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="search"
                placeholder="Buscar por cliente o descripción..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>

        {/* Orders list */}
        <CardContent>
          {ordersLoading ? (
            <div className="text-center py-8 text-gray-500">Cargando pedidos...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No hay pedidos</div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                const isEditing = editingOrderId === order.id;
                const estimatedTotal = order.items.reduce(
                  (sum, item) => sum + (item.quantity * (item.estimated_price || 0)),
                  0
                );

                return (
                  <Card key={order.id} className={cn(
                    'transition-shadow',
                    isExpanded && 'ring-2 ring-primary-500'
                  )}>
                    {isEditing ? (
                      <CardContent>
                        <div className="mb-4">
                          <h3 className="text-lg font-semibold">Editar Pedido #{order.id}</h3>
                        </div>
                        {renderOrderForm(true)}
                      </CardContent>
                    ) : (
                      <CardContent className="p-0">
                        {/* Top row: customer + meta + actions */}
                        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
                          <div className="flex items-center gap-3 min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate">{order.customer_name}</h3>
                            {getStatusBadge(order.status)}
                            <span className="text-xs text-gray-500 hidden sm:inline">#{order.id}</span>
                            <span className="text-xs text-gray-500 hidden sm:inline">{order.seller}</span>
                            <span className="text-xs text-gray-500 hidden sm:inline">{formatOrderDate(order.created_at)}</span>
                            {estimatedTotal > 0 && (
                              <span className="text-sm font-semibold text-gray-900">{formatPrice(estimatedTotal)}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {order.status === 'active' ? (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => startEdit(order)} className="px-2" title="Editar">
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setCloseWithSaleModal(order.id)} className="px-2 text-green-600 hover:text-green-700 hover:bg-green-50" title="Atender con venta">
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setCloseNoSaleModal(order.id)} className="px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50" title="Atender sin venta">
                                  <X className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmModal(order.id)} className="px-2 text-red-500 hover:text-red-700 hover:bg-red-50" title="Eliminar">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => reopenMutation.mutate(order.id)}
                                  isLoading={reopenMutation.isPending}
                                  className="px-2 text-xs"
                                >
                                  Reabrir
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmModal(order.id)} className="px-2 text-red-500 hover:text-red-700 hover:bg-red-50" title="Eliminar">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <button
                              onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                              className="p-1 hover:bg-gray-200 rounded ml-1"
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                            </button>
                          </div>
                        </div>

                        {/* Items always visible */}
                        <div className="px-4 py-2">
                          <table className="min-w-full text-sm">
                            <tbody>
                              {order.items.map((item) => (
                                <tr key={item.id} className="border-b border-gray-50 last:border-0">
                                  <td className="py-1.5 pr-3 text-gray-900 font-medium">{item.description}</td>
                                  <td className="py-1.5 px-3 text-gray-500 text-center whitespace-nowrap w-16">x{item.quantity}</td>
                                  <td className="py-1.5 pl-3 text-gray-700 text-right whitespace-nowrap w-28">
                                    {item.estimated_price ? formatPrice(item.quantity * item.estimated_price) : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {order.items.length === 0 && (
                            <p className="text-sm text-gray-400 italic py-1">Sin items</p>
                          )}
                        </div>

                        {/* Expanded: notes, attachments, close info */}
                        {isExpanded && (
                          <div className="px-4 pb-3 space-y-3 border-t border-gray-100 pt-3">
                            {order.notes && (
                              <p className="text-sm text-gray-600"><span className="font-medium text-gray-700">Notas:</span> {order.notes}</p>
                            )}

                            {order.attachments.length > 0 && (
                              <div>
                                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Adjuntos</h4>
                                <div className="flex flex-wrap gap-2">
                                  {order.attachments.map((att) => (
                                    <a
                                      key={att.id}
                                      href={att.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                      {att.type === 'image' ? (
                                        <img src={att.url} alt={att.label || ''} className="w-16 h-16 object-cover rounded border" />
                                      ) : (
                                        <>
                                          <ExternalLink className="h-3.5 w-3.5" />
                                          <span>{att.label || 'Link'}</span>
                                        </>
                                      )}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                            {order.status === 'completed_sale' && order.linked_sale_id && (
                              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                <p className="text-sm text-green-800">Cerrado con venta #{order.linked_sale_id}</p>
                              </div>
                            )}

                            {order.status === 'completed_no_sale' && order.no_sale_reason && (
                              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                <p className="text-sm text-red-800"><span className="font-medium">Motivo:</span> {order.no_sale_reason}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Close with sale modal */}
      {closeWithSaleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Atender con venta</h2>
              <button
                onClick={() => {
                  setCloseWithSaleModal(null);
                  setSaleIdInput('');
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                Ingresá el ID de la venta asociada a este pedido
              </p>
              <Input
                label="ID de venta"
                type="number"
                min="1"
                value={saleIdInput}
                onChange={(e) => setSaleIdInput(e.target.value)}
                placeholder="Ej: 123"
              />
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setCloseWithSaleModal(null);
                  setSaleIdInput('');
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCloseWithSale}
                isLoading={closeMutation.isPending}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Close no sale modal */}
      {closeNoSaleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Atender sin venta</h2>
              <button
                onClick={() => {
                  setCloseNoSaleModal(null);
                  setNoSaleReasonInput('');
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                Ingresá el motivo por el cual no se concretó la venta
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo
                </label>
                <textarea
                  value={noSaleReasonInput}
                  onChange={(e) => setNoSaleReasonInput(e.target.value)}
                  placeholder="Ej: Cliente no respondió, precio muy alto, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={4}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setCloseNoSaleModal(null);
                  setNoSaleReasonInput('');
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCloseNoSale}
                isLoading={closeMutation.isPending}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Confirmar eliminación</h2>
              <button
                onClick={() => setDeleteConfirmModal(null)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600">
                ¿Seguro que deseas eliminar este pedido? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmModal(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={() => deleteMutation.mutate(deleteConfirmModal)}
                isLoading={deleteMutation.isPending}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
