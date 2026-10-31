# VANTA Store

Tienda de productos digitales para Free Fire (recargas de diamantes por ID y cuentas), orientada a Colombia y preparada para LATAM.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · MySQL 8 · Prisma 6 · Zod · Vitest.

> **Para publicar la tienda sigue [DESPLIEGUE.md](DESPLIEGUE.md)** (servidor, dominio, correos, Bold, tareas programadas y respaldos). `npm run verificar:produccion` indica lo que falta.

---

## 1. Puesta en marcha (desarrollo)

```bash
npm install                   # el .env local ya está configurado (producción: deploy/.env.production)
```

Crea la base de datos en tu MySQL:

```sql
CREATE DATABASE vanta_store CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
```

```bash
npm run db:deploy             # aplica prisma/migrations
npm run db:seed               # administrador inicial (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD del .env)
npm run dev                   # http://localhost:3001
```

Panel: `http://localhost:3001/<ADMIN_PATH>` (ingresa con el administrador de la semilla y activa el 2FA).

Para probar compras sin cobros ni diamantes reales: Bold con llaves de prueba y `BOLD_TEST_MODE=true` (tarjeta de prueba Visa `4111 1111 1111 1111`). Con Bold en pruebas, los pedidos quedan marcados como prueba y RechargeGame los recibe en modo prueba (no gasta saldo; la entrega figura como «simulada»).

Comandos: `npm test` (pruebas unitarias) · `npm run lint` (tipos) · `npm run build` · `npm run db:studio`.

Pruebas del flujo pago → entrega (webhooks, montos, duplicados, reintentos) contra una base MySQL **de pruebas**; la API de Bold y el proveedor se simulan, no sale nada a internet:

```bash
mysql -e "CREATE DATABASE IF NOT EXISTS vanta_test"
DATABASE_URL=mysql://usuario:clave@localhost:3306/vanta_test npx prisma db push
TEST_DATABASE_URL=mysql://usuario:clave@localhost:3306/vanta_test npm test
```

Sin `TEST_DATABASE_URL` esas pruebas se omiten; solo corren si el nombre de la base contiene «test». Plan de pruebas manuales con Burp: `docs/plan-pruebas-burp.md`.

---

## 2. Variables de entorno

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `DATABASE_URL` | Sí | `mysql://usuario:clave@host:3306/vanta_store` |
| `AUTH_SECRET` | Sí en producción | 32+ caracteres aleatorios. Firma sesiones y tokens |
| `APP_URL` | Sí | URL pública sin barra final. Se usa en webhooks, retornos de pago, sitemap y correos |
| `PAYMENT_PROVIDER` | Sí | `bold` (vacío = nadie puede pagar) |
| `BOLD_API_KEY` / `BOLD_SECRET_KEY` / `BOLD_TEST_MODE` | Para Bold | Llave de identidad y secreta; `BOLD_TEST_MODE=true` con llaves de prueba |
| `TOPUP_PROVIDER` | Sí | `centralone` (o `rechargegame`) |
| `TOPUP_API_KEY` / `TOPUP_WEBHOOK_SECRET` / `TOPUP_TEST_MODE` | Para el proveedor | Central One: llave `co_live_…` y secreto del webhook. RechargeGame: `gv_live_…` y `whsec_…`. Modo prueba opcional |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_INSTAGRAM_URL` | No | Valores iniciales; luego se editan en `/admin/ajustes` |
| `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET`, `STORAGE_PUBLIC_URL` | En producción | Bucket S3 compatible (S3, R2, MinIO, Spaces). Vacío = disco local: `UPLOADS_DIR` (disco persistente en producción) o `public/uploads` |
| `NOTIFY_PROVIDER`, `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL` | Recomendado | `resend` envía correos transaccionales; `log` solo los registra |
| `CRON_SECRET` | Sí en producción | Protege `/api/cron/maintenance` |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Solo semilla | Administrador inicial |

Una integración permanece **desactivada** hasta que todas sus variables existen; `/admin/integraciones` muestra el estado, los valores enmascarados, las variables faltantes y las URL de webhook.

---

## 3. Arquitectura

```
src/
  app/
    (store)/          tienda pública: inicio, recargas, cuentas, ofertas, pedido, ayuda, legal, cuenta
    admin/            panel protegido por rol (ADMIN / SUPPORT)
    api/webhooks/[provider]   receptor único de webhooks (bold | topup)
    api/cron/maintenance      confirma pagos pendientes, expira pedidos, libera reservas, sondea entregas
    api/health                salud de la tienda y la base de datos (monitor de caídas)
    actions/          Server Actions (store, auth, admin) con Zod + rate limit + auditoría
  domain/             lógica pura y probada: precios/promociones, estados de orden, requisitos de publicación
  server/
    orders.ts         creación idempotente, confirmación de pago, entrega, reintentos, expiración
    catalog.ts        consultas de catálogo con precios calculados desde la BD
    integrations/
      payments/       PaymentProvider + adaptador Bold (links de pago) + verificación de firmas
      topup/          TopUpProvider + adaptador RechargeGame
      status.ts       estado de integraciones para el panel
    storage.ts        imágenes en disco local o S3 (firma SigV4 propia)
    notifications.ts  correos transaccionales idempotentes
  lib/                auth (sesiones en BD + cookie httpOnly), scrypt, rate limit, env, validación
