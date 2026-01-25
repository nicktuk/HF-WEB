'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ModalContent, ModalFooter } from '@/components/ui/modal';
import { useSourceWebsites, useCreateProduct } from '@/hooks/useProducts';
import type { ProductCreateForm } from '@/types';

const createProductSchema = z.object({
  source_website_id: z.number().min(1, 'Selecciona una web de origen'),
  slug: z
    .string()
    .min(3, 'El slug debe tener al menos 3 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  markup_percentage: z.number().min(0).max(500),
  enabled: z.boolean(),
  category: z.string().optional(),
});

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
}

export function AddProductModal({ isOpen, onClose, apiKey }: AddProductModalProps) {
  const { data: sourceWebsites } = useSourceWebsites(apiKey);
  const createMutation = useCreateProduct(apiKey);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductCreateForm>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      source_website_id: 0,
      slug: '',
      markup_percentage: 20,
      enabled: false,
    },
  });

  const onSubmit = async (data: ProductCreateForm) => {
    try {
      await createMutation.mutateAsync(data);
      reset();
      onClose();
    } catch (error) {
      // Error is handled by mutation
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Agregar Producto" size="md">
      <form onSubmit={handleSubmit(onSubmit)}>
        <ModalContent className="space-y-4">
          {/* Source Website */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Web de origen
            </label>
            <select
              {...register('source_website_id', { valueAsNumber: true })}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500"
            >
              <option value={0}>Seleccionar...</option>
              {sourceWebsites?.items.map((website) => (
                <option key={website.id} value={website.id}>
                  {website.display_name}
                </option>
              ))}
            </select>
            {errors.source_website_id && (
              <p className="mt-1 text-sm text-red-600">{errors.source_website_id.message}</p>
            )}
          </div>

          {/* Slug */}
          <Input
            {...register('slug')}
            label="Slug del producto"
            placeholder="ej: pava-electrica-philips-hd9360"
            error={errors.slug?.message}
            helperText="El identificador del producto en la URL de origen"
          />

          {/* Markup */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Markup inicial (%)
            </label>
            <input
              type="number"
              {...register('markup_percentage', { valueAsNumber: true })}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500"
              min={0}
              max={500}
            />
            {errors.markup_percentage && (
              <p className="mt-1 text-sm text-red-600">{errors.markup_percentage.message}</p>
            )}
          </div>

          {/* Category */}
          <Input
            {...register('category')}
            label="Categoría (opcional)"
            placeholder="ej: Electrodomésticos"
          />

          {/* Enabled */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              {...register('enabled')}
              id="enabled"
              className="h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
            />
            <label htmlFor="enabled" className="text-sm text-gray-700">
              Habilitar inmediatamente en el catálogo
            </label>
          </div>

          {createMutation.isError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">
                {createMutation.error?.message || 'Error al crear el producto'}
              </p>
            </div>
          )}
        </ModalContent>

        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={createMutation.isPending}>
            Scrapear y Guardar
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
