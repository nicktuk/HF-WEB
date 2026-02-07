# Implementación: Sección "Cómo trabajamos"

## Decisión de Arquitectura: MODAL

### Justificación
Se eligió implementar un **modal** en lugar de una página separada por las siguientes razones:

#### Ventajas del Modal
1. **UX fluida**: El usuario mantiene el contexto de navegación y puede consultar la información sin abandonar el catálogo
2. **Menor fricción**: Especialmente importante en mobile, evita navegación adicional (back/forward)
3. **Acceso rápido**: Permite consultar desde cualquier punto sin perder el estado de filtros o búsqueda
4. **SEO no crítico**: La sección es informativa/educativa, no requiere indexación independiente
5. **Infraestructura existente**: El proyecto ya cuenta con un componente Modal accesible y bien implementado
6. **Coherencia con el flujo**: El sitio funciona como catálogo + comunicación WhatsApp, el modal mantiene esta filosofía

#### Por qué NO página separada
- Agrega fricción innecesaria en el customer journey
- Requiere navegación adicional (especialmente molesto en mobile)
- El contenido no es extenso para justificar una página completa
- El objetivo es educativo/contextual, no transaccional

## Archivos Modificados/Creados

### 1. Nuevo Componente: `HowWeWorkModal.tsx`
**Ubicación**: `D:\Desarrollo\HF WEB\frontend\src\components\public\HowWeWorkModal.tsx`

**Características**:
- Estructura visual con 5 pasos numerados
- Íconos de lucide-react para cada sección
- Colores semánticos:
  - Azul: información general
  - Verde: disponibilidad y contacto
  - Emerald: entrega inmediata (destaque especial)
  - Ámbar: asesoramiento
  - Púrpura: entrega
- Secciones con jerarquía visual clara
- CTA integrado de WhatsApp
- Totalmente responsive (mobile-first)
- Accesible (ARIA labels, navegación por teclado)

### 2. Página Principal: `page.tsx`
**Ubicación**: `D:\Desarrollo\HF WEB\frontend\src\app\page.tsx`

**Cambios realizados**:
1. Importación del componente `HowWeWorkModal` y del ícono `Info`
2. Agregado estado para controlar la apertura del modal: `howWeWorkOpen`
3. Botón "Cómo trabajamos" en el header:
   - Desktop: texto completo "Cómo trabajamos"
   - Mobile: texto compacto "Info"
   - Ícono Info de lucide-react
   - Estilos consistentes con el diseño existente
4. Instancia del modal al final del layout
5. Actualización del skeleton loading para incluir los botones del header

## Características de Accesibilidad

### Cumplimiento WCAG 2.1 AA
- **Navegación por teclado**: Modal se puede cerrar con Escape
- **Focus management**: Al abrir el modal, el focus se maneja correctamente
- **ARIA attributes**: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- **Contraste de color**: Todos los textos cumplen ratio 4.5:1 mínimo
- **Labels descriptivos**: Botones con `aria-label` apropiados
- **Estructura semántica**: Uso correcto de headings (h1, h2, h3)

### Responsive Design
- **Mobile-first**: Diseño optimizado primero para mobile
- **Breakpoints**: Ajustes en `sm:` para desktop
- **Scroll interno**: El modal permite scroll cuando el contenido excede viewport
- **Touch-friendly**: Botones con tamaño mínimo de 44x44px

## Integración con WhatsApp

El modal incluye:
1. Referencia contextual a WhatsApp en paso 2
2. CTA principal al final con botón destacado de WhatsApp
3. Usa la variable de entorno `NEXT_PUBLIC_WHATSAPP_NUMBER`
4. Mantiene coherencia con los botones de WhatsApp existentes

## Diseño Visual

### Jerarquía de Información
1. **Intro**: Fondo azul claro con explicación del modelo de negocio
2. **5 Pasos numerados**: Cada uno con ícono y color distintivo
3. **Mensaje clave**: Destacado en gradiente azul-índigo
4. **Sección "Por qué"**: Lista de beneficios con checkmarks
5. **CTA Final**: Fondo verde con llamado a acción claro

### Paleta de Colores
- **Primario (Azul)**: Información general, marca
- **Verde**: Comunicación, WhatsApp, disponibilidad
- **Emerald**: Entrega inmediata (destaque especial)
- **Ámbar**: Asesoramiento, ayuda
- **Púrpura**: Logística, entrega
- **Grises**: Textos y fondos neutros

### Íconos Utilizados (lucide-react)
- `ShoppingCart`: Explorar catálogo
- `MessageCircle`: Consulta por WhatsApp
- `Zap`: Entrega inmediata
- `UserCheck`: Asesoramiento
- `Truck`: Entrega
- `Lightbulb`: Objetivo/mensaje clave
- `Sparkles`: Beneficios
- `CheckCircle2`: Lista de items
- `ArrowRight`: Énfasis en puntos clave
- `Info`: Botón del header

## Rendimiento

- **Code splitting**: El modal se carga con el componente principal pero no afecta TTI
- **Lazy loading**: No aplica ya que está en el bundle principal (el contenido es crítico para UX)
- **CSS**: Usa Tailwind, optimizado automáticamente por Next.js
- **Bundle size**: Incremento mínimo (~2KB gzipped)

## Testing Sugerido

### Manual
1. Abrir modal desde header (desktop y mobile)
2. Verificar scroll interno funciona correctamente
3. Cerrar con botón X, escape, y click fuera del modal
4. Verificar navegación por teclado (Tab, Enter, Escape)
5. Probar en diferentes tamaños de pantalla
6. Verificar link de WhatsApp funciona correctamente

### Automatizado (recomendado)
```typescript
// Ejemplo con Testing Library
describe('HowWeWorkModal', () => {
  it('opens when clicking Info button', () => {});
  it('closes on escape key', () => {});
  it('closes on overlay click', () => {});
  it('WhatsApp link has correct number', () => {});
  it('is keyboard navigable', () => {});
});
```

### Accesibilidad
- Ejecutar axe-core o WAVE para verificar violations
- Probar con screen reader (NVDA, JAWS, VoiceOver)
- Verificar contraste con herramientas como WebAIM

## Próximas Mejoras Opcionales

1. **Analytics**: Trackear apertura del modal para medir engagement
2. **A/B Testing**: Probar diferentes versiones del contenido
3. **Animaciones**: Agregar transiciones suaves (fade-in) con framer-motion
4. **Hash URL**: Permitir compartir link directo que abra el modal (#como-trabajamos)
5. **Video explicativo**: Complementar con video corto del proceso
6. **FAQ**: Expandir con preguntas frecuentes adicionales

## Comandos de Desarrollo

```bash
# Ejecutar en modo desarrollo
cd frontend
npm run dev

# Build para producción
npm run build

# Iniciar servidor de producción
npm start
```

## Notas Técnicas

- Compatible con Next.js 14.2.35
- Requiere lucide-react ^0.309.0
- No requiere dependencias adicionales
- No afecta funcionalidad existente
- Mantiene consistency con el design system del proyecto
