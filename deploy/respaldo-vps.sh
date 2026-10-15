#!/bin/sh
# Copia de seguridad diaria en el VPS (PM2 + MySQL instalado): base de datos + imágenes subidas. Guarda 14 días.
# Uso:  sh deploy/respaldo-vps.sh      ·  Programado con cron (ver deploy/LEEME-VPS.md)
# Lee usuario y contraseña de MySQL de ~/.my-vanta.cnf (no de ~/.my.cnf, para no cambiar el usuario de `mysql`
# en los demás proyectos del servidor); así no quedan en el historial ni en `ps`.
set -eu
CNF="${MYSQL_CNF:-$HOME/.my-vanta.cnf}"
DEST="${RESPALDOS_DIR:-$HOME/respaldos-tienda}"
UPLOADS="${UPLOADS_DIR:-/var/lib/vanta/uploads}"
FECHA="$(date +%Y%m%d-%H%M)"
mkdir -p "$DEST"

# Base de datos (consistente, sin bloquear la tienda)
mysqldump --defaults-extra-file="$CNF" --single-transaction --routines --no-tablespaces vanta_store | gzip > "$DEST/db-$FECHA.sql.gz"

# Imágenes subidas desde el panel
[ -d "$UPLOADS" ] && tar -czf "$DEST/uploads-$FECHA.tar.gz" -C "$(dirname "$UPLOADS")" "$(basename "$UPLOADS")"

# Limpieza de copias con más de 14 días
find "$DEST" -name 'db-*.sql.gz' -mtime +14 -delete
find "$DEST" -name 'uploads-*.tar.gz' -mtime +14 -delete
echo "Respaldo listo en $DEST ($FECHA)"
