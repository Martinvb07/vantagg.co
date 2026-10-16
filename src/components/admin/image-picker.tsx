"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_SIDE = 1600;
const QUALITY = 0.82;

/** Reduce la foto en el navegador (máx. 1600 px, JPEG): una captura de 4 MB queda en ~300 KB. */
async function compress(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

type Item = { file: File; url: string };

/**
 * Selector de imágenes para un formulario normal: las fotos elegidas (comprimidas) viajan en el
 * campo `name` al enviar el formulario. Muestra vista previa; la primera es la principal.
 */
export function ImagePicker({ name = "images", max = 15, existing = 0 }: { name?: string; max?: number; existing?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const room = Math.max(0, max - existing);

  // El input real lleva siempre las imágenes elegidas (ya comprimidas).
  useEffect(() => {
    if (!input.current) return;
    const dt = new DataTransfer();
    items.forEach((i) => dt.items.add(i.file));
    input.current.files = dt.files;
  }, [items]);

  // Al enviar con éxito el formulario se reinicia (reset) y el input queda vacío: se limpian las vistas previas.
  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const onReset = () => setItems((prev) => (prev.forEach((i) => URL.revokeObjectURL(i.url)), []));
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  const add = async (list: FileList | null) => {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    const free = room - items.length;
    setNote(files.length > free ? `Solo caben ${Math.max(0, free)} imagen(es) más (máximo ${max}).` : null);
    setBusy(true);
    const ready = await Promise.all(files.slice(0, Math.max(0, free)).map(compress));
    setItems((prev) => [...prev, ...ready.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    setBusy(false);
  };

  const remove = (idx: number) =>
    setItems((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });

  return (
    <div>
      <input ref={input} type="file" name={name} multiple accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={() => {}} />
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((it, i) => (
          <li key={it.url} className="group relative aspect-square overflow-hidden rounded-[10px] ring-1 ring-white/[0.08]">
            <img src={it.url} alt="" className="size-full object-cover" />
            {i === 0 && existing === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-volt-400 px-1.5 py-0.5 text-[10px] font-bold text-volt-ink">Principal</span>}
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Quitar imagen"
              className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-ink-950/80 text-fg ring-1 ring-white/15 transition hover:bg-bad-400 hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
        {items.length < room && (
          <li>
            <label
              className={cn(
                "flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-white/15 bg-ink-900/60 text-center text-[12px] text-fg-muted transition hover:border-volt-400/60 hover:text-fg",
                busy && "pointer-events-none opacity-60",
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void add(e.dataTransfer.files);
              }}
            >
              {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5 text-volt-300" />}
              {busy ? "Preparando…" : items.length ? "Agregar más" : "Agregar fotos"}
              <input
                type="file"
                multiple
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  void add(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </li>
        )}
      </ul>
      <p className="mt-2 text-[12px] text-fg-subtle">
        {items.length ? `${items.length} lista(s) para subir. ` : ""}Arrástralas o elígelas desde el celular. Se optimizan solas antes de subir.
      </p>
      {note && <p className="mt-1 text-[12px] text-warn-400">{note}</p>}
    </div>
  );
}
