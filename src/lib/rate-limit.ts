/**
 * Limitador de tasa en memoria (ventana deslizante).
 * Suficiente para una sola instancia. Con varias réplicas, reemplazar el
 * almacenamiento por Redis/Upstash manteniendo la misma firma.
 */
type Bucket = { hits: number[]; windowMs: number };
const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSec: number };

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  if (now - lastSweep > 60_000) sweep(now);
  const bucket = buckets.get(key) ?? { hits: [], windowMs };
  bucket.windowMs = Math.max(bucket.windowMs, windowMs);
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    const retryAfterSec = Math.ceil((windowMs - (now - bucket.hits[0])) / 1000);
    buckets.set(key, bucket);
    return { ok: false, remaining: 0, retryAfterSec };
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { ok: true, remaining: limit - bucket.hits.length, retryAfterSec: 0 };
}

/** Borra solo los contadores cuya ventana ya pasó por completo (cada uno con la suya). */
function sweep(now: number) {
  lastSweep = now;
  for (const [k, b] of buckets) {
    if (b.hits.every((t) => now - t >= b.windowMs)) buckets.delete(k);
  }
}

export function _resetRateLimits() {
  buckets.clear();
}
