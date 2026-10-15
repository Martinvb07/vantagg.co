/**
 * CSV para Excel en español (separador ";" y BOM UTF-8 para tildes).
 * Los textos que empiezan por = + - @ se anteponen con ' para que Excel
 * no los ejecute como fórmulas (inyección CSV).
 */
type Cell = string | number | boolean | Date | null | undefined;

function cell(v: Cell): string {
  if (v == null) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  let s = v instanceof Date ? v.toISOString().replace("T", " ").slice(0, 19) : v;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
}

export function csvResponse(filename: string, body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
