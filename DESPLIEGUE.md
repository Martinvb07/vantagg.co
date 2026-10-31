# Publicar la tienda (producción)

La tienda corre en un VPS con **PM2 + nginx** y se despliega sola en cada push a `main` (`.github/workflows/deploy.yml`). La instalación del servidor paso a paso está en **[deploy/LEEME-VPS.md](deploy/LEEME-VPS.md)**. Esta guía cubre lo demás: configuración, servicios externos, monitoreo y lo que hay que revisar antes de anunciar.

Al final, `npm run verificar:produccion` (en el servidor) debe decir **«Sin bloqueantes»**. También se puede correr desde GitHub con el workflow «Verificar producción».

**Una sola instancia:** algunas funciones (límites de intentos, «escribiendo…» del chat, avisos agrupados) viven en la memoria del proceso. PM2 corre la tienda con un único proceso; no la escales a varias instancias.

---

## 1. Variables de producción

Viven en el `.env` del servidor (`chmod 600`, nunca en git). Las que importan:

- **Secretos:** `AUTH_SECRET`, `DATA_ENCRYPTION_KEY`, `CRON_SECRET`, `ADMIN_PATH` (dirección secreta del panel).
- **Bold:** `PAYMENT_PROVIDER=bold`, `BOLD_API_KEY`, `BOLD_SECRET_KEY` y `BOLD_TEST_MODE` vacío (cobros reales).
- **Central One:** `TOPUP_PROVIDER=centralone`, `TOPUP_API_KEY` (`co_live_…`), `TOPUP_WEBHOOK_SECRET` (opcional, ver abajo) y `TOPUP_TEST_MODE` vacío.
- **Correos:** `NOTIFY_PROVIDER=resend`, `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL` con tu dominio.
- **Google:** las credenciales del cliente OAuth.
- **Imágenes:** `UPLOADS_DIR` (disco persistente) o, para un bucket (Cloudflare R2/S3), `STORAGE_ENDPOINT`, `STORAGE_REGION=auto`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET` y `STORAGE_PUBLIC_URL`.

Después de cambiar el `.env`, reinicia la tienda (`pm2 restart vanta`) para que lo lea.

---

## 2. Llevar tu configuración (desde tu PC)

```bash
npm run config:exportar
```

Crea `exportacion/config-AAAAMMDD-HHMM/` con ajustes, paquetes (con tus precios), banners y sus imágenes. Cópiala al servidor (por ejemplo con `scp`; no está en git) y, en la carpeta de la tienda:

```bash
npm run config:importar -- /ruta/a/config-AAAAMMDD-HHMM              # simula
npm run config:importar -- /ruta/a/config-AAAAMMDD-HHMM --confirmar  # aplica
```

No publiques esa carpeta: tiene llaves y correos de la tienda.

---

## 3. Servicios externos

**Correos (Resend).** En resend.com → Domains → **Add domain** → `vantagg.co`. Resend muestra 3 o 4 registros (DKIM, SPF del subdominio `send` y, recomendado, DMARC): créalos tal cual en el DNS del dominio (en «Nombre» va solo la parte antes de `.vantagg.co`). Cuando diga *Verified*, prueba desde Panel → Correos → «Enviar prueba» o con el workflow «Probar envío de correo».

**Bold.** Panel de Bold → Integraciones:
- Llaves de identidad y secreta en el `.env`.
- Webhook: `https://vantagg.co/api/webhooks/bold` (ventas aprobadas, rechazadas y anulaciones).
- Para probar: llaves de prueba y `BOLD_TEST_MODE=true` (el checkout muestra «Modo pruebas» y no cobra; el panel avisa en rojo mientras esté activo). Para vender: llaves reales y `BOLD_TEST_MODE` vacío.
- Si el webhook se demora, la tienda consulta el estado del pago sola (al volver el cliente y cada pocos minutos).

