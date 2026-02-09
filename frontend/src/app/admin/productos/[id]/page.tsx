'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, RefreshCw, Trash2, Star, Upload, X, Plus, Zap, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PriceIntelligence } from '@/components/admin/PriceIntelligence';
import { formatPrice, formatRelativeTime } from '@/lib/utils';
import { useApiKey } from '@/hooks/useAuth';
import { uploadImages } from '@/lib/api';
import {
  useAdminProduct,
  useUpdateProduct,
  useDeleteProduct,
  useRescrapeProduct,
  useStockPurchases,
  useUpdateStockPurchase,
} from '@/hooks/useProducts';

export default function ProductEditPage() {
  const params = useParams();
  const productId = parseInt(params.id as string, 10);

  const router = useRouter();
  const apiKey = useApiKey() || '';

  const { data: product, isLoading } = useAdminProduct(apiKey, productId);
  const { data: stockPurchases, isLoading: isStockLoading } = useStockPurchases(apiKey, productId);
  const updateStockPurchase = useUpdateStockPurchase(apiKey);
  const updateMutation = useUpdateProduct(apiKey);
  const deleteMutation = useDeleteProduct(apiKey);
  const rescrapeMutation = useRescrapeProduct(apiKey);

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isImmediateDelivery, setIsImmediateDelivery] = useState(false);
  const [isCheckStock, setIsCheckStock] = useState(false);
  const [markup, setMarkup] = useState(0);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [sku, setSku] = useState('');

  // Image state
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prevProductId, setPrevProductId] = useState<number | null>(null);
  const [nextProductId, setNextProductId] = useState<number | null>(null);

  // Initialize form when product loads
  useEffect(() => {
    if (product) {
      setEnabled(product.enabled);
      setIsFeatured(product.is_featured || false);
      setIsImmediateDelivery(product.is_immediate_delivery || false);
      setIsCheckStock(product.is_check_stock || false);
      setMarkup(Number(product.markup_percentage));
      setCustomName(product.custom_name || '');
      setCustomPrice(product.custom_price ? String(product.custom_price) : '');
      setCategory(product.category || '');
      setDescription(product.description || '');
      setShortDescription(product.short_description || '');
      setBrand(product.brand || '');
      setSku(product.sku || '');
      // Initialize images
      const urls = product.images
        .sort((a, b) => (a.is_primary ? -1 : 1))
        .map(img => img.url);
      setImageUrls(urls);
      setSelectedImageIndex(0);
    }
  }, [product]);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('admin_products_last_list');
      if (!stored) return;
      const ids = JSON.parse(stored) as number[];
      const index = ids.indexOf(productId);
      if (index >= 0) {
        setPrevProductId(index > 0 ? ids[index - 1] : null);
        setNextProductId(index < ids.length - 1 ? ids[index + 1] : null);
      }
    } catch {
      // ignore storage errors
    }
  }, [productId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadedUrls = await uploadImages(apiKey, files);
      setImageUrls(prev => [...prev, ...uploadedUrls]);
    } catch (error) {
      console.error('Error uploading images:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
    if (selectedImageIndex >= index && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  };

  const handleAddImageUrl = () => {
    const url = newImageUrl.trim();
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      setImageUrls(prev => [...prev, url]);
      setNewImageUrl('');
    }
  };

  const handleSave = async () => {
    await updateMutation.mutateAsync({
      id: productId,
      data: {
        enabled,
        is_featured: isFeatured,
        is_immediate_delivery: isImmediateDelivery,
        is_check_stock: isCheckStock,
        markup_percentage: markup,
        custom_name: customName || '',
        custom_price: customPrice ? parseFloat(customPrice) : 0,
        category: category || '',
        description: description || '',
        short_description: shortDescription || '',
        brand: brand || '',
        sku: sku || '',
        image_urls: imageUrls,
      },
    });
  };

  const handleDelete = async () => {
    if (confirm('¿Estás seguro de eliminar este producto?')) {
      await deleteMutation.mutateAsync(productId);
      router.push('/admin/productos');
    }
  };

  const handleRescrape = async () => {
    await rescrapeMutation.mutateAsync(productId);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Producto no encontrado
        </h2>
        <Link
          href="/admin/productos"
          className="text-primary-600 hover:text-primary-700"
        >
          Volver a productos
        </Link>
      </div>
    );
  }

  const isManualProduct = product.source_website_name === 'Producto Manual';
  const totalStock = (stockPurchases || []).reduce((acc, item) => acc + (item.quantity - item.out_quantity), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-100/80 backdrop-blur border-b border-gray-200">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/productos"
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">
                  {product.custom_name || product.original_name}
                </h1>
                {product.is_featured && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                    Nuevo
                  </span>
                )}
                {product.is_immediate_delivery && (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">
                    Entrega inmediata
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">{product.slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => prevProductId && router.push(`/admin/productos/${prevProductId}`)}
              disabled={!prevProductId}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => nextProductId && router.push(`/admin/productos/${nextProductId}`)}
              disabled={!nextProductId}
            >
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div />
        </div>
        <div className="flex items-center gap-2">
          {!isManualProduct && (
            <Button
              variant="outline"
              onClick={handleRescrape}
              isLoading={rescrapeMutation.isPending}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Re-scrapear
            </Button>
          )}
          <Button variant="danger" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Column - Images & Details */}
        <div className="space-y-6">
          {/* Image Gallery */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Imagenes</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Main Image */}
              <div className="aspect-square relative rounded-lg overflow-hidden bg-gray-100">
                {imageUrls.length > 0 ? (
                  <Image
                    src={imageUrls[selectedImageIndex]}
                    alt={product.original_name}
                    fill
                    className="object-contain"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    Sin imagen
                  </div>
                )}
              </div>

              {/* Thumbnail selector */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {imageUrls.map((url, index) => (
                  <div
                    key={index}
                    className={`relative w-16 h-16 flex-shrink-0 rounded overflow-hidden cursor-pointer border-2 ${
                      selectedImageIndex === index
                        ? 'border-primary-500'
                        : 'border-transparent'
                    }`}
                    onClick={() => setSelectedImageIndex(index)}
                  >
                    <Image
                      src={url}
                      alt=""
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(index);
                      }}
                      className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    {index === 0 && (
                      <span className="absolute bottom-0 left-0 right-0 text-[10px] bg-primary-600 text-white text-center">
                        Principal
                      </span>
                    )}
                  </div>
                ))}

                {/* Add image button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-16 h-16 flex-shrink-0 rounded border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-primary-400 hover:text-primary-500"
                >
                  {isUploading ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* Add image by URL */}
              <div className="flex gap-2">
                <Input
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="https://ejemplo.com/imagen.jpg"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddImageUrl();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddImageUrl}
                  disabled={!newImageUrl.trim()}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  URL
                </Button>
              </div>

              <p className="text-xs text-gray-500">
                La primera imagen es la principal. Podes subir archivos o agregar URLs.
              </p>
            </CardContent>
          </Card>

          {/* Product Details (editable) */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Datos del producto</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Nombre personalizado"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={product.original_name}
                helperText="Dejar vacio para usar el nombre original"
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Marca"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Ej: Samsung"
                />
                <Input
                  label="SKU / Codigo"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Ej: ABC123"
                />
              </div>

              <Input
                label="Categoria"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ej: Electrodomesticos"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripcion corta
                </label>
                <textarea
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="Descripcion breve para el catalogo"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripcion completa
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripcion detallada del producto"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={4}
                />
              </div>

              {/* Source info (read-only) */}
              {!isManualProduct && (
                <div className="pt-4 border-t space-y-2">
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">Fuente:</span> {product.source_website_name}
                  </p>
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">Ultimo scraping:</span>{' '}
                    {formatRelativeTime(product.last_scraped_at)}
                  </p>
                  {product.scrape_error_count > 0 && (
                    <p className="text-sm text-red-600">
                      {product.scrape_error_count} errores de scraping
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Pricing & Settings */}
        <div className="space-y-6">
          {/* Price Intelligence */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Configuracion de precio</h2>
            </CardHeader>
            <CardContent>
              <PriceIntelligence
                product={product}
                apiKey={apiKey}
                onMarkupChange={setMarkup}
              />
            </CardContent>
          </Card>

          {/* Settings Form */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Configuracion</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Enabled toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Estado</p>
                  <p className="text-sm text-gray-500">
                    Mostrar en catalogo publico
                  </p>
                </div>
                <button
                  onClick={() => setEnabled(!enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    enabled ? 'bg-primary-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Featured toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" />
                    Nuevo
                  </p>
                  <p className="text-sm text-gray-500">
                    Destacar en seccion Nuevoes
                  </p>
                </div>
                <button
                  onClick={() => setIsFeatured(!isFeatured)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isFeatured ? 'bg-amber-500' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isFeatured ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Immediate delivery toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <Zap className="h-4 w-4 text-emerald-600" />
                    Entrega inmediata
                  </p>
                  <p className="text-sm text-gray-500">
                    Destacar en la seccion Entrega inmediata
                  </p>
                </div>
                <button
                  onClick={() => setIsImmediateDelivery(!isImmediateDelivery)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isImmediateDelivery ? 'bg-emerald-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isImmediateDelivery ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Check Stock toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-orange-500" />
                    Consultar stock
                  </p>
                  <p className="text-sm text-gray-500">
                    Muestra indicador y quita Nuevo e Inmediata
                  </p>
                </div>
                <button
                  onClick={() => setIsCheckStock(!isCheckStock)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isCheckStock ? 'bg-orange-500' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isCheckStock ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Custom Price */}
              <Input
                label="Precio fijo (opcional)"
                type="number"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder="Dejar vacio para usar markup"
                helperText="Si se define, ignora el markup"
              />

              {/* Save Button */}
              <Button
                onClick={handleSave}
                isLoading={updateMutation.isPending || isUploading}
                className="w-full"
              >
                Guardar cambios
              </Button>

              {updateMutation.isError && (
                <p className="text-sm text-red-600 text-center">
                  Error al guardar. Intenta nuevamente.
                </p>
              )}

              {updateMutation.isSuccess && (
                <p className="text-sm text-green-600 text-center">
                  Cambios guardados correctamente.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Stock Purchases */}
          <Card className="hidden">
            <CardHeader>
              <h2 className="text-lg font-semibold">Stock por compras</h2>
            </CardHeader>
            <CardContent>
              {isStockLoading ? (
                <p className="text-sm text-gray-500">Cargando stock...</p>
              ) : !stockPurchases || stockPurchases.length === 0 ? (
                <p className="text-sm text-gray-500">No hay compras de stock registradas.</p>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-gray-700">
                    Stock disponible: <strong>{totalStock}</strong>
                  </div>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Compra</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Salidas</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Disponible</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Precio Unitario</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {stockPurchases.map((purchase) => {
                          const available = purchase.quantity - purchase.out_quantity;
                          return (
                            <tr key={purchase.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2">{purchase.purchase_date}</td>
                              <td className="px-3 py-2">
                                <div className="font-medium text-gray-900 line-clamp-1">
                                  {purchase.description || '-'}
                                </div>
                                <div className="text-xs text-gray-500">{purchase.code || '-'}</div>
                              </td>
                              <td className="px-3 py-2 text-right">{purchase.quantity}</td>
                              <td className="px-3 py-2 text-right">{purchase.out_quantity}</td>
                              <td className="px-3 py-2 text-right font-medium">{available}</td>
                              <td className="px-3 py-2 text-right">{formatPrice(purchase.unit_price)}</td>
                              <td className="px-3 py-2 text-right">{formatPrice(purchase.total_amount)}</td>
                              <td className="px-3 py-2 text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    if (!confirm('¿Desasociar esta compra de stock del producto?')) return;
                                    await updateStockPurchase.mutateAsync({
                                      purchaseId: purchase.id,
                                      productId: null,
                                    });
                                  }}
                                  disabled={updateStockPurchase.isPending}
                                >
                                  Desasociar
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stock Purchases - Full Width */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Stock por compras</h2>
        </CardHeader>
        <CardContent>
          {isStockLoading ? (
            <p className="text-sm text-gray-500">Cargando stock...</p>
          ) : !stockPurchases || stockPurchases.length === 0 ? (
            <p className="text-sm text-gray-500">No hay compras de stock registradas.</p>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                Stock disponible: <strong>{totalStock}</strong>
              </div>
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Compra</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Salidas</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Disponible</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Precio Unitario</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {stockPurchases.map((purchase) => {
                      const available = purchase.quantity - purchase.out_quantity;
                      return (
                        <tr key={purchase.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">{purchase.purchase_date}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-900 line-clamp-1">
                              {purchase.description || '-'}
                            </div>
                            <div className="text-xs text-gray-500">{purchase.code || '-'}</div>
                          </td>
                          <td className="px-3 py-2 text-right">{purchase.quantity}</td>
                          <td className="px-3 py-2 text-right">{purchase.out_quantity}</td>
                          <td className="px-3 py-2 text-right font-medium">{available}</td>
                          <td className="px-3 py-2 text-right">{formatPrice(purchase.unit_price)}</td>
                          <td className="px-3 py-2 text-right">{formatPrice(purchase.total_amount)}</td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                if (!confirm('Â¿Desasociar esta compra de stock del producto?')) return;
                                await updateStockPurchase.mutateAsync({
                                  purchaseId: purchase.id,
                                  productId: null,
                                });
                              }}
                              disabled={updateStockPurchase.isPending}
                            >
                              Desasociar
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
