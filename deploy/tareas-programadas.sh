#!/bin/sh
# Asegura las tareas programadas de vantagg.co en el crontab del usuario del VPS. Lo corre cada deploy.
#   - mantenimiento cada 2 min (deploy/cron-mantenimiento.sh)
#   - respaldo diario a las 3:30 (deploy/respaldo-vps.sh), si existe ~/.my-vanta.cnf
# Solo AGREGA las que falten: no toca ni reordena las de otros proyectos del servidor. Antes de cambiar algo guarda
# una copia del crontab en ~/respaldos-tienda (permiso 600). Nunca imprime el contenido del crontab (puede tener llaves).
set -eu
APP="$(cd "$(dirname "$0")/.." && pwd)"
command -v crontab >/dev/null 2>&1 || { echo "✖ Este servidor no tiene crontab."; exit 1; }

actual="$(crontab -l 2>/dev/null || true)"
activas="$(printf '%s\n' "$actual" | grep -v '^[[:space:]]*#' || true)"
agregar=""

# Mantenimiento de ESTA tienda (puerto 3020 / vantagg.co). Las líneas de otras tiendas (otro puerto u otro dominio) no cuentan.
if printf '%s\n' "$activas" | grep -qE "$APP/deploy/cron-mantenimiento\.sh|127\.0\.0\.1:3020/api/cron/maintenance|vantagg\.co/api/cron/maintenance"; then
  echo "✔ Mantenimiento de vantagg.co ya programado (cada 2 min)."
else
  agregar="$agregar*/2 * * * * sh $APP/deploy/cron-mantenimiento.sh >/dev/null 2>&1
"
  echo "➜ Mantenimiento de vantagg.co: faltaba, se agrega (cada 2 min)."
fi

if printf '%s\n' "$activas" | grep -q "respaldo-vps\.sh"; then
  echo "✔ Respaldo diario ya programado."
elif [ -s "$HOME/.my-vanta.cnf" ]; then
  agregar="${agregar}30 3 * * * sh $APP/deploy/respaldo-vps.sh >> $HOME/respaldo.log 2>&1
"
  echo "➜ Respaldo diario (3:30): faltaba, se agrega."
else
  echo "⚠ Respaldo diario no programado: falta ~/.my-vanta.cnf (ver deploy/LEEME-VPS.md)."
fi

[ -n "$agregar" ] || exit 0

dest="${RESPALDOS_DIR:-$HOME/respaldos-tienda}"
mkdir -p "$dest"
copia="$dest/crontab-antes-$(date +%Y%m%d-%H%M%S).txt"
( umask 077; printf '%s\n' "$actual" > "$copia" )
if [ -n "$actual" ]; then
  printf '%s\n%s' "$actual" "$agregar" | crontab -
else
  printf '%s' "$agregar" | crontab -
fi

# Comprobación: las líneas de antes siguen y las nuevas quedaron.
despues="$(crontab -l 2>/dev/null || true)"
antes_n="$(printf '%s\n' "$actual" | grep -c . || true)"
despues_n="$(printf '%s\n' "$despues" | grep -c . || true)"
nuevas_n="$(printf '%s' "$agregar" | grep -c . || true)"
if [ "$despues_n" -ne $((antes_n + nuevas_n)) ]; then
  echo "✖ El crontab no quedó como se esperaba: se restaura la copia."
  crontab "$copia"
  exit 1
fi
echo "✔ Tareas programadas guardadas ($nuevas_n nueva(s); las otras $antes_n línea(s) quedaron igual). Copia previa: $(basename "$copia")"
