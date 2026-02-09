'use client';

import { useState } from 'react';
import { adminApi } from '@/lib/api';
import { useApiKey } from '@/hooks/useAuth';
import type { WhatsAppProductItem, WhatsAppMessage, WhatsAppBulkMessage } from '@/types';

export default function WhatsAppGeneratorPage() {
  const apiKey = useApiKey() || '';

  // Filters
  const [filterFeatured, setFilterFeatured] = useState(false);
  const [filterImmediate, setFilterImmediate] = useState(false);
  const [filterBestSeller, setFilterBestSeller] = useState(false);
  const [filterLimit, setFilterLimit] = useState(20);

  // Products and selection
  const [products, setProducts] = useState<WhatsAppProductItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  // Generation options
  const [template, setTemplate] = useState<'default' | 'promo' | 'nuevos' | 'mas_vendidos' | 'custom'>('default');
  const [includePrice, setIncludePrice] = useState(true);
  const [customText, setCustomText] = useState('');
  const [messageMode, setMessageMode] = useState<'individual' | 'bulk'>('individual');

  // Generated messages
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [bulkMessage, setBulkMessage] = useState<WhatsAppBulkMessage | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadProducts = async () => {
    if (!apiKey) {
      showToast('API Key no configurada', 'error');
      return;
    }

    setLoading(true);
    try {
      const filters: { is_featured?: boolean; is_immediate_delivery?: boolean; is_best_seller?: boolean; limit: number } = {
        limit: filterLimit,
      };
      if (filterFeatured) filters.is_featured = true;
      if (filterImmediate) filters.is_immediate_delivery = true;
      if (filterBestSeller) filters.is_best_seller = true;

      const data = await adminApi.filterProductsForWhatsApp(apiKey, filters);
      setProducts(data);
      setSelectedIds([]);
      setMessages([]);
      setBulkMessage(null);
    } catch (error) {
      showToast('Error al cargar productos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleProduct = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === products.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map(p => p.id));
    }
  };

  const generateMessages = async () => {
    if (!apiKey || selectedIds.length === 0) return;

    setLoading(true);
    try {
      const data = {
        product_ids: selectedIds,
        template,
        include_price: includePrice,
        custom_text: template === 'custom' ? customText : undefined,
      };

      if (messageMode === 'bulk') {
        const result = await adminApi.generateWhatsAppBulkMessage(apiKey, data);
        setBulkMessage(result);
        setMessages([]);
      } else {
        const result = await adminApi.generateWhatsAppMessages(apiKey, data);
        setMessages(result);
        setBulkMessage(null);
      }
    } catch (error) {
      showToast('Error al generar mensajes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Texto copiado!', 'success');
    } catch {
      showToast('Error al copiar', 'error');
    }
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      showToast('Imagen descargada', 'success');
    } catch {
      showToast('Error al descargar imagen', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-white ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Generador de Mensajes WhatsApp</h1>
        <p className="text-gray-600">Crea mensajes promocionales para compartir en tu canal</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Filtrar Productos</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filterFeatured}
              onChange={(e) => setFilterFeatured(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>Nuevos</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filterImmediate}
              onChange={(e) => setFilterImmediate(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>Entrega Inmediata</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filterBestSeller}
              onChange={(e) => setFilterBestSeller(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>Lo Mas Vendido</span>
          </label>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Limite</label>
            <select
              value={filterLimit}
              onChange={(e) => setFilterLimit(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <button
            onClick={loadProducts}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Cargando...' : 'Buscar Productos'}
          </button>
        </div>
      </div>

      {/* Products Grid */}
      {products.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">
              Seleccionar Productos ({selectedIds.length} de {products.length})
            </h2>
            <button
              onClick={selectAll}
              className="text-sm text-blue-600 hover:underline"
            >
              {selectedIds.length === products.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {products.map((product) => (
              <div
                key={product.id}
                onClick={() => toggleProduct(product.id)}
                className={`cursor-pointer border rounded-lg p-3 transition ${
                  selectedIds.includes(product.id)
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                    : 'hover:border-gray-400'
                }`}
              >
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-32 object-cover rounded mb-2"
                  />
                ) : (
                  <div className="w-full h-32 bg-gray-100 rounded mb-2 flex items-center justify-center text-gray-400">
                    Sin imagen
                  </div>
                )}
                <p className="text-sm font-medium truncate">{product.name}</p>
                {product.price && (
                  <p className="text-sm text-gray-600">${product.price.toLocaleString('es-AR')}</p>
                )}
                <div className="flex gap-1 mt-1 flex-wrap">
                  {product.is_featured && (
                    <span className="text-xs px-1 py-0.5 bg-orange-100 text-orange-700 rounded">Nuevo</span>
                  )}
                  {product.is_immediate_delivery && (
                    <span className="text-xs px-1 py-0.5 bg-green-100 text-green-700 rounded">Inmediata</span>
                  )}
                  {product.is_best_seller && (
                    <span className="text-xs px-1 py-0.5 bg-purple-100 text-purple-700 rounded">Top</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Template Selection */}
      {selectedIds.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Opciones de Mensaje</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Template</label>
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value as typeof template)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="default">Estandar</option>
                  <option value="nuevos">Nuevos en Catalogo</option>
                  <option value="mas_vendidos">Lo Mas Vendido</option>
                  <option value="promo">Promocional</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>

              {template === 'custom' && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Texto Personalizado
                  </label>
                  <textarea
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={4}
                    placeholder="Usa {product_name} y {price} como placeholders"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Placeholders: {'{product_name}'}, {'{price}'}
                  </p>
                </div>
              )}

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includePrice}
                  onChange={(e) => setIncludePrice(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span>Incluir precio</span>
              </label>

              <div>
                <label className="block text-sm font-medium mb-2">Modo</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={messageMode === 'individual'}
                      onChange={() => setMessageMode('individual')}
                      className="border-gray-300"
                    />
                    <span>Un mensaje por producto</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={messageMode === 'bulk'}
                      onChange={() => setMessageMode('bulk')}
                      className="border-gray-300"
                    />
                    <span>Lista combinada</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-end">
              <button
                onClick={generateMessages}
                disabled={loading}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                {loading ? 'Generando...' : 'Generar Mensajes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generated Messages - Individual */}
      {messages.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Mensajes Generados ({messages.length})</h2>
          {messages.map((msg) => (
            <div key={msg.product_id} className="bg-white rounded-lg border p-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Image */}
                <div>
                  {msg.image_url ? (
                    <div className="space-y-2">
                      <img
                        src={msg.image_url}
                        alt={msg.product_name}
                        className="w-full rounded-lg"
                      />
                      <button
                        onClick={() => downloadImage(msg.image_url!, `${msg.product_name}.jpg`)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                      >
                        Descargar imagen
                      </button>
                    </div>
                  ) : (
                    <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                      Sin imagen
                    </div>
                  )}
                </div>

                {/* Text */}
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <pre className="whitespace-pre-wrap font-sans text-sm">{msg.text}</pre>
                  </div>
                  <button
                    onClick={() => copyToClipboard(msg.text)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Copiar texto
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generated Messages - Bulk */}
      {bulkMessage && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Mensaje Combinado ({bulkMessage.product_count} productos)</h2>
          <div className="bg-white rounded-lg border p-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Images grid */}
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Imagenes ({bulkMessage.images.length})</p>
                <div className="grid grid-cols-2 gap-2">
                  {bulkMessage.images.slice(0, 4).map((img) => (
                    <div key={img.product_id} className="relative">
                      <img
                        src={img.image_url}
                        alt={img.product_name}
                        className="w-full h-32 object-cover rounded"
                      />
                      <button
                        onClick={() => downloadImage(img.image_url, `${img.product_name}.jpg`)}
                        className="absolute bottom-1 right-1 px-2 py-1 bg-white/90 rounded text-xs hover:bg-white"
                      >
                        Descargar
                      </button>
                    </div>
                  ))}
                </div>
                {bulkMessage.images.length > 4 && (
                  <p className="text-sm text-gray-500">+{bulkMessage.images.length - 4} imagenes mas</p>
                )}
              </div>

              {/* Text */}
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-sans text-sm">{bulkMessage.text}</pre>
                </div>
                <button
                  onClick={() => copyToClipboard(bulkMessage.text)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Copiar texto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {products.length === 0 && !loading && (
        <div className="bg-white rounded-lg border p-12 text-center text-gray-500">
          <p>Selecciona filtros y busca productos para generar mensajes</p>
        </div>
      )}
    </div>
  );
}
