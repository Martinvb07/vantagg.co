"use client";

import { useEffect, useState } from "react";

/**
 * Empujón para navegaciones que se quedan en pausa.
 *
 * Con el React que trae Next 15.5, una navegación que no sale de un Suspense ya mostrado (la misma página con otros
 * parámetros, p. ej. /cuenta → /cuenta?seccion=perfil, o los filtros de /cuentas) a veces no se aplica aunque el
 * servidor ya respondió: React la deja en pausa hasta que ocurra cualquier otra actualización en la página (por eso se
 * destrababa al desplazar la pantalla). Mientras haya una navegación en curso, este hook hace una actualización mínima
 * cada 200 ms y React vuelve a intentar la navegación pendiente. Si el servidor aún no respondió, el intento vuelve a
 * esperar sin que se note nada.
 */
export function useNavNudge(active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setTick((n) => (n + 1) % 1000), 200);
    return () => clearInterval(t);
  }, [active]);
}

/** Igual que `useNavNudge`, como componente: solo se vuelve a dibujar él (no el componente que lo usa). */
export function NavNudge({ active }: { active: boolean }) {
  useNavNudge(active);
  return null;
}
