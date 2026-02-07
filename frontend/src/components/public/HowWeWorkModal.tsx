'use client';

import { Modal, ModalContent } from '@/components/ui/modal';
import {
  ShoppingCart,
  MessageCircle,
  Package,
  UserCheck,
  Truck,
  Lightbulb,
  CheckCircle2,
  Sparkles,
  Zap,
  ArrowRight
} from 'lucide-react';

interface HowWeWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HowWeWorkModal({ isOpen, onClose }: HowWeWorkModalProps) {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" title="Cómo trabajamos en HeFa">
      <ModalContent className="p-6 space-y-6">
        {/* Intro */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
          <p className="text-gray-700 leading-relaxed">
            En HeFa no funcionamos como una tienda tradicional con stock fijo.
            Trabajamos como un <strong className="text-blue-700">catálogo curado</strong> y un{' '}
            <strong className="text-blue-700">servicio de gestión de compra</strong>, para ayudarte a elegir bien y evitar compras frustradas.
          </p>
        </div>

        {/* Step 1 */}
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              1
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Explorás el catálogo</h3>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Recorrés productos que seleccionamos de distintos proveedores.
            </p>
            <div className="mt-2 flex items-start gap-2 text-sm text-gray-500">
              <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-500" />
              <span>La idea es descubrir opciones, no comprar a ciegas.</span>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">
              2
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Consultás por WhatsApp</h3>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Cuando algo te interesa, nos escribís por WhatsApp.
              Ahí confirmamos <strong>disponibilidad real</strong> antes de avanzar.
            </p>
          </div>
        </div>

        {/* Step 3 - Immediate Delivery */}
        <div className="flex gap-4 bg-emerald-50 rounded-lg p-4 border border-emerald-200">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
              3
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-5 w-5 text-emerald-600 fill-current" />
              <h3 className="text-lg font-semibold text-gray-900">Entrega inmediata (cuando hay stock)</h3>
            </div>
            <p className="text-gray-700 leading-relaxed mb-2">
              Algunos productos los tenemos en stock propio y entrega inmediata.
            </p>
            <div className="flex items-start gap-2 text-sm text-emerald-800">
              <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-600" />
              <span>
                Esos productos están claramente marcados en la sección <strong>"Entrega inmediata"</strong> para que los identifiques rápido.
              </span>
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              4
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-5 w-5 text-amber-600" />
              <h3 className="text-lg font-semibold text-gray-900">Te asesoramos (siempre)</h3>
            </div>
            <p className="text-gray-600 leading-relaxed mb-3">
              Si el producto que consultás no está disponible en ese momento:
            </p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-sm text-gray-600">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
                <span>te avisamos de inmediato</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-600">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
                <span>te recomendamos alternativas para el mismo uso o necesidad</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-600">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
                <span>te ayudamos a elegir la opción que más conviene</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Step 5 */}
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              5
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Confirmamos y entregamos</h3>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Una vez definida la mejor opción, gestionamos la compra y coordinamos la entrega.
            </p>
          </div>
        </div>

        {/* Key Message */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-4 text-white">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-6 w-6 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-lg mb-1">Nuestro objetivo</p>
              <p className="text-blue-50">
                No es que compres rápido, <strong className="text-white">es que compres bien.</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Why We Work This Way */}
        <div className="border-t pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">¿Por qué trabajamos así?</h3>
          </div>
          <p className="text-gray-600 mb-4">Porque este modelo nos permite:</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />
              <span>ofrecer más variedad</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />
              <span>conseguir mejores precios</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />
              <span>tener stock propio en productos clave</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />
              <span>asesorarte antes de que compres</span>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-sm text-gray-700 text-center font-medium">
              En HeFa combinamos <span className="text-blue-700">catálogo</span> + <span className="text-amber-700">asesoramiento</span> + <span className="text-emerald-700">entrega inmediata</span> cuando es posible.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-5 border border-green-200">
          <div className="flex items-start gap-3">
            <MessageCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">¿Cómo seguimos?</h3>
              <p className="text-gray-700 mb-3">Si viste algo que te interesa:</p>
              <ul className="space-y-2 mb-4">
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <ArrowRight className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span>escribinos por WhatsApp</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <ArrowRight className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span>confirmamos disponibilidad</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <ArrowRight className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span>y te ayudamos a elegir la mejor opción</span>
                </li>
              </ul>
              {whatsappNumber && (
                <a
                  href={`https://wa.me/${whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm shadow-sm"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Contactar por WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
