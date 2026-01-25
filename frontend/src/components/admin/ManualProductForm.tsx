'use client';

import { useState, useRef } from 'react';
import { X, Plus, Trash2, Upload, Link as LinkIcon, Image as ImageIcon, Star } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateProductManual } from '@/hooks/useProducts';
import { useApiKey } from '@/hooks/useAuth';
import { uploadImages } from '@/lib/api';

interface ManualProductFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ManualProductForm({ onClose, onSuccess }: ManualProductFormProps) {
  const apiKey = useApiKey() || '';
  const createMutation = useCreateProductManual(apiKey);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>(['']);
  const [enabled, setEnabled] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);

  // Image upload state
  const [imageMode, setImageMode] = useState<'url' | 'upload'>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddImage = () => {
    setImageUrls([...imageUrls, '']);
  };

  const handleRemoveImage = (index: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index));
  };

  const handleImageChange = (index: number, value: string) => {
    const newUrls = [...imageUrls];
    newUrls[index] = value;
    setImageUrls(newUrls);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Add files to state
    setUploadedFiles(prev => [...prev, ...files]);

    // Create previews
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveUploadedFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setUploadPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !price) {
      return;
    }

    try {
      let finalImageUrls: string[] = [];

      if (imageMode === 'upload' && uploadedFiles.length > 0) {
        // Upload files first
        setIsUploading(true);
        try {
          const uploadedUrls = await uploadImages(apiKey, uploadedFiles);
          finalImageUrls = uploadedUrls;
        } finally {
          setIsUploading(false);
        }
      } else {
        // Use URL inputs
        finalImageUrls = imageUrls.filter(url => url.trim());
      }

      await createMutation.mutateAsync({
        name: name.trim(),
        price: parseFloat(price),
        description: description.trim() || undefined,
        short_description: shortDescription.trim() || undefined,
        brand: brand.trim() || undefined,
        sku: sku.trim() || undefined,
        category: category.trim() || undefined,
        image_urls: finalImageUrls,
        enabled,
        is_featured: isFeatured,
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating product:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Crear Producto Manual</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <Input
            label="Nombre del producto *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Heladera Samsung 350L"
            required
          />

          <Input
            label="Precio *"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Ej: 450000"
            min="0"
            step="0.01"
            required
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
              placeholder="Ej: RT32K5930S"
            />
          </div>

          <Input
            label="Categoria"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Ej: Heladeras"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripcion corta
            </label>
            <textarea
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="Descripcion breve para mostrar en el catalogo"
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Imagenes
            </label>

            {/* Mode toggle */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setImageMode('upload')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  imageMode === 'upload'
                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Upload className="h-4 w-4" />
                Subir archivos
              </button>
              <button
                type="button"
                onClick={() => setImageMode('url')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  imageMode === 'url'
                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <LinkIcon className="h-4 w-4" />
                URLs
              </button>
            </div>

            {imageMode === 'upload' ? (
              <div className="space-y-3">
                {/* Upload area */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition-colors"
                >
                  <ImageIcon className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">
                    Click para seleccionar imagenes
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    JPG, PNG, WebP, GIF - Max 10MB
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* Preview uploaded files */}
                {uploadPreviews.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {uploadPreviews.map((preview, index) => (
                      <div key={index} className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                          <Image
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveUploadedFile(index)}
                          className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        {index === 0 && (
                          <span className="absolute bottom-1 left-1 text-xs bg-primary-600 text-white px-1.5 py-0.5 rounded">
                            Principal
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddImage}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar
                  </Button>
                </div>
                {imageUrls.map((url, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => handleImageChange(index, e.target.value)}
                      placeholder="https://ejemplo.com/imagen.jpg"
                      className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    {imageUrls.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-500 mt-2">
              La primera imagen sera la principal
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="enabled"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="enabled" className="text-sm text-gray-700">
                Habilitar producto (visible en catalogo)
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_featured"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="h-4 w-4 rounded border-amber-300 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="is_featured" className="text-sm text-gray-700 flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                Marcar como Nuevo
              </label>
            </div>
          </div>

          {createMutation.isError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              Error al crear el producto. Verifica los datos e intenta nuevamente.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={createMutation.isPending || isUploading}>
              {isUploading ? 'Subiendo imagenes...' : 'Crear Producto'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
