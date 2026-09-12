'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, X, Upload, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiKey } from '@/hooks/useAuth';
import { uploadImages, resolveImageUrl, aiApi } from '@/lib/api';
import { useAdminProduct, useComercioConfig, useSetComercioConfig } from '@/hooks/useProducts';
import { getComercioIcon } from '@/lib/comercio-icons';
import type { ComercioIconItem } from '@/types';

export default function ProductComercioConfigPage() {
  const params = useParams();
  const productId = parseInt(params.id as string, 10);
  const apiKey = useApiKey() || '';

  const { data: product, isLoading: isLoadingProduct } = useAdminProduct(apiKey, productId);
  const { data: config, isLoading: isLoadingConfig } = useComercioConfig(apiKey, productId);
  const updateMutation = useSetComercioConfig(apiKey);

  const [esMayorista, setEsMayorista] = useState(false);
  const [precioOverride, setPrecioOverride] = useState('');
  const [unidadesPorBulto, setUnidadesPorBulto] = useState('');
  const [cantidadMinima, setCantidadMinima] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [iconos, setIconos] = useState<ComercioIconItem[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageAltTexts, setImageAltTexts] = useState<(string | null)[]>([]);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isGeneratingIcons, setIsGeneratingIcons] = useState(false);
  const [iconsError, setIconsError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (config && !initialized.current) {
      initialized.current = true;
      setEsMayorista(config.es_mayorista);
      setPrecioOverride(config.precio_mayorista_override != null ? String(config.precio_mayorista_override) : '');
      setUnidadesPorBulto(config.unidades_por_bulto != null ? String(config.unidades_por_bulto) : '');
      setCantidadMinima(config.cantidad_minima != null ? String(config.cantidad_minima) : '');
      setDescripcion(config.descripcion || '');
      setIconos(config.iconos || []);
      setImageUrls(config.images.map(i => i.url));
      setImageAltTexts(config.images.map(i => i.alt_text ?? null));
    }
  }, [config]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      const uploadedUrls = await uploadImages(apiKey, files);
      setImageUrls(prev => [...prev, ...uploadedUrls]);
      setImageAltTexts(prev => [...prev, ...uploadedUrls.map(() => null)]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al subir imágenes';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGenerateIcons = async () => {
    if (!descripcion.trim()) {
      setIconsError('Escribí primero una descripción para poder generar íconos.');
      return;
    }
    setIsGeneratingIcons(true);
    setIconsError(null);
    try {
      const res = await aiApi.generateComercioIcons(apiKey, productId, descripcion);
      setIconos(res.icons);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al generar íconos';
      setIconsError(msg);
    } finally {
      setIsGeneratingIcons(false);
    }
  };

  const handleRemoveIcon = (index: number) => {
    setIconos(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveImage = (index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
    setImageAltTexts(prev => prev.filter((_, i) => i !== index));
  };

  const handleMoveImage = (from: number, to: number) => {
    if (to < 0 || to >= imageUrls.length) return;
    setImageUrls(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setImageAltTexts(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handleSave = () => {
    updateMutation.mutate({
      productId,
      data: {
        es_mayorista: esMayorista,
        precio_mayorista_override: precioOverride !== '' ? parseFloat(precioOverride) : null,
        unidades_por_bulto: unidadesPorBulto !== '' ? Number(unidadesPorBulto) : null,
        cantidad_minima: cantidadMinima !== '' ? Number(cantidadMinima) : null,
        descripcion: descripcion || null,
        iconos: iconos.length > 0 ? iconos : null,
        image_urls: imageUrls,
        image_alt_texts: imageAltTexts,
      },
    });
  };

  const isLoading = isLoadingProduct || isLoadingConfig;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-30 bg-gray-100/80 backdrop-blur border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-4">
          <Link
            href={`/admin/productos/${productId}`}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-xs text-gray-500">Canal comercios</p>
            <h1 className="text-xl font-bold text-gray-900">
              {product?.display_name_with_code || `Producto #${productId}`}
            </h1>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Visibilidad y precio</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Visible en canal comercios</p>
                <p className="text-sm text-gray-500">
                  Habilita este producto en el catálogo mayorista (/comercios)
                </p>
              </div>
              <button
                onClick={() => setEsMayorista(!esMayorista)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  esMayorista ? 'bg-primary-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    esMayorista ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-sm">Precio manual (override)</p>
                <p className="text-xs text-gray-500">
                  Pisa el cálculo automático de precio comercio. Vacío = se calcula por regla.
                </p>
              </div>
              <input
                type="number"
                min="0"
                value={precioOverride}
                onChange={(e) => setPrecioOverride(e.target.value)}
                placeholder="Automático"
                className="w-28 shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-right focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-sm">Unidades por bulto</p>
                <p className="text-xs text-gray-500">
                  Múltiplo mínimo de compra en el canal comercios. Vacío = se vende suelto.
                </p>
              </div>
              <input
                type="number"
                min="1"
                value={unidadesPorBulto}
                onChange={(e) => setUnidadesPorBulto(e.target.value)}
                placeholder="Suelto"
                className="w-24 shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-right focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-sm">Cantidad mínima de compra</p>
                <p className="text-xs text-gray-500">
                  Mínimo de unidades para comprar en el canal comercios. Vacío = sin mínimo.
                </p>
              </div>
              <input
                type="number"
                min="1"
                value={cantidadMinima}
                onChange={(e) => setCantidadMinima(e.target.value)}
                placeholder="Sin mínimo"
                className="w-24 shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-right focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">Descripción (canal comercios)</h2>
                <p className="text-sm text-gray-500">
                  Propia de este canal — no se toma la del catálogo minorista.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateIcons}
                disabled={isGeneratingIcons}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                title="Generar íconos con IA a partir de la descripción"
              >
                <Sparkles className={`h-3.5 w-3.5 ${isGeneratingIcons ? 'animate-pulse' : ''}`} />
                {isGeneratingIcons ? 'Generando...' : 'Generar íconos con IA'}
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={5}
              placeholder="Descripción para el comprador mayorista..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />

            {iconsError && (
              <p className="text-sm text-red-600">{iconsError}</p>
            )}

            {iconos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {iconos.map((item, index) => {
                  const IconComponent = getComercioIcon(item.icon);
                  return (
                    <div
                      key={`${item.icon}-${index}`}
                      className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-full bg-gray-100 border border-gray-200 text-sm text-gray-700"
                    >
                      {IconComponent && <IconComponent className="h-3.5 w-3.5 text-primary-600 shrink-0" />}
                      <span>{item.label}</span>
                      <button
                        onClick={() => handleRemoveIcon(index)}
                        className="p-0.5 text-gray-400 hover:text-gray-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold">Fotos (canal comercios)</h2>
            <p className="text-sm text-gray-500">
              Propias de este canal — no se toman las del catálogo minorista.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3">
              {imageUrls.map((url, index) => (
                <div key={`${url}-${index}`} className="flex flex-col items-center gap-1">
                  <div className="relative w-20 h-20 rounded overflow-hidden border border-gray-200">
                    <Image
                      src={resolveImageUrl(url) ?? url}
                      alt=""
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => handleRemoveImage(index)}
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
                </div>
              ))}

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-20 h-20 rounded border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-primary-400 hover:text-primary-500 disabled:opacity-50"
              >
                <Upload className="h-5 w-5" />
                <span className="text-[10px]">{isUploading ? 'Subiendo...' : 'Agregar'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
            {uploadError && (
              <p className="text-sm text-red-600">{uploadError}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 pt-6">
            <Button
              onClick={handleSave}
              isLoading={updateMutation.isPending || isUploading}
              className="w-full"
            >
              Guardar cambios
            </Button>
            {updateMutation.isError && (
              <p className="text-sm text-red-600 text-center">
                {updateMutation.error instanceof Error ? updateMutation.error.message : 'Error al guardar.'}
              </p>
            )}
            {updateMutation.isSuccess && (
              <p className="text-sm text-green-600 text-center">
                Cambios guardados correctamente.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
