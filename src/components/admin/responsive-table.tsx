"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Contenedor de las tablas del panel. En celular la tabla se muestra como tarjetas (ver `.admin-table`
 * en globals.css): cada celda lleva el título de su columna, que se copia aquí de los encabezados.
 */
export function ResponsiveTable({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // Sin dependencias a propósito: las filas cambian con cada navegación o filtro del servidor.
  useEffect(() => {
    const table = ref.current?.querySelector("table");
    if (!table) return;
    const labels = Array.from(table.querySelectorAll("thead th"), (th) => th.textContent?.trim() ?? "");
    for (const row of Array.from(table.querySelectorAll("tbody tr"))) {
      let col = 0;
      for (const cell of Array.from((row as HTMLTableRowElement).cells)) {
        cell.setAttribute("data-label", labels[col] ?? "");
        col += cell.colSpan || 1;
      }
    }
  });
  return (
    // tabIndex: en pantallas medianas la tabla se desplaza y debe poder hacerse con el teclado.
    <div ref={ref} tabIndex={0} className={className}>
      {children}
    </div>
  );
}
