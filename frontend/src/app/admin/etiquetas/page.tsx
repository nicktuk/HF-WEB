'use client';

import { useState } from 'react';
import { Pencil, RotateCcw, Check, X, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdminBadgeSettings, useUpdateBadge, useResetBadge } from '@/hooks/useBadgeLabels';

const BADGE_COLORS: Record<string, string> = {
  badge_text_immediate_delivery: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  badge_text_featured: 'bg-amber-100 text-amber-800 border-amber-200',
  badge_text_on_demand: 'bg-violet-100 text-violet-800 border-violet-200',
  badge_text_check_stock: 'bg-rose-100 text-rose-800 border-rose-200',
  badge_text_installments: 'bg-teal-100 text-teal-800 border-teal-200',
};

export default function EtiquetasPage() {
  const { data: badges, isLoading } = useAdminBadgeSettings();
  const updateBadge = useUpdateBadge();
  const resetBadge = useResetBadge();

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (key: string, current: string | null, defaultText: string) => {
    setEditingKey(key);
    setEditValue(current ?? defaultText);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const saveEdit = async (key: string) => {
    if (!editValue.trim()) return;
    await updateBadge.mutateAsync({ key, text: editValue.trim() });
    setEditingKey(null);
    setEditValue('');
  };

  const handleReset = async (key: string) => {
    await resetBadge.mutateAsync(key);
  };

  const displayText = (badge: { current: string | null; default: string }) =>
    badge.current ?? badge.default;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Tag className="h-6 w-6" />
          Etiquetas de productos
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Configurá el texto que aparece en las píldoras del catálogo público.
        </p>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-gray-500">
            Los cambios se aplican inmediatamente en el catálogo. Podés restablecer cualquier etiqueta a su valor por defecto.
          </p>
        </CardHeader>
        <CardContent className="divide-y divide-gray-100">
          {isLoading && (
            <div className="py-8 text-center text-gray-400 text-sm">Cargando...</div>
          )}
          {badges?.map((badge) => (
            <div key={badge.key} className="py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{badge.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">Por defecto: &ldquo;{badge.default}&rdquo;</p>
              </div>

              {editingKey === badge.key ? (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-36 h-8 text-sm"
                    maxLength={50}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(badge.key);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => saveEdit(badge.key)}
                    disabled={!editValue.trim() || updateBadge.isPending}
                    className="p-1.5 text-emerald-600 hover:text-emerald-700 disabled:opacity-40"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${BADGE_COLORS[badge.key] ?? 'bg-gray-100 text-gray-800 border-gray-200'}`}
                  >
                    {displayText(badge)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(badge.key, badge.current, badge.default)}
                    className="h-7 px-2"
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Editar
                  </Button>
                  {badge.is_custom && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReset(badge.key)}
                      disabled={resetBadge.isPending}
                      className="h-7 px-2 text-gray-500 hover:text-red-600"
                      title="Restablecer al valor por defecto"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
