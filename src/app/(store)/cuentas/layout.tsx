import { notFound } from "next/navigation";
import { accountsVisible } from "@/server/catalog";

/** Sección de cuentas: si está oculta (sin cuentas publicadas o desactivada en Ajustes), no existe para el público. */
export default async function AccountsLayout({ children }: { children: React.ReactNode }) {
  if (!(await accountsVisible())) notFound();
  return children;
}
