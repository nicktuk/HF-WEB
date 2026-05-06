'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, ShoppingCart, BarChart3, Settings, Tags, Globe, MapPin, TrendingUp } from 'lucide-react';
import { useApiKey } from '@/hooks/useAuth';
import { importScorerApi } from '@/lib/api';
import type { ISMepRate } from '@/types';

export default function ImportScorerDashboard() {
  const apiKey = useApiKey() || '';
  const [mep, setMep] = useState<ISMepRate | null>(null);
  const [resumen, setResumen] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!apiKey) return;
    Promise.all([
      importScorerApi.getMep(apiKey).catch(() => null),
      importScorerApi.getResumen(apiKey).catch(() => null),
    ]).then(([mepData, resumenData]) => {
      setMep(mepData);
      setResumen(resumenData);
      setLoading(false);
    });
  }, [apiKey]);

  const cards = [
    { href: '/admin/import-scorer/templates', icon: Tags, label: 'Templates', desc: 'Plantillas de rubros' },
    { href: '/admin/import-scorer/retailers', icon: Globe, label: 'Retailers', desc: 'Tiendas USA' },
    { href: '/admin/import-scorer/outlets', icon: MapPin, label: 'Outlets', desc: 'Outlets físicos Miami' },
    { href: '/admin/import-scorer/rubros', icon: Package, label: 'Rubros', desc: 'Categorías monitoreadas' },
    { href: '/admin/import-scorer/carritos', icon: ShoppingCart, label: 'Carritos', desc: 'Envíos planificados' },
    { href: '/admin/import-scorer/analytics', icon: BarChart3, label: 'Analytics', desc: 'ROI y calibración' },
    { href: '/admin/import-scorer/configuracion', icon: Settings, label: 'Configuración', desc: 'Parámetros globales' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import Scorer</h1>
        <p className="text-sm text-gray-500 mt-1">Inteligencia de importación USA → Argentina</p>
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Dólar MEP</p>
          {loading ? (
            <div className="h-8 w-24 bg-gray-100 rounded animate-pulse" />
          ) : mep ? (
            <>
              <p className="text-2xl font-bold text-gray-900">
                ${mep.cotizacion.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-gray-400 mt-1">Fuente: {mep.fuente}</p>
            </>
          ) : (
            <p className="text-sm text-red-500">No disponible</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Carritos activos</p>
          {loading ? (
            <div className="h-8 w-12 bg-gray-100 rounded animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-gray-900">{resumen?.carritos_activos ?? 0}</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Última corrida</p>
          {loading ? (
            <div className="h-8 w-32 bg-gray-100 rounded animate-pulse" />
          ) : resumen?.ultima_corrida?.fecha ? (
            <>
              <p className="text-sm font-semibold text-gray-900">
                {new Date(resumen.ultima_corrida.fecha).toLocaleDateString('es-AR')}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {resumen.ultima_corrida.productos_act} productos actualizados
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400">Sin corridas aún</p>
          )}
        </div>
      </div>

      {/* Navegación */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
          >
            <card.icon className="h-6 w-6 text-gray-400 group-hover:text-blue-500 mb-2 transition-colors" />
            <p className="font-semibold text-gray-900 text-sm">{card.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{card.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
