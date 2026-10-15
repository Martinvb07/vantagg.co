#!/bin/sh
# Copia de seguridad diaria: base de datos + imágenes subidas. Guarda 14 días.
# Uso (desde la carpeta deploy/):  sh respaldo.sh      ·  Programado: ver DESPLIEGUE.md (paso 5)
set -eu
cd "$(dirname "$0")"
DEST="${RESPALDOS_DIR:-$HOME/respaldos-tienda}"
FECHA="$(date +%Y%m%d-%H%M)"
mkdir -p "$DEST"

# Base de datos (consistente, sin bloquear la tienda)
docker compose --env-file .env.production exec -T db sh -c 'exec mysqldump --single-transaction --routines -u root -p"$MYSQL_ROOT_PASSWORD" vanta_store' | gzip > "$DEST/db-$FECHA.sql.gz"

# Imágenes subidas desde el panel
docker compose --env-file .env.production exec -T app tar -czf - -C /data uploads > "$DEST/uploads-$FECHA.tar.gz"

# Limpieza de copias con más de 14 días
find "$DEST" -name 'db-*.sql.gz' -mtime +14 -delete
find "$DEST" -name 'uploads-*.tar.gz' -mtime +14 -delete
echo "Respaldo listo en $DEST ($FECHA)"
