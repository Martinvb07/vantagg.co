# Imagen de producción de la tienda: Next.js (servidor autónomo) + Prisma/MySQL.
# Construir:  docker build -t vanta-store .
# Ejecutar:   docker run -d --name vanta -p 3000:3000 --env-file .env.production -v vanta-uploads:/data/uploads vanta-store
# Al arrancar aplica las migraciones pendientes y luego inicia el servidor. Ver DESPLIEGUE.md.

FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencias (se cachean mientras package-lock.json no cambie)
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Compilación
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_OUTPUT=standalone
RUN npx prisma generate && npx next build

# Ejecución (sin código fuente ni secretos dentro de la imagen)
FROM base AS run
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 UPLOADS_DIR=/data/uploads
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
# node_modules completo: lo usan `prisma migrate deploy` y los scripts de verificación e importación.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
RUN mkdir -p /data/uploads && chown -R node:node /data /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=60s --timeout=5s --start-period=40s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
