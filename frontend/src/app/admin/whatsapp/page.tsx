'use client';

import { useState, useEffect, useRef } from 'react';
import { adminApi, publicApi } from '@/lib/api';
import { useApiKey } from '@/hooks/useAuth';
import type { WhatsAppProductItem, WhatsAppMessage, WhatsAppBulkMessage } from '@/types';

export default function WhatsAppGeneratorPage() {
  const apiKey = useApiKey() || '';

  // Tabs
  const [activeTab, setActiveTab] = useState<'catalog' | 'manual'>('catalog');

  // Manual post state
  const [manualImage, setManualImage] = useState<File | null>(null);
  const [manualImagePreview, setManualImagePreview] = useState<string | null>(null);
  const [manualImagePrompt, setManualImagePrompt] = useState('');
  const [manualGeneratedImage, setManualGeneratedImage] = useState<string | null>(null);
  const [manualImageLoading, setManualImageLoading] = useState(false);
  const [manualBrand, setManualBrand] = useState('');
  const [manualModel, setManualModel] = useState('');
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [manualPrompt, setManualPrompt] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualText, setManualText] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const manualFileInputRef = useRef<HTMLInputElement>(null);

  // Categories and subcategories
  const [categories, setCategories] = useState<{ name: string; color: string }[]>([]);
  const [subcategories, setSubcategories] = useState<{ name: string; category_name: string }[]>([]);

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterSubcategory, setFilterSubcategory] = useState<string>('');
  const [filterFeatured, setFilterFeatured] = useState(false);
  const [filterImmediate, setFilterImmediate] = useState(false);
  const [filterBestSeller, setFilterBestSeller] = useState(false);
  const [filterPublished, setFilterPublished] = useState(false);

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

  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await publicApi.getCategories();
        setCategories(cats);
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };
    loadCategories();
  }, []);

  // Load subcategories when category changes
  useEffect(() => {
    const loadSubcategories = async () => {
      if (filterCategory) {
        try {
          const subs = await publicApi.getSubcategories(filterCategory);
          setSubcategories(subs);
        } catch (error) {
          console.error('Error loading subcategories:', error);
        }
      } else {
        setSubcategories([]);
      }
      setFilterSubcategory('');
    };
    loadSubcategories();
  }, [filterCategory]);

  // Load products on mount
  useEffect(() => {
    if (apiKey) {
      loadProducts();
    }
  }, [apiKey]);

  const loadProducts = async () => {
    if (!apiKey) {
      showToast('API Key no configurada', 'error');
      return;
    }

    setLoading(true);
    try {
      const filters: {
        is_featured?: boolean;
        is_immediate_delivery?: boolean;
        is_best_seller?: boolean;
        is_published?: boolean;
        category?: string;
        subcategory?: string;
        limit: number;
      } = {
        limit: 500,
      };
      if (filterFeatured) filters.is_featured = true;
      if (filterImmediate) filters.is_immediate_delivery = true;
      if (filterBestSeller) filters.is_best_seller = true;
      if (filterPublished) filters.is_published = true;
      if (filterCategory) filters.category = filterCategory;
      if (filterSubcategory) filters.subcategory = filterSubcategory;

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

  // Manual post handlers
  const generateManualImage = async () => {
    if (!apiKey || !manualImage || !manualImagePrompt.trim()) return;
    setManualImageLoading(true);
    setManualGeneratedImage(null);
    try {
      const result = await adminApi.generateWhatsAppImage(apiKey, manualImage, manualImagePrompt);
      setManualGeneratedImage(result.image);
    } catch {
      showToast('Error al generar imagen', 'error');
    } finally {
      setManualImageLoading(false);
    }
  };

  const handleManualImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setManualImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setManualImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const generateManualPost = async () => {
    if (!apiKey || !manualPrompt.trim()) return;
    setManualLoading(true);
    setManualText('');
    try {
      const result = await adminApi.generateManualPost(apiKey, {
        prompt: manualPrompt,
        price: manualPrice || undefined,
        brand: manualBrand || undefined,
        model: manualModel || undefined,
        search_query: manualSearchQuery || undefined,
      });
      setManualText(result.text);
    } catch {
      showToast('Error al generar descripción', 'error');
    } finally {
      setManualLoading(false);
    }
  };

  // Filter subcategories for selected category
  const availableSubcategories = subcategories.filter(
    sub => sub.category_name === filterCategory
  );

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

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'catalog'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Desde catálogo
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'manual'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Publicación manual
        </button>
      </div>

      {/* Manual post tab */}
      {activeTab === 'manual' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Publicación manual</h2>
            <p className="text-sm text-gray-500 mb-6">Para productos que no están en el catálogo.</p>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Left: image + price + prompt */}
              <div className="space-y-4">
                {/* Image upload */}
                <div>
                  <label className="block text-sm font-medium mb-2">Foto de referencia</label>
                  <input
                    ref={manualFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleManualImageChange}
                    className="hidden"
                  />
                  {manualImagePreview ? (
                    <div className="relative">
                      <img
                        src={manualImagePreview}
                        alt="Vista previa"
                        className="w-full max-h-48 object-contain rounded-lg border bg-gray-50"
                      />
                      <button
                        onClick={() => {
                          setManualImage(null);
                          setManualImagePreview(null);
                          setManualGeneratedImage(null);
                          if (manualFileInputRef.current) manualFileInputRef.current.value = '';
                        }}
                        className="absolute top-2 right-2 bg-white/90 rounded-full p-1 text-gray-600 hover:text-red-600 text-xs shadow"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => manualFileInputRef.current?.click()}
                      className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-600 transition"
                    >
                      <span className="text-2xl mb-1">📷</span>
                      <span className="text-sm">Clic para seleccionar imagen</span>
                      <span className="text-xs mt-1">No se guarda en el servidor</span>
                    </button>
                  )}
                </div>

                {/* Image prompt */}
                <div>
                  <label className="block text-sm font-medium mb-2">Prompt para generar imagen nueva</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualImagePrompt}
                      onChange={(e) => setManualImagePrompt(e.target.value)}
                      placeholder="Ej: fondo blanco limpio, iluminación profesional de producto..."
                      className="flex-1 px-3 py-2 border rounded-lg text-sm"
                      disabled={!manualImage}
                    />
                    <button
                      onClick={generateManualImage}
                      disabled={manualImageLoading || !manualImage || !manualImagePrompt.trim()}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
                    >
                      {manualImageLoading ? 'Generando...' : 'Generar imagen'}
                    </button>
                  </div>
                </div>

                {/* Brand + Model */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">Marca</label>
                    <input
                      type="text"
                      value={manualBrand}
                      onChange={(e) => setManualBrand(e.target.value)}
                      placeholder="Ej: Samsung"
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Modelo</label>
                    <input
                      type="text"
                      value={manualModel}
                      onChange={(e) => setManualModel(e.target.value)}
                      placeholder="Ej: Galaxy A55"
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Custom search query */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Búsqueda web personalizada
                    <span className="text-gray-400 font-normal ml-1">(opcional — sobreescribe marca+modelo)</span>
                  </label>
                  <input
                    type="text"
                    value={manualSearchQuery}
                    onChange={(e) => setManualSearchQuery(e.target.value)}
                    placeholder="Ej: Samsung Galaxy A55 especificaciones técnicas"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium mb-2">Precio (opcional)</label>
                  <input
                    type="text"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    placeholder="Ej: $15.000"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                {/* Text prompt */}
                <div>
                  <label className="block text-sm font-medium mb-2">Prompt para descripción WhatsApp</label>
                  <textarea
                    value={manualPrompt}
                    onChange={(e) => setManualPrompt(e.target.value)}
                    placeholder="Describí el producto para que la IA genere el texto de WhatsApp..."
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={3}
                  />
                </div>

                <button
                  onClick={generateManualPost}
                  disabled={manualLoading || !manualPrompt.trim()}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                >
                  {manualLoading ? 'Generando...' : 'Generar descripción IA'}
                </button>
              </div>

              {/* Right: output */}
              <div className="space-y-4">
                {/* Generated image */}
                {manualGeneratedImage ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Imagen generada</p>
                    <img
                      src={manualGeneratedImage}
                      alt="Imagen generada"
                      className="w-full rounded-lg border"
                    />
                    <button
                      onClick={() => downloadImage(manualGeneratedImage, 'imagen-generada.png')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                    >
                      Descargar imagen
                    </button>
                  </div>
                ) : manualImagePreview && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-500">Imagen de referencia</p>
                    <img
                      src={manualImagePreview}
                      alt="Referencia"
                      className="w-full rounded-lg border opacity-60"
                    />
                  </div>
                )}

                {/* Generated text */}
                {manualText ? (
                  <>
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200 min-h-[120px]">
                      <pre className="whitespace-pre-wrap font-sans text-sm">{manualText}</pre>
                    </div>
                    {manualPrice && (
                      <div className="bg-blue-50 rounded-lg px-4 py-2 text-sm text-blue-800">
                        💰 <strong>Precio:</strong> {manualPrice}
                      </div>
                    )}
                    <button
                      onClick={() => copyToClipboard(manualPrice ? `${manualText}\n\n💰 ${manualPrice}` : manualText)}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                    >
                      Copiar texto
                    </button>
                  </>
                ) : (
                  <div className="min-h-[120px] bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-sm">
                    El texto generado aparecerá aquí
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Catalog tab */}
      {activeTab === 'catalog' && (<>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Filtrar Productos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
          {/* Category filter */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Categoria</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Todas</option>
              {categories.map((cat) => (
                <option key={cat.name} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Subcategory filter */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Subcategoria</label>
            <select
              value={filterSubcategory}
              onChange={(e) => setFilterSubcategory(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              disabled={!filterCategory}
            >
              <option value="">Todas</option>
              {availableSubcategories.map((sub) => (
                <option key={sub.name} value={sub.name}>{sub.name}</option>
              ))}
            </select>
          </div>

          {/* Badge filters */}
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filterFeatured}
                onChange={(e) => setFilterFeatured(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Nuevos</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filterImmediate}
                onChange={(e) => setFilterImmediate(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Entrega Inmediata</span>
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filterBestSeller}
                onChange={(e) => setFilterBestSeller(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Lo Mas Vendido</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filterPublished}
                onChange={(e) => setFilterPublished(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-medium text-blue-700">Publicar</span>
            </label>
          </div>

          {/* Search button */}
          <div className="lg:col-span-2">
            <button
              onClick={loadProducts}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Cargando...' : 'Buscar Productos'}
            </button>
          </div>
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[500px] overflow-y-auto">
            {products.map((product) => (
              <div
                key={product.id}
                onClick={() => toggleProduct(product.id)}
                className={`cursor-pointer border rounded-lg p-2 transition ${
                  selectedIds.includes(product.id)
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                    : 'hover:border-gray-400'
                }`}
              >
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-24 object-cover rounded mb-2"
                  />
                ) : (
                  <div className="w-full h-24 bg-gray-100 rounded mb-2 flex items-center justify-center text-gray-400 text-xs">
                    Sin imagen
                  </div>
                )}
                <p className="text-xs font-medium truncate">{product.name}</p>
                {product.price && (
                  <p className="text-xs text-gray-600">${product.price.toLocaleString('es-AR')}</p>
                )}
                <div className="flex gap-1 mt-1 flex-wrap">
                  {product.is_featured && (
                    <span className="text-[10px] px-1 py-0.5 bg-orange-100 text-orange-700 rounded">Nuevo</span>
                  )}
                  {product.is_immediate_delivery && (
                    <span className="text-[10px] px-1 py-0.5 bg-green-100 text-green-700 rounded">Inmediata</span>
                  )}
                  {product.is_best_seller && (
                    <span className="text-[10px] px-1 py-0.5 bg-purple-100 text-purple-700 rounded">Top</span>
                  )}
                </div>
                {product.category && (
                  <p className="text-[10px] text-gray-500 mt-1 truncate">{product.category}</p>
                )}
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
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                    <pre className="whitespace-pre-wrap font-sans text-sm">{msg.text}</pre>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => copyToClipboard(msg.text)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                    >
                      Copiar texto
                    </button>
                    {msg.wa_link && (
                      <a
                        href={msg.wa_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium text-center"
                      >
                        Abrir en WhatsApp
                      </a>
                    )}
                  </div>
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
          <p>Cargando productos...</p>
        </div>
      )}
      </>)}
    </div>
  );
}
