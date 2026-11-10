#!/bin/sh
# Mantenimiento automático de vantagg.co. Lo llama cron cada 2 minutos (lo instala deploy/tareas-programadas.sh).
# Vence los pedidos sin pagar, borra los cancelados, envía los correos automáticos, sincroniza el catálogo, etc.
# La llave CRON_SECRET se lee de .env en cada llamada: no queda escrita en el crontab ni visible en `ps`.
# El resultado de la última corrida (solo conteos) queda en logs/mantenimiento-ultimo.json; los errores, en
# logs/mantenimiento-errores.log (últimas 200 líneas).
set -eu
APP="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP"
mkdir -p logs
ERR="logs/mantenimiento-errores.log"

fallo() {
  echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC') $1" >> "$ERR"
  tail -n 200 "$ERR" > "$ERR.tmp" 2>/dev/null && mv -f "$ERR.tmp" "$ERR"
  exit 1
}

s="$(grep -E '^CRON_SECRET=' .env 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d "\"'" || true)"
[ -n "$s" ] || fallo "falta CRON_SECRET en .env"

# Una sola corrida a la vez: si la anterior sigue (p. ej. sincronizando el catálogo), esta se salta.
exec 9> "$APP/logs/.mantenimiento.lock"
if command -v flock >/dev/null 2>&1; then flock -n 9 || exit 0; fi

# La cabecera con la llave va por la entrada estándar (printf es interno del shell: no aparece en `ps`).
salida="$(printf 'header = "Authorization: Bearer %s"\n' "$s" | curl -sS -K - -m 110 \
  -H "Host: vantagg.co" -H "X-Forwarded-Proto: https" \
  -o logs/mantenimiento-ultimo.json.tmp -w '%{http_code}' \
  http://127.0.0.1:3020/api/cron/maintenance 2>&1)" || fallo "no respondió: $(printf '%s' "$salida" | tr '\n' ' ' | tail -c 200)"
[ "$salida" = "200" ] || fallo "respondió HTTP $salida"
mv -f logs/mantenimiento-ultimo.json.tmp logs/mantenimiento-ultimo.json
