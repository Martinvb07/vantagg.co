/** Aviso de tratamiento de datos junto a los formularios (Ley 1581 de 2012: autorización informada). */
export function DataNotice({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[12px] leading-relaxed text-fg-subtle ${className}`}>
      Al enviar autorizas el tratamiento de tus datos solo para atender esta solicitud, según la{" "}
      <a href="/legal/privacidad" target="_blank" className="underline underline-offset-2 hover:text-fg">
        política de privacidad
      </a>
      .
    </p>
  );
}
