# Plan de pruebas manuales con Burp Suite

Pruebas sobre la tienda **en un entorno autorizado** (local o un servidor de pruebas con `BOLD_TEST_MODE=true`
y `TOPUP_TEST_MODE=true`). Nunca contra producción con dinero real ni contra la API real de Central One.
Sin escáneres activos de carga ni pruebas de denegación de servicio.

Preparación:

1. Arranca la tienda con datos de prueba (`npm run dev` o el servidor de pruebas) y configura el navegador con el proxy de Burp.
2. Crea dos clientes de prueba (A y B) y un pedido de recarga con cada uno. Anota número de pedido, token de seguimiento (`?t=`) y cookies de sesión.
3. En Burp: *Proxy → HTTP history* para capturar y *Repeater* para reenviar modificado.

Resultado esperado general: ninguna manipulación del cliente marca un pedido como pagado ni dispara una recarga. El único camino es un webhook de Bold con firma válida **y** confirmado al consultar la API de Bold (mismo pedido, monto y moneda).

## 1. Checkout y precio

| # | Petición | Manipulación | Esperado |
|---|---|---|---|
| 1.1 | Server action `createTopUpOrderAction` (POST a `/recargas`, cabecera `Next-Action`) | Cambiar `packageId` por uno inactivo, de otra región o inexistente | Error «paquete no disponible»; no se crea pedido |
| 1.2 | Igual | Añadir campos `price`, `total`, `amount`, `discount` al cuerpo | Se ignoran: el total sale del paquete en la base de datos |
| 1.3 | Igual | `promoCode` inválido, vencido o agotado; repetir el mismo código en paralelo | Error; el uso se reserva en el servidor una sola vez |
| 1.4 | Igual | Reenviar con el mismo `idempotencyKey` | Devuelve el mismo pedido (no crea otro) |
| 1.5 | `previewPromoAction` | Código ajeno / fuerza bruta de códigos | Límite de intentos por IP; nunca aplica descuento al pedido por sí solo |
| 1.6 | `validatePlayerAction` | ID con letras, 50 dígitos, inyección (`' OR 1=1`, `<script>`) | Rechazo por validación; límite de 20 por minuto por IP |

## 2. Retorno de la pasarela (navegador)

| # | Petición | Manipulación | Esperado |
|---|---|---|---|
| 2.1 | `GET /pedido/{número}?t={token}&from=pago` | Añadir `status=APPROVED`, `paid=1`, `transaction_id=...` | El pedido sigue «Pendiente de pago»: el estado solo cambia por webhook o consulta a Bold |
| 2.2 | Igual | Recargar la página muchas veces | La consulta a Bold se limita a una cada 15 s por pedido |
| 2.3 | `resumePaymentAction` | Pedido ya pagado, expirado o de otro cliente | «Este pedido ya no admite pagos» / sin acceso |

## 3. Webhook de Bold `POST /api/webhooks/bold`

Captura un webhook real del sandbox de Bold (o arma uno con la forma de `tests/payment-flow.test.ts`).

| # | Manipulación | Esperado |
|---|---|---|
| 3.1 | Sin cabecera `x-bold-signature` | 401 |
| 3.2 | Firma de otro cuerpo / cambiar 1 byte del cuerpo (monto, referencia) | 401 |
| 3.3 | Firma válida (sandbox, llave vacía) con `SALE_APPROVED` para un pedido que **no** se pagó | 503 `not_confirmed`; el pedido sigue pendiente |
| 3.4 | Firma válida con `amount.total` distinto al cobrado | 503 (Bold no lo confirma) |
| 3.5 | Reenviar 2–10 veces el mismo webhook válido | 200 la primera; `duplicate: true` después; una sola recarga |
| 3.6 | `VOID_APPROVED` de un pedido pagado y aún no entregado | Pedido cancelado, entrega bloqueada, alerta al equipo |
| 3.7 | Cuerpo de más de 256 KB / JSON roto | 413 / 400 |
| 3.8 | Proveedor inexistente `POST /api/webhooks/otro` | 404 |
| 3.9 | Más de 120 peticiones/min desde una IP | 429 |

## 4. Webhook del proveedor de recargas `POST /api/webhooks/topup`

| # | Manipulación | Esperado |
|---|---|---|
| 4.1 | Sin `X-CentralOne-Signature` o con firma inválida | 401, sin cambios |
| 4.2 | Timestamp de más de 5 min | 401 |
| 4.3 | Firma válida pero `order.status=completed` inventado | La tienda consulta el pedido en la API del proveedor (`GET /orders/{id}`) y usa ese estado, no el del cuerpo |
| 4.4 | Reenvío del mismo evento | `duplicate: true` |

## 5. Acceso a pedidos (IDOR)

| # | Petición | Manipulación | Esperado |
|---|---|---|---|
| 5.1 | `GET /pedido/{número}` | Sin `?t=`, con token de otro pedido, con token truncado | 404 / «pedido no encontrado» |
| 5.2 | Igual, con sesión de B | Pedido de A sin token | Sin acceso |
| 5.3 | `trackOrderAction` (`/pedido`) | Número + correo incorrecto; números consecutivos | Mismo mensaje genérico; límite por IP |
| 5.4 | `GET/POST /api/orders/{número}/chat` | Cabecera `x-order-token` de otro pedido o sin sesión | 404 |
| 5.5 | `GET /api/orders/{número}/chat/file/{id}` | `id` de un adjunto de otro pedido | 404 |
| 5.6 | `GET /uploads/...` | `../`, rutas codificadas (`%2e%2e%2f`), extensiones no de imagen | 404 (los adjuntos del chat están en la base y solo salen por la ruta del chat del pedido) |

## 6. Panel del equipo

| # | Petición | Manipulación | Esperado |
|---|---|---|---|
| 6.1 | `GET /admin`, `/api/admin/*` sin la cookie de la puerta (`ADMIN_PATH`) | — | 404 |
| 6.2 | Con sesión de cliente | `/api/admin/export/pedidos`, `/api/admin/pulse`, server actions del panel (`orderAction`, `savePackageAction`, …) | 404 / sin permiso |
| 6.3 | Con sesión de SOPORTE | Acciones solo de admin (`saveSettingsAction`, `createStaffAction`, `savePackageAction`) | Rechazo |
| 6.4 | `orderAction` | Transición manual a `PAID` | Rechazo: ninguna transición manual lleva a «Pagado» |
| 6.5 | `orderAction` → reintentar entrega | Doble clic / 5 en paralelo | Un solo reintento; con Central One, espera de 15 min tras un fallo confirmado |
| 6.6 | Login `/acceso-equipo` | Fuerza bruta de contraseña y del código de 2 pasos | Límite: 10 intentos por IP y 6 por correo cada 15 min; 6 códigos cada 10 min |
| 6.7 | Server actions | Cambiar o quitar la cabecera `Origin` | Rechazo de Next.js (protección CSRF de server actions) |

## 7. Tareas programadas

| # | Petición | Manipulación | Esperado |
|---|---|---|---|
| 7.1 | `GET /api/cron/maintenance` | Sin `Authorization` o con un secreto incorrecto | 401 |

## 8. Registro de resultados

Por cada caso anota: petición enviada (sin secretos), respuesta, estado del pedido en el panel antes y después, y si se llamó al proveedor. Un caso solo se marca «superado» si se ejecutó.