prisma/               schema MySQL, migraciones y semilla (administrador + ajustes base)
tests/                Vitest
```

### Flujo de una recarga

1. Región → 2. Paquete → 3. ID de jugador (el proveedor confirma apodo y región; si la cuenta es de otra región activa, la tienda cambia sola) → 4. Medio de pago → 5. Resumen
6. **Orden creada** en el servidor (precio recalculado, clave de idempotencia UUID) → redirección a la pasarela
7. **Webhook firmado** → verificación de firma → consulta de la transacción a la API de la pasarela → comprobación de monto y moneda → `PAID` mediante `UPDATE … WHERE status = PENDING_PAYMENT` (solo el primer evento gana)
8. `Delivery` con `orderId` único (imposible entregar dos veces) → `createTopUp` + `processDelivery` con clave idempotente
9. Estado `DELIVERED` **solo** cuando el proveedor confirma (`DELIVERY_FAILED` si falla; el panel puede reintentar de forma segura)
10. Notificación al cliente (una vez por plantilla y pedido)

El navegador nunca declara un pago: el resultado llega únicamente por webhook verificado o por consulta directa a la pasarela («Conciliar» en el panel). Ningún botón del panel marca un pedido como pagado.

### Códigos promocionales (ofertas especiales)

Las ofertas se manejan solo con códigos que creas en `/admin/codigos`: porcentaje (con tope opcional) o valor fijo, alcance (todo, solo recargas o solo cuentas), compra mínima, vigencia, usos totales y usos por correo. El cliente los escribe en un campo plegable del checkout.

- El descuento se valida y calcula en el servidor con el precio de la BD; el navegador nunca envía montos.
- El uso se reserva al crear el pedido con un `UPDATE … WHERE uses < maxUses` atómico (probado: 3 compras simultáneas con un código de 1 uso → 1 pedido).
- Si el pedido se cancela o expira sin pago, el uso se devuelve; al confirmarse el pago queda definitivo.
- Códigos inexistentes, inactivos o vencidos reciben el mismo mensaje genérico, y los intentos tienen límite por IP.

### Flujo de una cuenta

Reserva atómica de la unidad (`UPDATE … WHERE status = PUBLISHED`) por 20 min → pago verificado → `SOLD` → `PROCESSING` → se abre el **chat de entrega** del pedido y el equipo entrega los datos por ahí (`/admin/chats`) → «Marcar entregada». Si la reserva se perdió antes del pago, el pedido pasa a `REFUND_REQUESTED`. Para publicar, el panel exige procedencia registrada, autorización comercial confirmada, inventario verificado, al menos una imagen y cero reclamaciones abiertas. Las reclamaciones públicas permiten suspender y retirar publicaciones.

### Acceso del equipo (panel oculto + 2FA)

- El panel no existe en `/admin` para quien no conozca la **dirección secreta** `/<ADMIN_PATH>`: responde «página no encontrada» (también `/api/admin`). Al entrar por la dirección secreta queda una cookie firmada de 30 días.
- Inicio de sesión del equipo solo ahí: contraseña + **código de app de autenticación (TOTP)**. La primera vez se configura escaneando un QR y se entregan 10 códigos de recuperación de un solo uso. El equipo no puede entrar por /ingresar, Google ni código por correo.
- Secretos 2FA cifrados (AES-256-GCM), códigos de recuperación guardados como HMAC, protección contra reutilizar un código y límites de intentos.
- Panel → Mi seguridad: estado del 2FA, regenerar códigos y la dirección secreta. Panel → Usuarios: restablecer el 2FA de otro miembro.
- Emergencia (perdiste celular y códigos): `npm run admin:2fa-reset -- correo@ejemplo.com` en el servidor.

### Acceso de clientes

- **Código por correo** (pestaña por defecto en /ingresar): 6 dígitos, vence en 10 min, 5 intentos, un minuto entre envíos, solo se guarda su HMAC. Si el correo no tiene cuenta, se crea al verificar.
- **Google** (OAuth 2.0 + OpenID Connect, PKCE, `state` y `nonce`, cookie temporal firmada). El botón aparece solo con `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`; la URI de redirección se muestra en Panel → Integraciones. Las cuentas del equipo no pueden entrar con Google ni con código.
- **Contraseña** con verificación del correo por código al registrarse. Quien entró con Google o código puede crear una contraseña en Mi cuenta.
- Al verificar el correo (código, Google o enlace de recuperación) las compras hechas como invitado con ese correo pasan a la cuenta.

### Correos

Proveedor `resend` o `smtp` (Gmail/Outlook con contraseña de aplicación). Todas las plantillas son HTML con la marca de la tienda y versión de texto: códigos, recuperación de contraseña, bienvenida, cada estado del pedido, aviso de mensaje en el chat (sin su contenido, máx. 1 cada 15 min), respuestas de soporte y avisos al equipo (cuenta vendida, nueva solicitud) al correo de soporte de Ajustes. **Panel → Correos** muestra el estado, vistas previas, envío de prueba e historial (sin guardar el contenido).

### Chat de entrega de cuentas

- Se abre solo en pedidos de cuentas pagados; sigue disponible 7 días después de la entrega. Las recargas de diamantes no usan chat.
- El comprador lo ve en la página de su pedido (token de seguimiento o su sesión); el equipo responde desde `/admin/chats` con respuestas rápidas.
- Mensajes cifrados en reposo con AES-256-GCM (`DATA_ENCRYPTION_KEY`, o derivada de `AUTH_SECRET`). **No cambies la clave** después de empezar a vender.
- Sondeo cada 3 s (15 s con la pestaña oculta), límite de 15 mensajes/min por comprador, máximo 2.000 caracteres.

### Panel de administración

| Sección | Para qué |
|---|---|
| Resumen | Ingresos por periodo (hoy, 7, 30, 90 días) con comparación, gráfico diario, lo más vendido y tareas pendientes |
| Pedidos | Filtros por estado, tipo, fechas y búsqueda; **exportar CSV** con los mismos filtros |
| Chats de entrega | Bandeja de pedidos de cuentas con chat, «Por entregar» y entrega en un clic |
| Clientes | Compradores agrupados por correo: compras, gasto, recurrencia, historial y soporte; exportar CSV |
| Soporte | Responder solicitudes por correo desde el panel (con historial), estados y accesos a correo/WhatsApp |
| Correos | Estado del envío, vistas previas de todas las plantillas, correo de prueba e historial |
| Auditoría | Acciones del equipo por categoría, con paginación, y webhooks recibidos |

El menú muestra pendientes en vivo (cada 20 s), el título de la pestaña lleva el número de pendientes y suena un aviso cuando llega un mensaje o una cuenta por entregar.

---

## 4. Conectar integraciones reales

**Bold (pasarela elegida)** — integrado con la API de links de pago (`server/integrations/payments/bold.ts`).
1. Llaves de identidad y secreta del panel de Bold → `BOLD_API_KEY`, `BOLD_SECRET_KEY` (con llaves de prueba, `BOLD_TEST_MODE=true`).
2. Webhook en Bold: `https://TU_DOMINIO/api/webhooks/bold`. Se valida la firma `x-bold-signature` (HMAC-SHA256 del cuerpo en Base64).
3. `PAYMENT_PROVIDER=bold`. Si el webhook se demora, la tienda consulta el link al volver el cliente y en el mantenimiento programado.
Mientras `PAYMENT_PROVIDER` esté vacío nadie puede comprar.

