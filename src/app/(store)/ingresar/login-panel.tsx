"use client";

import { useState } from "react";
import { KeyRound, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuthForm } from "./auth-form";
import { CodeLogin } from "./code-login";

/** Pestañas de inicio de sesión: código por correo (recomendado) o contraseña. */
export function LoginPanel({ next }: { next?: string }) {
  const [tab, setTab] = useState<"code" | "password">("code");
  const tabs = [
    { k: "code" as const, l: "Código por correo", icon: Mail },
    { k: "password" as const, l: "Contraseña", icon: KeyRound },
  ];
  return (
    <div>
      <div role="tablist" className="mb-5 grid grid-cols-2 gap-1 rounded-[12px] bg-white/[0.04] p-1 ring-1 ring-white/[0.06]">
        {tabs.map(({ k, l, icon: Icon }) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn("inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] text-[13px] font-medium transition", tab === k ? "bg-white/[0.09] text-fg" : "text-fg-muted hover:text-fg")}
          >
            <Icon className="size-3.5" /> {l}
          </button>
        ))}
      </div>
      {tab === "code" ? <CodeLogin next={next} /> : <AuthForm mode="login" next={next} />}
    </div>
  );
}