**Central One** (proveedor de las recargas).
- **Saldo:** recárgalo en el portal de Central One. Sin saldo, las compras quedan en «error de entrega» (te llega un aviso) y se reintentan solas cuando recargas.
- **Llave:** `co_live_…` con los permisos `catalog:read`, `balance:read`, `orders:read` y `orders:write`.
- **Webhook (opcional, recomendado):** en el portal crea un webhook a `https://vantagg.co/api/webhooks/topup` y copia su secreto en `TOPUP_WEBHOOK_SECRET`. Con él, el pedido pasa a «Entregado» en segundos; sin él, la tienda consulta cada 2 minutos.
- **Tarjetas y pases:** en Panel → Paquetes aparece «Agregar tarjetas y pases» cuando Central One los vende en la región; se crean con un precio sugerido que puedes cambiar ahí mismo.
- El workflow «Probar Central One» revisa la llave, el catálogo y los paquetes vinculados sin comprar nada.

**Google.** Google Cloud Console → Credenciales → tu cliente OAuth:
- URI de redirección autorizada: `https://vantagg.co/api/auth/google/callback`.
- Origen autorizado: `https://vantagg.co`.
- Pantalla de consentimiento → **Publicar app** («En producción»). Si no, solo pueden ingresar los usuarios de prueba.

---

## 4. Tareas programadas y respaldos

Están en [deploy/LEEME-VPS.md](deploy/LEEME-VPS.md) (sección «Cron y respaldos»):

- **Cada 2 minutos — mantenimiento.** Confirma pagos pendientes, envía el recordatorio de pago, consulta y reintenta entregas, vence pedidos sin pago y actualiza el catálogo del proveedor. **Sin esto, nada de eso pasa.**
- **Cada día — respaldo** (`deploy/respaldo-vps.sh`). Copia la base de datos y las imágenes; se guardan 14 días en `~/respaldos-tienda`. Descarga una copia a otro lugar de vez en cuando: si el VPS se daña, los respaldos se pierden con él.

Para restaurar un respaldo de la base:

```bash
gunzip -c db-AAAAMMDD-HHMM.sql.gz | mysql --defaults-extra-file=~/.my-vanta.cnf vanta_store
```

---

## 5. Monitoreo

- **Caídas:** en uptimerobot.com (gratis) crea un monitor HTTPS a `https://vantagg.co/api/health`. Responde 200 si la tienda y la base funcionan, 503 si no.
- **Errores:** si un cliente ve una página de error, te llega un correo «Error en la tienda», como máximo uno cada 30 minutos por tipo de error.
- **Revisión completa:** el workflow «Verificar producción» revisa configuración, rutas ocultas, cabeceras de seguridad, firmas de los webhooks, certificados y puertos.

---

## 6. Panel y datos de la tienda

1. Entra por `https://vantagg.co/<ADMIN_PATH>` con el administrador inicial y la contraseña temporal de `SEED_ADMIN_PASSWORD`.
2. Activa la verificación en dos pasos y guarda los códigos de respaldo.
3. Cambia la contraseña en Panel → Mi seguridad y **borra `SEED_ADMIN_PASSWORD`** del `.env`.
4. **Panel → Ajustes:**
   - Razón social, NIT y dirección: el Estatuto del Consumidor (Ley 1480) exige mostrarlos.
   - WhatsApp de soporte y correo para avisos internos.
   - «Sección de cuentas»: en *Automático* aparece sola cuando publicas la primera cuenta.
5. Comprueba con `npm run verificar:produccion`: debe terminar en **«Sin bloqueantes»**.

---

## 7. Antes de anunciar

- [ ] Saldo en Central One.
- [ ] Compra real pequeña de punta a punta: 100 diamantes a tu propio ID, con Bold en modo real.
- [ ] Llega el correo de confirmación y el de entrega.
- [ ] Respuesta a una solicitud de soporte de prueba desde Panel → Soporte.
- [ ] Google Search Console: agrega el dominio y envía `https://vantagg.co/sitemap.xml`.

## Legal y negocio (con tu contador o abogado)

- **Facturación electrónica de la DIAN**, si estás obligado.
- **Textos legales:** las páginas de `/legal` son una base. Que un abogado las revise (retracto, reversión del pago, datos personales) y actualiza la fecha de vigencia en `src/content/legal.tsx`.
- **Venta de cuentas de Free Fire:** los términos de Garena no permiten vender cuentas. Decide si las ofreces; la sección se puede apagar en Ajustes.

## Actualizar la tienda

Cada push a `main` se despliega solo: GitHub Actions revisa tipos, pruebas y build, y en el VPS actualiza el código, aplica las migraciones, construye y recarga PM2 (si la tienda no responde, vuelve a la versión anterior).
