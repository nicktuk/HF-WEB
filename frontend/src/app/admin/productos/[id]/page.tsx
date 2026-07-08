'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, RefreshCw, Trash2, Star, Upload, X, Plus, Zap, HelpCircle, Sparkles, Image as ImageIcon, Send, Link2, CreditCard, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PriceIntelligence } from '@/components/admin/PriceIntelligence';
import { formatPrice, formatRelativeTime } from '@/lib/utils';
import { useApiKey, useIsSuperadmin } from '@/hooks/useAuth';
import { useImageProcessing } from '@/hooks/useImageProcessing';
import { uploadImages, uploadVideo, aiApi, resolveImageUrl } from '@/lib/api';
import type { Category, Subcategory } from '@/types';
import {
  useAdminProduct,
  useUpdateProduct,
  useDeleteProduct,
  useRescrapeProduct,
  useStockPurchases,
  useStockSummary,
  useUpdateStockPurchase,
  useAdminCategories,
  useAdminSubcategories,
  useColorStock,
  useSetColorStock,
  useDeposits,
  useDepositStock,
  useSetDepositStock,
} from '@/hooks/useProducts';

export default function ProductEditPage() {
  const params = useParams();
  const productId = parseInt(params.id as string, 10);

  const router = useRouter();
  const apiKey = useApiKey() || '';
  const isSuperadmin = useIsSuperadmin();

  const { data: product, isLoading } = useAdminProduct(apiKey, productId);
  const { data: stockPurchases, isLoading: isStockLoading } = useStockPurchases(apiKey, productId);
  const { data: stockSummary } = useStockSummary(apiKey, [productId]);
  const updateStockPurchase = useUpdateStockPurchase(apiKey);
  const updateMutation = useUpdateProduct(apiKey);
  const deleteMutation = useDeleteProduct(apiKey);
  const rescrapeMutation = useRescrapeProduct(apiKey);
  const { data: colorStockData } = useColorStock(apiKey, productId);
  const setColorStockMutation = useSetColorStock(apiKey);
  const { data: deposits } = useDeposits(apiKey);
  const { data: depositStockData } = useDepositStock(apiKey, productId);
  const setDepositStockMutation = useSetDepositStock(apiKey);

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isImmediateDelivery, setIsImmediateDelivery] = useState(false);
  const [isCheckStock, setIsCheckStock] = useState(false);
  const [isOnDemand, setIsOnDemand] = useState(true);
  const [isPublished, setIsPublished] = useState(false);
  const [publishWithoutStock, setPublishWithoutStock] = useState(false);
  const [installments3, setInstallments3] = useState(false);
  const [customInstallmentPrice, setCustomInstallmentPrice] = useState('');
  const [stockLowThreshold, setStockLowThreshold] = useState<string>('');
  const [markup, setMarkup] = useState(0);
  const [customName, setCustomName] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [sku, setSku] = useState('');
  const [mostrarCodigo, setMostrarCodigo] = useState(false);

  // AI generation state
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // AI name generation state
  const [isGeneratingName, setIsGeneratingName] = useState(false);
  const [nameStatus, setNameStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Image search state
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [imageSearchStatus, setImageSearchStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [bgPrompt, setBgPrompt] = useState('');
  const { jobs: imgJobs, runBgPrompt, consumeResult, clearJob } = useImageProcessing();
  const currentJob = imgJobs[productId];
  const isProcessingBgPrompt = currentJob?.status === 'processing';
  const bgPromptStatus = currentJob?.status === 'done'
    ? { ok: true, msg: 'Imagen generada. Guardá para aplicar.' }
    : currentJob?.status === 'error'
      ? { ok: false, msg: currentJob.error ?? 'Error al procesar' }
      : null;

  // Image state
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageColors, setImageColors] = useState<(string | null)[]>([]);
  const [imageAltTexts, setImageAltTexts] = useState<(string | null)[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Color stock state: map of hex color → quantity
  const [colorStockQty, setColorStockQty] = useState<Record<string, number>>({});

  // Deposit stock state: map of deposit_id → quantity
  const [depositStockQty, setDepositStockQty] = useState<Record<number, number>>({});

  // Video state
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [prevProductId, setPrevProductId] = useState<number | null>(null);
  const [nextProductId, setNextProductId] = useState<number | null>(null);

  // Category/subcategory data — must come after `category` useState
  const { data: adminCategoriesRaw } = useAdminCategories();
  const adminCategories = adminCategoriesRaw as Category[] | undefined;
  const selectedCategoryObj = adminCategories?.find((c: Category) => c.name === category);
  const { data: adminSubcategoriesRaw } = useAdminSubcategories(selectedCategoryObj?.id);
  const adminSubcategories = adminSubcategoriesRaw as Subcategory[] | undefined;

  // Initialize form when product loads — only once per product ID to avoid
  // React Query background refetches resetting unsaved user changes.
  const initializedProductId = useRef<number | null>(null);
  useEffect(() => {
    if (product && initializedProductId.current !== product.id) {
      initializedProductId.current = product.id;
      setEnabled(product.enabled);
      setIsFeatured(product.is_featured || false);
      setIsImmediateDelivery(product.is_immediate_delivery || false);
      setIsCheckStock(product.is_check_stock || false);
      setIsOnDemand(product.is_on_demand ?? true);
      setStockLowThreshold(product.stock_low_threshold != null ? String(product.stock_low_threshold) : '');
      setIsPublished(product.is_published || false);
      setPublishWithoutStock(product.publish_without_stock || false);
      setInstallments3(product.installments_3 || false);
      setCustomInstallmentPrice(product.custom_installment_price ? String(product.custom_installment_price) : '');
      setMarkup(Number(product.markup_percentage));
      setCustomName(product.custom_name || '');
      setOriginalPrice(product.original_price ? String(product.original_price) : '');
      setCustomPrice(product.custom_price ? String(product.custom_price) : '');
      setCategory(product.category || '');
      setSubcategory(product.subcategory || '');
      setDescription(product.description || '');
      setShortDescription(product.short_description || '');
      setBrand(product.brand || '');
      setSku(product.sku || '');
      setMostrarCodigo(product.mostrar_codigo || false);
      // Initialize images
      const sortedImgs = [...product.images].sort((a, b) => (a.is_primary ? -1 : 1));
      setImageUrls(sortedImgs.map(img => img.url));
      setImageColors(sortedImgs.map(img => img.color || null));
      setImageAltTexts(sortedImgs.map(img => img.alt_text || null));
      setSelectedImageIndex(0);
      setVideoUrl(product.video_url || '');
    }
  }, [product]);

  // Apply image processing result when it arrives (even if navigated away and back)
  useEffect(() => {
    if (currentJob?.status === 'done') {
      const url = consumeResult(productId);
      if (url) {
        setImageUrls(prev => [...prev, url]);
        setImageColors(prev => [...prev, null]);
        setImageAltTexts(prev => [...prev, null]);
      }
    }
  }, [currentJob?.status]);

  // Initialize color stock quantities when API data arrives
  // Key: `${color}|${deposit_id}` for deposit-aware entries, or just color for legacy
  useEffect(() => {
    if (colorStockData) {
      const map: Record<string, number> = {};
      colorStockData.forEach(item => {
        const key = item.deposit_id != null ? `${item.color}|${item.deposit_id}` : item.color;
        map[key] = item.quantity;
      });
      setColorStockQty(map);
    }
  }, [colorStockData]);

  // Initialize deposit stock quantities when API data arrives
  useEffect(() => {
    if (depositStockData) {
      const map: Record<number, number> = {};
      depositStockData.forEach(item => { map[item.deposit_id] = item.quantity; });
      setDepositStockQty(map);
    }
  }, [depositStockData]);

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
    setUploadError(null);
    try {
      const uploadedUrls = await uploadImages(apiKey, files);
      setImageUrls(prev => [...prev, ...uploadedUrls]);
      setImageColors(prev => [...prev, ...uploadedUrls.map(() => null)]);
      setImageAltTexts(prev => [...prev, ...uploadedUrls.map(() => null)]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al subir imágenes';
      setUploadError(msg);
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
    setImageColors(prev => prev.filter((_, i) => i !== index));
    setImageAltTexts(prev => prev.filter((_, i) => i !== index));
    if (selectedImageIndex >= index && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  };

  const handleMoveImage = (from: number, to: number) => {
    if (to < 0 || to >= imageUrls.length) return;
    setImageUrls(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
    setImageColors(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
    setImageAltTexts(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
    setSelectedImageIndex(to);
  };

  const handleSetImageAltText = (index: number, text: string | null) => {
    setImageAltTexts(prev => {
      const arr = [...prev];
      while (arr.length <= index) arr.push(null);
      arr[index] = text || null;
      return arr;
    });
  };

  const handleSetImageColor = (index: number, color: string | null) => {
    setImageColors(prev => {
      const arr = [...prev];
      while (arr.length <= index) arr.push(null);
      arr[index] = color;
      return arr;
    });
  };

  const handleAddImageUrl = () => {
    const url = newImageUrl.trim();
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      setImageUrls(prev => [...prev, url]);
      setImageColors(prev => [...prev, null]);
      setImageAltTexts(prev => [...prev, null]);
      setNewImageUrl('');
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingVideo(true);
    setVideoUploadError(null);
    try {
      const url = await uploadVideo(apiKey, file);
      setVideoUrl(url);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al subir video';
      setVideoUploadError(msg);
    } finally {
      setIsUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handleGenerateAI = async () => {
    setIsGeneratingAI(true);
    setAiStatus(null);
    try {
      const res = await aiApi.generateSingle(apiKey, productId);
      setShortDescription(res.short_description);
      setAiStatus({ ok: true, msg: 'Descripcion generada. Guarda los cambios para aplicarla.' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al generar descripcion';
      setAiStatus({ ok: false, msg });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleGenerateName = async () => {
    setIsGeneratingName(true);
    setNameStatus(null);
    try {
      const res = await aiApi.generateName(apiKey, productId);
      const composed = mostrarCodigo && product?.codigo_interno
        ? `${res.name} - ${product.codigo_interno}`
        : res.name;
      setCustomName(composed);
      setNameStatus({ ok: true, msg: 'Nombre generado. Guarda los cambios para aplicarlo.' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al generar nombre';
      setNameStatus({ ok: false, msg });
    } finally {
      setIsGeneratingName(false);
    }
  };

  const handleSearchImages = async () => {
    setIsSearchingImages(true);
    setImageSearchStatus(null);
    try {
      const res = await aiApi.searchImages(apiKey, productId);
      if (res.found > 0) {
        setImageUrls((prev) => {
          const existing = new Set(prev);
          const newUrls = res.urls.filter((u: string) => !existing.has(u));
          return [...prev, ...newUrls];
        });
        setImageSearchStatus({ ok: true, msg: `${res.found} imagen(es) encontrada(s). Guardá para aplicar.` });
      } else {
        setImageSearchStatus({ ok: false, msg: 'No se encontraron imágenes.' });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al buscar imágenes';
      setImageSearchStatus({ ok: false, msg });
    } finally {
      setIsSearchingImages(false);
    }
  };

  const handleBgPrompt = () => {
    if (!bgPrompt.trim()) return;
    runBgPrompt(productId, bgPrompt, apiKey);
  };

  const handleSave = async () => {
    await updateMutation.mutateAsync({
      id: productId,
      data: {
        enabled,
        is_featured: isFeatured,
        is_immediate_delivery: isImmediateDelivery,
        is_check_stock: isCheckStock,
        is_on_demand: isOnDemand,
        is_published: isPublished,
        publish_without_stock: publishWithoutStock,
        installments_3: installments3,
        custom_installment_price: customInstallmentPrice ? parseFloat(customInstallmentPrice) : null,
        stock_low_threshold: stockLowThreshold !== '' ? Number(stockLowThreshold) : null,
        markup_percentage: markup,
        custom_name: customName || '',
        original_price: originalPrice ? parseFloat(originalPrice) : undefined,
        custom_price: customPrice ? parseFloat(customPrice) : undefined,
        category: category || '',
        subcategory: subcategory || '',
        description: description || '',
        short_description: shortDescription || '',
        brand: brand || '',
        sku: sku || '',
        mostrar_codigo: mostrarCodigo,
        image_urls: imageUrls,
        image_colors: imageColors,
        image_alt_texts: imageAltTexts,
        video_url: videoUrl || null,
      },
    });
    // Save color stock for colors that are still assigned to images
    const activeColors = Array.from(new Set(imageColors.filter(Boolean) as string[]));
    const activeDepositsForColor = (deposits || []).filter(d => d.is_active);
    const hasColorImages = activeColors.length > 0;

    if (hasColorImages) {
      // Build per-color-per-deposit items
      const colorStockItems: { color: string; deposit_id: number | null; quantity: number }[] = [];
      let totalColorQty = 0;
      for (const color of activeColors) {
        if (activeDepositsForColor.length > 0) {
          for (const dep of activeDepositsForColor) {
            const qty = colorStockQty[`${color}|${dep.id}`] ?? 0;
            colorStockItems.push({ color, deposit_id: dep.id, quantity: qty });
            totalColorQty += qty;
          }
        } else {
          const qty = colorStockQty[color] ?? 0;
          colorStockItems.push({ color, deposit_id: null, quantity: qty });
          totalColorQty += qty;
        }
      }
      if (totalColorQty > grossStock) {
        alert(`El total de colores (${totalColorQty}) supera el stock disponible (${grossStock}). Ajustá las cantidades antes de guardar.`);
        return;
      }
      await setColorStockMutation.mutateAsync({ productId, items: colorStockItems });
    } else {
      // No color images — clear color stock and save deposit stock
      await setColorStockMutation.mutateAsync({ productId, items: [] });

      const depositStockItems = Object.entries(depositStockQty)
        .map(([id, qty]) => ({ deposit_id: Number(id), deposit_name: '', quantity: qty }))
        .filter(i => i.quantity > 0);
      const totalDepositQty = depositStockItems.reduce((sum, i) => sum + i.quantity, 0);
      if (totalDepositQty > grossStock) {
        alert(`El total por depósito (${totalDepositQty}) supera el stock disponible (${grossStock}). Ajustá las cantidades antes de guardar.`);
        return;
      }
      await setDepositStockMutation.mutateAsync({ productId, items: depositStockItems });
    }
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
  const canEnable = markup > 0 || (!!customPrice && parseFloat(customPrice) > 0) || (!!originalPrice && parseFloat(originalPrice) > 0);
  const grossStock = (stockPurchases || []).reduce((acc, item) => acc + (item.quantity - item.out_quantity), 0);
  const reservedQty = Number(stockSummary?.items?.find(i => i.product_id === productId)?.reserved_qty || 0);
  const netStock = grossStock - reservedQty;

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
                  {product.display_name_with_code}
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
              <a
                href={`/producto/${product.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-violet-600 transition-colors"
              >
                /producto/{product.slug}
              </a>
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
                    src={resolveImageUrl(imageUrls[selectedImageIndex]) ?? imageUrls[selectedImageIndex]}
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
              <div className="flex gap-2 overflow-x-auto pb-2 items-start">
                {imageUrls.map((url, index) => (
                  <div
                    key={`${url}-${index}`}
                    className="flex flex-col items-center gap-0.5 flex-shrink-0"
                    draggable
                    onDragStart={() => { dragIndexRef.current = index; setDragIndex(index); }}
                    onDragOver={(e) => {
                      if (dragIndexRef.current === null) return;
                      e.preventDefault();
                      setDragOverIndex(prev => prev === index ? prev : index);
                    }}
                    onDrop={() => {
                      const from = dragIndexRef.current;
                      if (from !== null && from !== index) handleMoveImage(from, index);
                      dragIndexRef.current = null;
                      setDragIndex(null);
                      setDragOverIndex(null);
                    }}
                    onDragEnd={() => { dragIndexRef.current = null; setDragIndex(null); setDragOverIndex(null); }}
                  >
                    <div
                      className={`relative w-16 h-16 rounded overflow-hidden cursor-grab border-2 transition-opacity ${
                        selectedImageIndex === index
                          ? 'border-primary-500'
                          : dragOverIndex === index
                          ? 'border-blue-400'
                          : 'border-transparent'
                      } ${dragIndex === index ? 'opacity-40' : 'opacity-100'}`}
                      onClick={() => setSelectedImageIndex(index)}
                    >
                      <Image
                        src={resolveImageUrl(url) ?? url}
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
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => handleMoveImage(index, index - 1)}
                        disabled={index === 0}
                        className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveImage(index, index + 1)}
                        disabled={index === imageUrls.length - 1}
                        className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {/* Color picker — solo para imágenes no primarias */}
                    {index === 0 ? (
                      <p className="text-[9px] text-zinc-400 mt-0.5 text-center">Sin color</p>
                    ) : (
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        <div className="flex items-center gap-0.5">
                          <input
                            type="color"
                            value={imageColors[index] || '#ffffff'}
                            onChange={(e) => handleSetImageColor(index, e.target.value)}
                            className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                            title="Asignar color"
                            style={{ WebkitAppearance: 'none' }}
                          />
                          {imageColors[index] && (
                            <button
                              onClick={() => { handleSetImageColor(index, null); handleSetImageAltText(index, null); }}
                              className="text-gray-300 hover:text-red-400"
                              title="Quitar color"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                        {imageColors[index] && (
                          <input
                            type="text"
                            value={imageAltTexts[index] || ''}
                            onChange={(e) => handleSetImageAltText(index, e.target.value)}
                            placeholder="Nombre (ej: Rojo)"
                            className="w-full text-[9px] border border-gray-200 rounded px-1 py-0.5 text-gray-700 placeholder:text-gray-300"
                            maxLength={30}
                          />
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Add image button */}
                <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-16 h-16 rounded border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-primary-400 hover:text-primary-500"
                  >
                    {isUploading ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      <Plus className="h-5 w-5" />
                    )}
                  </button>
                </div>
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

              {/* AI image processing */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={bgPrompt}
                    onChange={e => setBgPrompt(e.target.value)}
                    placeholder="Describí el fondo que querés..."
                    className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleBgPrompt}
                    disabled={isProcessingBgPrompt || !bgPrompt.trim()}
                    className="text-violet-600 border-violet-200 hover:bg-violet-50 shrink-0"
                  >
                    {isProcessingBgPrompt
                      ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      : <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
                    }
                    {isProcessingBgPrompt ? 'Procesando...' : 'Cambiar fondo con IA'}
                  </Button>
                </div>
                {bgPromptStatus && (
                  <span className={`text-xs ${bgPromptStatus.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                    {bgPromptStatus.msg}
                  </span>
                )}
              </div>

              {uploadError && (
                <p className="text-xs text-red-600 font-medium">{uploadError}</p>
              )}
              <p className="text-xs text-gray-500">
                La primera imagen es la principal. Podes subir archivos o agregar URLs.
              </p>

              {/* Stock por color × depósito (cuando hay imágenes con color asignado) */}
              {imageColors.some(Boolean) && (() => {
                const activeColors = Array.from(new Set(imageColors.filter(Boolean) as string[]));
                const colorImageNameMap = Object.fromEntries(
                  imageUrls.map((url, i) => [imageColors[i], imageAltTexts[i]]).filter(([c]) => c)
                );
                const activeDeposits = (deposits || []).filter(d => d.is_active);
                const hasDeposits = activeDeposits.length > 0;
                let totalColorQty = 0;
                activeColors.forEach(c => {
                  if (hasDeposits) {
                    activeDeposits.forEach(d => { totalColorQty += colorStockQty[`${c}|${d.id}`] ?? 0; });
                  } else {
                    totalColorQty += colorStockQty[c] ?? 0;
                  }
                });
                const exceeds = totalColorQty > grossStock;
                return (
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Stock por color{hasDeposits ? ' y depósito' : ''}</p>
                    {hasDeposits ? (
                      <div className="overflow-x-auto">
                        <table className="text-xs w-full border-collapse">
                          <thead>
                            <tr>
                              <th className="text-left pr-3 pb-1 text-gray-500 font-medium">Color</th>
                              {activeDeposits.map(d => (
                                <th key={d.id} className="text-center px-2 pb-1 text-gray-500 font-medium whitespace-nowrap">
                                  {d.name}
                                  {d.seller && <span className="ml-1 text-blue-500">({d.seller})</span>}
                                </th>
                              ))}
                              <th className="text-center px-2 pb-1 text-gray-500 font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeColors.map(color => {
                              const colorName = colorImageNameMap[color];
                              const rowTotal = activeDeposits.reduce((s, d) => s + (colorStockQty[`${color}|${d.id}`] ?? 0), 0);
                              return (
                                <tr key={color} className="border-t border-gray-100">
                                  <td className="pr-3 py-1.5 flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded-full border border-gray-200 shrink-0" style={{ backgroundColor: color }} />
                                    <span className="text-gray-700 truncate max-w-[80px]">{colorName || color}</span>
                                  </td>
                                  {activeDeposits.map(d => (
                                    <td key={d.id} className="px-2 py-1.5 text-center">
                                      <input
                                        type="number"
                                        min="0"
                                        value={colorStockQty[`${color}|${d.id}`] ?? 0}
                                        onChange={e => setColorStockQty(prev => ({ ...prev, [`${color}|${d.id}`]: Math.max(0, parseInt(e.target.value) || 0) }))}
                                        className="w-16 text-sm border border-gray-200 rounded px-1 py-0.5 text-center"
                                      />
                                    </td>
                                  ))}
                                  <td className="px-2 py-1.5 text-center font-medium text-gray-700">{rowTotal}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      activeColors.map(color => {
                        const colorName = colorImageNameMap[color];
                        return (
                          <div key={color} className="flex items-center gap-3">
                            <span className="w-5 h-5 rounded-full border border-gray-200 shrink-0" style={{ backgroundColor: color }} />
                            {colorName && <span className="text-xs text-gray-600 w-20 truncate">{colorName}</span>}
                            <input
                              type="number"
                              min="0"
                              value={colorStockQty[color] ?? 0}
                              onChange={e => setColorStockQty(prev => ({ ...prev, [color]: Math.max(0, parseInt(e.target.value) || 0) }))}
                              className="w-20 text-sm border border-gray-200 rounded px-2 py-1 text-center"
                            />
                            <span className="text-xs text-gray-500">unidades</span>
                          </div>
                        );
                      })
                    )}
                    <div className={`flex items-center justify-between text-xs pt-1 border-t border-gray-100 ${exceeds ? 'text-red-600' : 'text-gray-500'}`}>
                      <span>Total asignado:</span>
                      <span className={`font-semibold ${exceeds ? 'text-red-600' : totalColorQty === grossStock ? 'text-emerald-600' : 'text-gray-700'}`}>
                        {totalColorQty} / {grossStock} en stock
                      </span>
                    </div>
                    {exceeds && (
                      <p className="text-xs text-red-600 font-medium">
                        Excede el stock en {totalColorQty - grossStock} unidades. Ajustá las cantidades antes de guardar.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Stock por depósito (solo para productos SIN variantes de color) */}
              {!imageColors.some(Boolean) && deposits && deposits.filter(d => d.is_active).length > 0 && (() => {
                const activeDeposits = deposits.filter(d => d.is_active);
                const totalDepositQty = activeDeposits.reduce((sum, d) => sum + (depositStockQty[d.id] ?? 0), 0);
                const exceedsDeposit = totalDepositQty > grossStock;
                return (
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Stock por depósito</p>
                    {activeDeposits.map(deposit => (
                      <div key={deposit.id} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 w-28 truncate">
                          {deposit.name}
                          {deposit.seller && <span className="ml-1 text-xs text-blue-500">({deposit.seller})</span>}
                        </span>
                        <input
                          type="number"
                          min="0"
                          max={grossStock}
                          value={depositStockQty[deposit.id] ?? 0}
                          onChange={e => setDepositStockQty(prev => ({ ...prev, [deposit.id]: Math.max(0, parseInt(e.target.value) || 0) }))}
                          className="w-20 text-sm border border-gray-200 rounded px-2 py-1 text-center"
                        />
                        <span className="text-xs text-gray-500">unidades</span>
                      </div>
                    ))}
                    <div className={`flex items-center justify-between text-xs pt-1 border-t border-gray-100 ${exceedsDeposit ? 'text-red-600' : 'text-gray-500'}`}>
                      <span>Total asignado:</span>
                      <span className={`font-semibold ${exceedsDeposit ? 'text-red-600' : totalDepositQty === grossStock ? 'text-emerald-600' : 'text-gray-700'}`}>
                        {totalDepositQty} / {grossStock} en stock
                      </span>
                    </div>
                    {exceedsDeposit && (
                      <p className="text-xs text-red-600 font-medium">
                        Excede el stock en {totalDepositQty - grossStock} unidades. Ajustá las cantidades antes de guardar.
                      </p>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Video */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Video className="h-5 w-5 text-gray-500" />
                Video del producto
              </h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {videoUrl && (
                <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                  <video
                    src={resolveImageUrl(videoUrl) || videoUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setVideoUrl('')}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={isUploadingVideo}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {isUploadingVideo
                    ? <RefreshCw className="h-4 w-4 animate-spin" />
                    : <Upload className="h-4 w-4" />
                  }
                  {isUploadingVideo ? 'Subiendo...' : videoUrl ? 'Reemplazar video' : 'Subir video'}
                </button>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/ogg"
                  onChange={handleVideoUpload}
                  className="hidden"
                />
              </div>
              {videoUploadError && (
                <p className="text-xs text-red-600 font-medium">{videoUploadError}</p>
              )}
              <p className="text-xs text-gray-500">
                MP4, WebM u OGG. Máximo 100MB. Guardá los cambios para aplicar.
              </p>
            </CardContent>
          </Card>

          {/* Product Details (editable) */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Datos del producto</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Nombre personalizado
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateName}
                    disabled={isGeneratingName}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Generar nombre con IA (Sentence case, sin códigos)"
                  >
                    <Sparkles className={`h-3.5 w-3.5 ${isGeneratingName ? 'animate-pulse' : ''}`} />
                    {isGeneratingName ? 'Generando...' : 'Generar con IA'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-1">
                  Nombre original: <span className="text-gray-700">{product.original_name}</span>
                </p>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={product.original_name}
                  helperText="Dejar vacio para usar el nombre original"
                />
                {nameStatus && (
                  <p className={`mt-1 text-xs ${nameStatus.ok ? 'text-purple-600' : 'text-red-600'}`}>
                    {nameStatus.msg}
                  </p>
                )}
              </div>

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

              <div className="grid grid-cols-2 gap-4 items-end">
                <Input
                  label="Código interno"
                  value={product.codigo_interno || ''}
                  disabled
                  helperText="Generado automáticamente"
                />
                <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={mostrarCodigo}
                    onChange={(e) => setMostrarCodigo(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  Mostrar código en el catálogo público
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select
                  value={category}
                  onChange={(e) => { setCategory(e.target.value); setSubcategory(''); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-sm"
                >
                  <option value="">Sin categoría</option>
                  {(adminCategories || []).map((c: Category) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {adminSubcategories && adminSubcategories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subcategoria</label>
                  <select
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-sm"
                  >
                    <option value="">Sin subcategoría</option>
                    {adminSubcategories.map((s: Subcategory) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Descripcion corta
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateAI}
                    disabled={isGeneratingAI}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Generar descripcion con IA"
                  >
                    <Sparkles className={`h-3.5 w-3.5 ${isGeneratingAI ? 'animate-pulse' : ''}`} />
                    {isGeneratingAI ? 'Generando...' : 'Generar con IA'}
                  </button>
                </div>
                <textarea
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="Descripcion breve para el catalogo"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={2}
                />
                {aiStatus && (
                  <p className={`mt-1 text-xs ${aiStatus.ok ? 'text-purple-600' : 'text-red-600'}`}>
                    {aiStatus.msg}
                  </p>
                )}
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
          {isSuperadmin && (
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
          )}

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
                    {!canEnable && !enabled
                      ? 'Requiere markup o precio para activar'
                      : 'Mostrar en catalogo publico'}
                  </p>
                </div>
                <button
                  onClick={() => (canEnable || enabled) && setEnabled(!enabled)}
                  disabled={!canEnable && !enabled}
                  title={!canEnable && !enabled ? 'Configurá un markup o precio antes de activar' : undefined}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    !canEnable && !enabled
                      ? 'bg-gray-100 cursor-not-allowed opacity-50'
                      : enabled ? 'bg-primary-600' : 'bg-gray-200'
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
                    {Number(product?.stock_qty || 0) === 0
                      ? 'No disponible — stock en 0'
                      : 'Destacar en seccion Nuevos'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (Number(product?.stock_qty || 0) === 0) return;
                    const next = !isFeatured;
                    setIsFeatured(next);
                    if (next) setIsCheckStock(false);
                  }}
                  disabled={Number(product?.stock_qty || 0) === 0}
                  title={Number(product?.stock_qty || 0) === 0 ? 'El producto no tiene stock' : undefined}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    Number(product?.stock_qty || 0) === 0
                      ? 'bg-gray-100 cursor-not-allowed opacity-50'
                      : isFeatured ? 'bg-amber-500' : 'bg-gray-200'
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
                    {Number(product?.stock_qty || 0) === 0
                      ? 'No disponible — stock en 0'
                      : 'Destacar en la seccion Entrega inmediata'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (Number(product?.stock_qty || 0) === 0) return;
                    const next = !isImmediateDelivery;
                    setIsImmediateDelivery(next);
                    if (next) { setIsOnDemand(false); setIsCheckStock(false); }
                  }}
                  disabled={Number(product?.stock_qty || 0) === 0}
                  title={Number(product?.stock_qty || 0) === 0 ? 'El producto no tiene stock' : undefined}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    Number(product?.stock_qty || 0) === 0
                      ? 'bg-gray-100 cursor-not-allowed opacity-50'
                      : isImmediateDelivery ? 'bg-emerald-600' : 'bg-gray-200'
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
                  onClick={() => {
                    const next = !isCheckStock;
                    setIsCheckStock(next);
                    if (next) { setIsFeatured(false); setIsImmediateDelivery(false); }
                  }}
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

              {/* On demand toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <span className="text-base leading-none">📦</span>
                    Por pedido
                  </p>
                  <p className="text-sm text-gray-500">
                    Se muestra el badge &quot;Por pedido&quot; en el catálogo
                  </p>
                </div>
                <button
                  onClick={() => {
                    const next = !isOnDemand;
                    setIsOnDemand(next);
                    if (next) setIsImmediateDelivery(false);
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isOnDemand ? 'bg-violet-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isOnDemand ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Stock low threshold — override por producto */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-sm">Umbral &ldquo;pocas unidades&rdquo;</p>
                  <p className="text-xs text-gray-500">
                    Override del global. Vacío = usa el global.
                  </p>
                </div>
                <input
                  type="number"
                  min="0"
                  value={stockLowThreshold}
                  onChange={(e) => setStockLowThreshold(e.target.value)}
                  placeholder="Global"
                  className="w-24 shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-right focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Publicar toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <Send className="h-4 w-4 text-blue-600" />
                    Publicar
                  </p>
                  <p className="text-sm text-gray-500">
                    Marcado para publicar en WhatsApp
                  </p>
                </div>
                <button
                  onClick={() => setIsPublished(!isPublished)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isPublished ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isPublished ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Publicar sin stock toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-violet-600" />
                      Publicar sin stock
                    </p>
                    <p className="text-sm text-gray-500">
                      URL directa activa, no aparece en el catálogo
                    </p>
                  </div>
                  <button
                    onClick={() => setPublishWithoutStock(!publishWithoutStock)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      publishWithoutStock ? 'bg-violet-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        publishWithoutStock ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {publishWithoutStock && product?.slug && (
                  <div className="flex items-center gap-2 rounded-lg bg-violet-50 border border-violet-200 px-3 py-2">
                    <span className="text-xs text-violet-700 truncate flex-1 font-mono select-all">
                      {`https://www.hefaproductos.com.ar/producto/${product.slug}`}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`https://www.hefaproductos.com.ar/producto/${product.slug}`);
                      }}
                      className="shrink-0 text-xs font-medium text-violet-700 hover:text-violet-900 border border-violet-300 rounded px-2 py-0.5 hover:bg-violet-100 transition-colors"
                    >
                      Copiar
                    </button>
                  </div>
                )}
              </div>

              {/* Cuotas sin interés toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-teal-600" />
                      3 cuotas sin interés
                    </p>
                    <p className="text-sm text-gray-500">
                      Muestra precio por cuota en el catálogo
                    </p>
                  </div>
                  <button
                    onClick={() => setInstallments3(!installments3)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      installments3 ? 'bg-teal-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        installments3 ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {installments3 && (
                  <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 space-y-2">
                    <Input
                      label="Precio por cuota (opcional)"
                      type="number"
                      value={customInstallmentPrice}
                      onChange={(e) => setCustomInstallmentPrice(e.target.value)}
                      placeholder="Vacío = precio total ÷ 3"
                      helperText="Si se define, ignora el markup para las cuotas"
                    />
                    {customInstallmentPrice && (
                      <p className="text-xs text-teal-700 font-medium">
                        Se mostrará: &ldquo;3 x {formatPrice(parseFloat(customInstallmentPrice))} sin interés&rdquo;
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Origin price + custom price — superadmin only */}
              {isSuperadmin && (
                <>
                  <Input
                    label="Precio de origen"
                    type="number"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                    placeholder="Precio del proveedor"
                    helperText="Precio de costo/proveedor"
                  />
                  <Input
                    label="Precio fijo (opcional)"
                    type="number"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder="Dejar vacio para usar markup"
                    helperText="Si se define, ignora el markup"
                  />
                </>
              )}

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
                  <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                    <span>Stock bruto: <strong>{grossStock}</strong></span>
                    <span>Reservado: <strong className="text-amber-700">{reservedQty}</strong></span>
                    <span>Stock neto: <strong className={netStock < 0 ? 'text-red-600' : 'text-gray-900'}>{netStock}</strong></span>
                  </div>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Compra</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Salidas</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Stock</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Precio Unitario</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {stockPurchases.map((purchase) => {
                          const rowStock = purchase.quantity - purchase.out_quantity;
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
                              <td className="px-3 py-2 text-right font-medium">{rowStock}</td>
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
                      <tfoot className="bg-gray-50 font-medium text-gray-700">
                        <tr>
                          <td colSpan={2} className="px-3 py-2 text-xs uppercase text-gray-500">Totales</td>
                          <td className="px-3 py-2 text-right">{grossStock + (stockPurchases || []).reduce((acc, p) => acc + p.out_quantity, 0)}</td>
                          <td className="px-3 py-2 text-right">{(stockPurchases || []).reduce((acc, p) => acc + p.out_quantity, 0)}</td>
                          <td className="px-3 py-2 text-right">{grossStock}</td>
                          <td colSpan={3} className="px-3 py-2" />
                        </tr>
                        {reservedQty > 0 && (
                          <tr className="text-amber-700">
                            <td colSpan={4} className="px-3 py-2 text-xs uppercase text-right">Reservado (ventas pendientes)</td>
                            <td className="px-3 py-2 text-right">−{reservedQty}</td>
                            <td colSpan={3} />
                          </tr>
                        )}
                        <tr className={netStock < 0 ? 'text-red-600' : 'text-gray-900'}>
                          <td colSpan={4} className="px-3 py-2 text-xs uppercase text-right font-semibold">Stock neto</td>
                          <td className="px-3 py-2 text-right font-bold">{netStock}</td>
                          <td colSpan={3} />
                        </tr>
                      </tfoot>
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
              <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                <span>Stock bruto: <strong>{grossStock}</strong></span>
                <span>Reservado: <strong className="text-amber-700">{reservedQty}</strong></span>
                <span>Stock neto: <strong className={netStock < 0 ? 'text-red-600' : 'text-gray-900'}>{netStock}</strong></span>
              </div>
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Compra</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Salidas</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Stock</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Precio Unitario</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {stockPurchases.map((purchase) => {
                      const rowStock = purchase.quantity - purchase.out_quantity;
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
                          <td className="px-3 py-2 text-right font-medium">{rowStock}</td>
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
                  <tfoot className="bg-gray-50 font-medium text-gray-700">
                    <tr>
                      <td colSpan={2} className="px-3 py-2 text-xs uppercase text-gray-500">Totales</td>
                      <td className="px-3 py-2 text-right">{grossStock + (stockPurchases || []).reduce((acc, p) => acc + p.out_quantity, 0)}</td>
                      <td className="px-3 py-2 text-right">{(stockPurchases || []).reduce((acc, p) => acc + p.out_quantity, 0)}</td>
                      <td className="px-3 py-2 text-right">{grossStock}</td>
                      <td colSpan={3} className="px-3 py-2" />
                    </tr>
                    {reservedQty > 0 && (
                      <tr className="text-amber-700">
                        <td colSpan={4} className="px-3 py-2 text-xs uppercase text-right">Reservado (ventas pendientes)</td>
                        <td className="px-3 py-2 text-right">−{reservedQty}</td>
                        <td colSpan={3} />
                      </tr>
                    )}
                    <tr className={netStock < 0 ? 'text-red-600' : 'text-gray-900'}>
                      <td colSpan={4} className="px-3 py-2 text-xs uppercase text-right font-semibold">Stock neto</td>
                      <td className="px-3 py-2 text-right font-bold">{netStock}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