**Proveedor de recargas: Central One** (`topup/centralone.ts`, lógica pura en `topup/centralone-core.ts`)
1. En el portal de Central One → Integración → crea una llave con los permisos `catalog:read`, `balance:read`, `orders:read` y `orders:write` (NO marques `codes:read`: las recargas directas no tienen códigos).
2. En el `.env` del servidor: `TOPUP_PROVIDER=centralone` y `TOPUP_API_KEY=co_live_…` (nunca en el frontend). Reinicia.
3. Panel → **Proveedor**: muestra saldo disponible (USD), sincroniza el catálogo (cada 15 min con el cron) y permite activar regiones. Los paquetes que ya tenías se vinculan solos por cantidad de diamantes dentro de su región (o con productos «GLOBAL»).
4. ID del jugador: se comprueba con `POST /player/validate` contra un paquete de cada región activa (30 consultas/min por cuenta; se guarda 10 min). Si Central One no puede comprobarlo, se vende con la confirmación del cliente.
5. Al confirmarse el pago se crea `POST /orders` con `Idempotency-Key` = clave de la entrega (reintentar nunca cobra dos veces); el estado se consulta con `GET /orders/{id}`. Central One no tiene modo prueba: los pagos de prueba (o `TOPUP_TEST_MODE=true`) se simulan sin llamar a la API.
6. Webhook opcional: Integración → Webhooks → `https://TU_DOMINIO/api/webhooks/topup`, eventos `order.delivered` y `order.failed`; copia el secreto en `TOPUP_WEBHOOK_SECRET` (firma `X-CentralOne-Signature`). Sin webhook el estado se consulta al abrir el pedido y en el cron.

