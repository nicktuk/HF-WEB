'use client';

import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiKey } from '@/hooks/useAuth';
import { useCodigosAmba, useCreateCodigoAmba, useDeleteCodigoAmba } from '@/hooks/useProducts';

export default function CodigosAmbaPage() {
  const apiKey = useApiKey() || '';
  const { data: codigos, isLoading } = useCodigosAmba(apiKey);
  const createCodigo = useCreateCodigoAmba(apiKey);
  const deleteCodigo = useDeleteCodigoAmba(apiKey);

  const [newDesde, setNewDesde] = useState('');
  const [newHasta, setNewHasta] = useState('');

  const handleCreate = async () => {
    const desde = Number(newDesde);
    const hasta = newHasta ? Number(newHasta) : desde;
    if (!desde || desde < 1000 || desde > 9999) return;
    try {
      await createCodigo.mutateAsync({ codigo_desde: desde, codigo_hasta: hasta });
      setNewDesde('');
      setNewHasta('');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al crear el código');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este rango de código postal?')) return;
    try {
      await deleteCodigo.mutateAsync(id);
    } catch {
      alert('Error al eliminar el código');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Códigos AMBA</h1>
        <p className="text-gray-600">
          Rangos de código postal que se consideran zona AMBA. Cuando un cliente elige envío, el sistema
          revisa el código postal contra esta lista para aplicar el costo de AMBA o el de Resto del país.
        </p>
      </div>

      {/* Create */}
      <div className="bg-white rounded-lg border p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Nuevo rango</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <Input
            type="number"
            placeholder="Desde (ej: 1000)"
            value={newDesde}
            onChange={(e) => setNewDesde(e.target.value)}
            className="max-w-[160px]"
          />
          <span className="text-gray-400 text-sm">a</span>
          <Input
            type="number"
            placeholder="Hasta (opcional, un solo CP si se deja vacío)"
            value={newHasta}
            onChange={(e) => setNewHasta(e.target.value)}
            className="max-w-[220px]"
          />
          <Button onClick={handleCreate} disabled={!newDesde.trim() || createCodigo.isPending} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-lg border">
        {isLoading ? (
          <div className="p-4 text-sm text-gray-500">Cargando...</div>
        ) : !codigos?.length ? (
          <div className="p-4 text-sm text-gray-500">No hay códigos cargados. Todos los envíos se cotizan como &ldquo;Resto del país&rdquo; hasta que agregues rangos.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Desde</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Hasta</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {codigos.map((codigo) => (
                <tr key={codigo.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{codigo.codigo_desde}</td>
                  <td className="px-4 py-3 text-gray-600">{codigo.codigo_hasta}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(codigo.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
