"use client";

/* eslint-disable @next/next/no-img-element */
import { useActionState, useRef, useState, useTransition } from "react";
import { Check, ImagePlus, Loader2, RotateCcw } from "lucide-react";
import { PresetGlyph, UserAvatar, type AvatarUser } from "@/components/account/user-avatar";
import { Alert } from "@/components/ui/primitives";
import { AVATAR_PRESETS } from "@/domain/avatars";
import { cn } from "@/lib/utils";
import { chooseAvatarAction, removeAvatarAction, uploadAvatarAction } from "@/app/actions/profile";

/** Elegir avatar de la galería, subir una foto o volver a las iniciales. */
export function AvatarPicker({ user }: { user: AvatarUser }) {
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, start] = useTransition();
  const [uploaded, upload, uploading] = useActionState(uploadAvatarAction, null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const current: AvatarUser = preview ? { ...user, avatarUrl: preview, avatarPreset: null } : user;
  const feedback = uploaded?.error || uploaded?.ok ? uploaded : msg;

  return (
    <div>
      <div className="flex items-center gap-4">
        <UserAvatar user={current} size={84} className="ring-4 ring-volt-400/30" />
        <div className="min-w-0 space-y-2">
          <form
            ref={formRef}
            action={(fd) => {
              setMsg(null);
              upload(fd);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 2 * 1024 * 1024) {
                  setMsg({ error: "La foto supera 2 MB. Elige una más liviana." });
                  e.target.value = "";
                  return;
                }
                setPreview(URL.createObjectURL(f));
                formRef.current?.requestSubmit();
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-volt-400 px-4 text-[13.5px] font-semibold text-volt-ink transition hover:bg-volt-300 disabled:opacity-60"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} Subir foto
            </button>
          </form>
          {(user.avatarUrl || user.avatarPreset) && (
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  setPreview(null);
                  setMsg(await removeAvatarAction());
                })
              }
              className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-muted hover:text-fg"
            >
              <RotateCcw className="size-3.5" /> Usar mis iniciales
            </button>
          )}
          <p className="text-[11.5px] text-fg-subtle">JPG, PNG o WebP · máximo 2 MB</p>
        </div>
      </div>

      <p className="mb-2.5 mt-6 text-[12px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">O elige un avatar</p>
      <div role="radiogroup" aria-label="Avatares" className="grid grid-cols-6 gap-2.5">
        {AVATAR_PRESETS.map((p) => {
          const selected = !preview && !user.avatarUrl && user.avatarPreset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={p.label}
              title={p.label}
              disabled={pendingKey !== null}
              onClick={() => {
                setPendingKey(p.key);
                setPreview(null);
                start(async () => {
                  setMsg(await chooseAvatarAction(p.key));
                  setPendingKey(null);
                });
              }}
              className={cn(
                "relative aspect-square overflow-hidden rounded-full transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400",
                selected ? "ring-[3px] ring-volt-400 ring-offset-2 ring-offset-ink-850" : "ring-1 ring-white/10",
              )}
            >
              <PresetGlyph preset={p.key} />
              {(selected || pendingKey === p.key) && (
                <span className="absolute inset-0 grid place-items-center bg-black/35">
                  {pendingKey === p.key ? <Loader2 className="size-5 animate-spin text-white" /> : <Check className="size-5 text-white" strokeWidth={3} />}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {feedback?.error && <Alert tone="danger" className="mt-4">{feedback.error}</Alert>}
      {feedback?.ok && <Alert tone="success" className="mt-4">{feedback.ok}</Alert>}
    </div>
  );
}