**Proveedor de recargas: RechargeGame** (`topup/rechargegame.ts`, alternativa)
1. `TOPUP_PROVIDER=rechargegame` y `TOPUP_API_KEY=gv_live_…` en el `.env` del servidor (nunca en el frontend).
2. Panel → **Proveedor**: muestra cuenta y saldo (USDT), sincroniza el catálogo de Free Fire (cada 3 h solo, con el cron) y permite **activar regiones**. Activar una región crea sus paquetes con precio sugerido = costo × tasa (pesos por USDT) + margen, redondeado a $500; luego se ajustan en Paquetes, donde se ve el costo y el margen real de cada uno.
3. Cada paquete apunta a un `product_key` del proveedor; la cantidad debe coincidir con lo que entrega el proveedor.
4. Al confirmarse el pago se crea `POST /v1/orders` con `buyer_ref` = clave de la entrega (reintentos sin cobro doble). Pagos de prueba → pedido `test: true` (gratis, sin entrega). `TOPUP_TEST_MODE=true` fuerza prueba siempre.
5. Protecciones: no compra solo si el costo supera lo pagado; si falta saldo o el paquete se agota, la entrega se reintenta sola cada 5 min (hasta 6 veces) con la misma referencia.
6. Webhook opcional (al publicar): en el panel del proveedor → Profile → Webhook → `https://TU_DOMINIO/api/webhooks/topup`; copia el secreto `whsec_…` en `TOPUP_WEBHOOK_SECRET` (firma Standard Webhooks). Sin webhook el estado se consulta al abrir el pedido y en el cron.

