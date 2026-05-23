'use client';

import { useState } from 'react';
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiKey } from '@/hooks/useAuth';
import { useDeposits, useCreateDeposit, useUpdateDeposit, useDeleteDeposit } from '@/hooks/useProducts';
import type { Deposit } from '@/types';

export default function DepositosPage() {
  const apiKey = useApiKey() || '';
  const { data: deposits, isLoading } = useDeposits(apiKey);
  const createDeposit = useCreateDeposit(apiKey);
  const updateDeposit = useUpdateDeposit(apiKey);
  const deleteDeposit = useDeleteDeposit(apiKey);

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleCreate = async () => {
    const name = newName.trim().toUpperCase();
    if (!name) return;
    try {
      await createDeposit.mutateAsync(name);
      setNewName('');
    } catch {
      alert('Error al crear depósito');
    }
  };

  const startEdit = (deposit: Deposit) => {
    setEditingId(deposit.id);
    setEditingName(deposit.name);
  };

  const handleUpdate = async (id: number) => {
    const name = editingName.trim().toUpperCase();
    if (!name) return;
    try {
      await updateDeposit.mutateAsync({ id, data: { name } });
      setEditingId(null);
    } catch {
      alert('Error al actualizar depósito');
    }
  };

  const handleToggleActive = async (deposit: Deposit) => {
    try {
      await updateDeposit.mutateAsync({ id: deposit.id, data: { is_active: !deposit.is_active } });
    } catch {
      alert('Error al actualizar depósito');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este depósito? El stock asociado quedará sin depósito asignado.')) return;
    try {
      await deleteDeposit.mutateAsync(id);
    } catch {
      alert('Error al eliminar depósito');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Depósitos</h1>
        <p className="text-gray-600">Administrá los depósitos donde se almacena el stock.</p>
      </div>

      {/* Create */}
      <div className="bg-white rounded-lg border p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Nuevo depósito</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Nombre del depósito (ej: FACU, HEBER)"
            value={newName}
            onChange={(e) => setNewName(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="max-w-xs"
          />
          <Button onClick={handleCreate} disabled={!newName.trim() || createDeposit.isPending} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-lg border">
        {isLoading ? (
          <div className="p-4 text-sm text-gray-500">Cargando...</div>
        ) : !deposits?.length ? (
          <div className="p-4 text-sm text-gray-500">No hay depósitos creados.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {deposits.map((deposit) => (
                <tr key={deposit.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {editingId === deposit.id ? (
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdate(deposit.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="h-7 text-sm max-w-xs"
                        autoFocus
                      />
                    ) : (
                      deposit.name
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(deposit)}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        deposit.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {deposit.is_active ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingId === deposit.id ? (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleUpdate(deposit.id)}>
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4 text-gray-500" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(deposit)}>
                          <Pencil className="h-4 w-4 text-gray-500" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(deposit.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    )}
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
