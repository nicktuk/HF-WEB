# Guía de administración — Mercado Pago Checkout Bricks

## Resumen del sistema

El checkout de MP está embebido dentro del carrito del sitio. Cuando un cliente elige "MercadoPago", el formulario de pago aparece directo en el drawer — sin redirigir a otra página. El pedido se crea en la DB **solo cuando el pago es aprobado o queda pendiente**.

---

## 1. Configuración inicial (una sola vez)

### Variables de entorno en Railway

En el dashboard de Railway, ir a tu servicio backend → **Variables** y agregar:

| Variable | Valor |
|----------|-------|
| `MP_PUBLIC_KEY` | `TEST-0b51ae08-2178-4ff1-91c7-3b449900e1f3` |
| `MP_ACCESS_TOKEN` | `TEST-3176405930532518-051420-09989b486d8ab4455c1bcbae39817b37-3309248389` |

> **Test vs Producción:** Los valores de arriba son de **sandbox** (pruebas). Cuando quieras cobrar de verdad, reemplazarlos por las credenciales productivas de tu cuenta MP (sin el prefijo `TEST-`).

### Verificar que "MercadoPago" está habilitado

En el admin del sitio → **Pagos** → verificar que el método "MercadoPago" esté en la lista. Si no está, agregarlo. El sistema lo reconoce automáticamente como MP por el campo `is_mercadopago: true`.

---

## 2. Webhook (ya configurado)

El webhook está configurado en la app HeFa de MP y apunta a:

```
https://hf-web-production.up.railway.app/api/v1/public/mp/webhook
```

Esto permite que MP notifique al backend cuando un pago cambia de estado (útil para pagos en efectivo que se confirman horas después). **No hace falta tocarlo.**

---

## 3. Flujo de un pago

```
Cliente elige MP → llena nombre/teléfono
    ↓
Backend crea preferencia en MP → devuelve preferenceId
    ↓
Formulario MP se renderiza en el carrito
    ↓
Cliente paga → MP devuelve resultado
    ↓
Backend llama a /v1/payments de MP para procesar
    ↓
Si approved o pending → se crea la Venta en la DB
    ↓
Cliente ve pantalla de confirmación con nro. de pedido
```

---

## 4. Ver pedidos de MP en el admin

Los pedidos pagados via MP aparecen en **Ventas** igual que cualquier otro pedido. El campo **Forma de pago** muestra `Mercado Pago (visa)`, `Mercado Pago (account_money)`, etc. según el método usado por el cliente.

Los pedidos con pago **pendiente** (efectivo en Rapipago/PagoFácil) también aparecen en Ventas con `paid: false`. Cuando el cliente paga en el local, MP envía un webhook y el estado queda registrado en el log (no actualiza automáticamente la venta en este momento — ver sección 6).

---

## 5. Pasar a producción

1. En tu cuenta de MP ([mercadopago.com.ar](https://www.mercadopago.com.ar)) → Configuración → Credenciales → copiar las credenciales **Productivas**.
2. Reemplazar en Railway:
   - `MP_PUBLIC_KEY` → Public Key productiva (empieza con `APP_USR-`)
   - `MP_ACCESS_TOKEN` → Access Token productivo (empieza con `APP_USR-`)
3. Hacer redeploy del backend (o las vars se aplican automáticamente).
4. El webhook ya apunta al dominio correcto, no hay que cambiarlo.

> **No mezclar test y prod.** Si la public key es de producción, el access token también debe serlo.

---

## 6. Limitaciones actuales y mejoras futuras

| Situación | Comportamiento actual |
|-----------|----------------------|
| Pago con tarjeta | Aprobado/rechazado al instante ✅ |
| Pago en efectivo (Rapipago, PagoFácil) | Se crea pedido como `paid: false`; hay que marcarlo manualmente cuando llegue la notificación del webhook |
| Actualización automática de ventas via webhook | No implementado aún — el webhook loggea pero no actualiza la DB |
| Contracargos / devoluciones | No implementado — se gestionan desde el panel de MP |

---

## 7. Troubleshooting

**El formulario de MP no aparece en el carrito**
- Verificar que `MP_PUBLIC_KEY` esté seteada en Railway y que el deploy tomó el cambio.
- En la consola del navegador (F12) puede aparecer un error de inicialización del SDK.

**El pago se procesa en MP pero no se crea la venta**
- Verificar que `MP_ACCESS_TOKEN` sea correcto y tenga permisos.
- Revisar los logs del backend en Railway → puede haber un error 401 de la API de MP.

**"Mercado Pago no está configurado" (error 503)**
- Las variables `MP_PUBLIC_KEY` y `MP_ACCESS_TOKEN` no están seteadas o están vacías.

**Los montos no coinciden (error 422)**
- El precio de un producto cambió entre que el cliente abrió el carrito y quiso pagar. El backend recalcula el total desde la DB para seguridad. El cliente debe refrescar y volver a intentar.

---

## 8. Credenciales de prueba para testear

Usar estas tarjetas en modo sandbox:

| Tarjeta | Nro. | Venc. | CVV | Resultado |
|---------|------|-------|-----|-----------|
| Visa crédito | `4509 9535 6623 3704` | `11/30` | `123` | Aprobado |
| Mastercard | `5031 7557 3453 0604` | `11/30` | `123` | Aprobado |
| Visa crédito | `4000 0000 0000 0002` | `11/30` | `123` | Rechazado |

Nombre del titular: cualquier nombre. DNI: cualquier número de 8 dígitos.

> Estas tarjetas solo funcionan con credenciales `TEST-`. Con credenciales productivas hay que usar tarjetas reales.
