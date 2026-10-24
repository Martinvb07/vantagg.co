import { HONEYPOT_FIELD } from "@/lib/honeypot";

/** Campo trampa para bots (ver src/lib/honeypot.ts). Va dentro del <form>. */
export function HoneypotField() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
      <label>
        Deja este campo vacío
        <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}