`src/server/integrations/topup/http.ts` queda como contrato REST genérico para otro distribuidor. Úsalo solo con proveedores cuyas condiciones autoricen la reventa.

**Otra pasarela:** implementa la interfaz `PaymentProvider` (`payments/types.ts`) y regístrala en `payments/index.ts`.

---

## 5. Seguridad implementada

- Validación Zod en todas las entradas; rate limiting en login, registro, validación de ID, creación de órdenes, seguimiento, soporte, reclamaciones y webhooks.
- Contraseñas con scrypt; sesiones aleatorias guardadas como HMAC en BD; cookie `httpOnly`, `SameSite=Lax`, `Secure` en producción; tiempo constante en login con usuario inexistente.
- CSRF: Server Actions con verificación de origen de Next; sin endpoints mutables basados en cookies fuera de ellas. Webhooks autenticados por firma.
- Idempotencia: clave por checkout, `WebhookEvent (proveedor, id)` único, transiciones condicionales, `Delivery.orderId` único, notificaciones únicas por plantilla.
- Control de inventario concurrente probado: 4 compras simultáneas de la misma cuenta → 1 reserva.
- Content-Security-Policy con nonce por solicitud (solo se ejecutan scripts propios), más COOP/CORP, HSTS, X-Frame-Options, nosniff, Referrer-Policy y Permissions-Policy.
- Sesiones del equipo de 12 h (clientes 14 días); cambiar rol o deshabilitar un usuario cierra sus sesiones.
- Payloads de webhooks guardados con campos sensibles redactados; secretos solo en el servidor (`server-only`) y enmascarados en el panel.
- Seguimiento de pedidos con token secreto; búsqueda por número + correo sin revelar si un pedido existe.
- Registro de auditoría de toda acción del equipo.
- No se almacenan datos de tarjetas ni se piden contraseñas de redes sociales.
- Chat de entrega cifrado en reposo; su contenido nunca va a la auditoría ni a los logs.
- Exportaciones CSV solo para administradores, auditadas y protegidas contra inyección de fórmulas.
- Recuperación de contraseña con enlace de un solo uso (30 min), token guardado como HMAC, respuesta idéntica exista o no la cuenta, y cierre de todas las sesiones al cambiarla.
- Límites anti-abuso por IP usando el valor que agrega el proxy (último de `X-Forwarded-For`, o `TRUSTED_IP_HEADER`), para que no se puedan saltar falsificando la cabecera.

---

## 6. Producción

La guía completa está en [DESPLIEGUE.md](DESPLIEGUE.md): variables, importación de la configuración (`npm run config:exportar` / `config:importar`), correos, Bold, Central One, Google, tareas programadas, respaldos y monitoreo (`/api/health` y avisos de errores por correo). La instalación del servidor (PM2 + nginx + despliegue automático) está en [deploy/LEEME-VPS.md](deploy/LEEME-VPS.md).

Antes de anunciar, `npm run verificar:produccion` debe terminar sin bloqueantes. Notas:
- Usa **una sola instancia**: límites de intentos, presencia del chat y avisos agrupados viven en memoria. Si algún día necesitas varias réplicas, muévelos a Redis/Upstash.
- Con Cloudflare delante, define `TRUSTED_IP_HEADER=cf-connecting-ip`.
- Los textos de `src/content/legal.tsx` son una base: revisión jurídica (Ley 1480 de 2011, Ley 1581 de 2012) y facturación electrónica DIAN con tu contador.

### Dependencias

`npm audit` reporta alertas en `prisma` (CLI) por `deepmerge-ts`: solo afectan a la herramienta de migraciones en desarrollo, no al servidor de la tienda. Se resuelven al migrar a Prisma 7. PostCSS se fijó en `^8.5.28` con `overrides`.

### Limitación conocida
Las páginas con 404 dentro de la tienda (por ejemplo, un seguimiento con token incorrecto) se transmiten con `loading.tsx`, por lo que responden HTTP 200 con el contenido de «no encontrado» y `noindex`. No exponen datos del pedido. La sección de cuentas oculta sí responde un 404 real (se decide en el layout de la tienda).
