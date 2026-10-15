"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Check, CheckCheck, Copy, Download, ImagePlus, Loader2, Lock, MessagesSquare, SendHorizontal, ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Author = "CUSTOMER" | "STAFF" | "SYSTEM";
type Attachment = { id: string; mime: string; width: number | null; height: number | null; size: number };
type Msg = { id: string; author: Author; body: string; createdAt: string; attachment?: Attachment | null; pending?: boolean; localUrl?: string };
type State = "hidden" | "open" | "closed";
type Peer = { online: boolean; typing: boolean; readAt: string | null };
type Draft = { blob: Blob; url: string; width: number; height: number };

const MAX = 2000;
const GROUP_MS = 5 * 60_000;

const QUICK_REPLIES = [
  { label: "Saludo", text: "¡Hola! Gracias por tu compra. Ya te entrego tu cuenta por aquí 👋" },
  {
    label: "Datos de acceso",
    text: "Estos son los datos de tu cuenta:\n\nVinculación: \nCorreo / usuario: \nContraseña: \n\nApenas entres, cambia la contraseña y el correo de recuperación.",
  },
  { label: "Confirmar acceso", text: "¿Pudiste entrar sin problema? Confírmame para cerrar la entrega." },
  { label: "Recordatorio", text: "Recuerda cambiar la contraseña y el correo de recuperación. Nunca compartas tus datos con nadie." },
];

// Siempre en hora de Colombia: igual en el servidor y en el navegador (evita diferencias al cargar la página).
const TZ = "America/Bogota";
const hour = (iso: string) => new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: TZ });
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

function dayLabel(iso: string) {
  const key = dayKey(new Date(iso));
  if (key === dayKey(new Date())) return "Hoy";
  if (key === dayKey(new Date(Date.now() - 86_400_000))) return "Ayer";
  return new Date(iso).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
}

/** Reduce la imagen en el navegador (máx. 1600 px). Al redibujarla se pierden los datos ocultos (GPS, cámara). */
async function compressImage(file: Blob): Promise<Draft> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error("No pudimos leer esa imagen. Usa una foto JPG, PNG o una captura de pantalla.");
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * scale);
  const height = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  const toBlob = (type: string) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.86));
  let blob = await toBlob("image/webp");
  if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg");
  if (!blob) throw new Error("No pudimos procesar la imagen.");
  if (blob.size > 4 * 1024 * 1024) throw new Error("La imagen es demasiado grande incluso comprimida.");
  return { blob, url: URL.createObjectURL(blob), width, height };
}

function CopyText({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1 text-[11px] font-medium text-fg-subtle hover:text-fg"
    >
      {done ? <Check className="size-3" /> : <Copy className="size-3" />} {done ? "Copiado" : "Copiar"}
    </button>
  );
}

/** Imagen privada: se pide con el permiso del pedido y se muestra desde memoria (nunca queda en una URL pública). */
function ChatImage({ src, headers, attachment, localUrl, onOpen }: { src: string; headers: HeadersInit; attachment: Attachment; localUrl?: string; onOpen: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(localUrl ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (localUrl) return;
    let alive = true;
    let obj: string | null = null;
    fetch(src, { headers, cache: "no-store" })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => {
        obj = URL.createObjectURL(b);
        if (alive) setUrl(obj);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (obj) URL.revokeObjectURL(obj);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, localUrl]);
  const ratio = attachment.width && attachment.height ? `${attachment.width} / ${attachment.height}` : "4 / 3";
  return (
    <button
      type="button"
      onClick={() => url && onOpen(url)}
      className="block w-[min(260px,62vw)] overflow-hidden rounded-[12px] bg-black/20 ring-1 ring-black/10"
      style={{ aspectRatio: ratio }}
      aria-label="Ver imagen en grande"
    >
      {url ? (
        <img src={url} alt="Imagen enviada en el chat" className="size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center text-[12px] text-fg-subtle">{failed ? "Imagen no disponible" : <Loader2 className="size-5 animate-spin" />}</span>
      )}
    </button>
  );
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Imagen del chat" className="fixed inset-0 z-[90] flex flex-col bg-black/90 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
        <a href={url} download="imagen-chat" className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-[13px] font-semibold text-white hover:bg-white/20">
          <Download className="size-4" /> Descargar
        </a>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
          <X className="size-5" />
        </button>
      </div>
      <div className="grid min-h-0 flex-1 place-items-center p-2">
        <img src={url} alt="Imagen del chat" className="max-h-full max-w-full rounded-[10px] object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
      </div>
    </div>
  );
}

function TypingBubble({ name }: { name: string }) {
  return (
    <div className="flex items-end gap-2" aria-live="polite">
      <div className="rounded-[16px] rounded-bl-[6px] bg-ink-750 px-3.5 py-3 ring-1 ring-white/[0.06]">
        <span className="flex gap-1" aria-label={`${name} está escribiendo`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-1.5 animate-bounce rounded-full bg-fg-subtle" style={{ animationDelay: `${i * 140}ms` }} />
          ))}
        </span>
      </div>
    </div>
  );
}

/**
 * Chat de entrega del pedido (comprador o equipo).
 * - Consulta cada 3 s (15 s con la pestaña oculta); «visto» solo cuando la página está a la vista.
 * - Imágenes: botón, pegar (Ctrl+V) o arrastrar; se comprimen aquí y viajan cifradas.
 * - Enter envía, Shift+Enter hace salto de línea.
 */
export function OrderChat({
  mode,
  endpoint,
  token,
  storeName,
  initialState,
  initialMessages,
  staffViewer = false,
  className,
}: {
  mode: "customer" | "staff";
  endpoint: string;
  token?: string;
  storeName: string;
  initialState: State;
  initialMessages: Msg[];
  staffViewer?: boolean;
  className?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [state, setState] = useState<State>(initialState);
  const [peer, setPeer] = useState<Peer>({ online: false, typing: false, readAt: null });
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stick = useRef(true);
  const lastAt = useRef<string | undefined>(initialMessages.at(-1)?.createdAt);
  const lastTyping = useRef(0);
  const unseen = useRef(0);
  const baseTitle = useRef<string>("");

  const mine: Author = mode === "staff" ? "STAFF" : "CUSTOMER";
  const theirs: Author = mode === "staff" ? "CUSTOMER" : "STAFF";
  const theirName = mode === "staff" ? "Comprador" : `Equipo ${storeName}`;
  const tokenHeader = useCallback((): Record<string, string> => (token ? { "x-order-token": token } : {}), [token]);
  const jsonHeaders = useCallback((): HeadersInit => ({ "Content-Type": "application/json", ...tokenHeader() }), [tokenHeader]);

  const merge = useCallback(
    (incoming: Msg[]) => {
      if (!incoming.length) return;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const fresh = incoming.filter((m) => !seen.has(m.id));
        // Aviso en la pestaña si llega algo del otro lado y la página no está a la vista.
        const theirsNew = fresh.filter((m) => m.author === theirs).length;
        if (theirsNew && document.visibilityState !== "visible") {
          unseen.current += theirsNew;
          if (!baseTitle.current) baseTitle.current = document.title;
          document.title = `(${unseen.current}) Mensaje nuevo · ${baseTitle.current}`;
        }
        return fresh.length ? [...prev, ...fresh] : prev;
      });
      lastAt.current = incoming.at(-1)!.createdAt;
    },
    [theirs],
  );

  // Sondeo de mensajes nuevos, presencia y «visto».
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const visible = document.visibilityState === "visible" && document.hasFocus();
        const params = new URLSearchParams();
        if (lastAt.current) params.set("after", lastAt.current);
        if (visible) params.set("seen", "1");
        const res = await fetch(`${endpoint}?${params}`, { headers: tokenHeader(), cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { state: State; messages: Msg[]; peer?: Peer };
          if (!stop) {
            setState(data.state);
            merge(data.messages);
            if (data.peer) setPeer(data.peer);
          }
        }
      } catch {
        /* sin conexión: se reintenta */
      }
      if (!stop) timer = setTimeout(tick, document.visibilityState === "visible" ? 3000 : 15000);
    };
    timer = setTimeout(tick, 1200);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        if (baseTitle.current) document.title = baseTitle.current;
        unseen.current = 0;
        clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stop = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [endpoint, tokenHeader, merge]);

  // Mantener la vista abajo cuando llegan mensajes (si el usuario estaba abajo).
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, peer.typing]);

  // Altura automática del campo de texto.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const pingTyping = () => {
    const now = Date.now();
    if (now - lastTyping.current < 2500) return;
    lastTyping.current = now;
    void fetch(endpoint, { method: "PATCH", headers: tokenHeader() }).catch(() => {});
  };

  const pickImage = async (file: Blob | null | undefined) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) return setError("Solo puedes enviar imágenes.");
    setError(null);
    try {
      const d = await compressImage(file);
      setDraft((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return d;
      });
      inputRef.current?.focus();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const send = async () => {
    const body = text.trim();
    if ((!body && !draft) || sending) return;
    setSending(true);
    setError(null);
    const att = draft;
    const temp: Msg = {
      id: `tmp-${Date.now()}`,
      author: mine,
      body,
      createdAt: new Date().toISOString(),
      pending: true,
      ...(att ? { attachment: { id: "local", mime: att.blob.type, width: att.width, height: att.height, size: att.blob.size }, localUrl: att.url } : {}),
    };
    stick.current = true;
    setMessages((m) => [...m, temp]);
    setText("");
    setDraft(null);
    try {
      let res: Response;
      if (att) {
        const fd = new FormData();
        fd.set("file", att.blob, att.blob.type === "image/webp" ? "imagen.webp" : "imagen.jpg");
        fd.set("caption", body);
        fd.set("width", String(att.width));
        fd.set("height", String(att.height));
        res = await fetch(endpoint, { method: "POST", headers: tokenHeader(), body: fd });
      } else {
        res = await fetch(endpoint, { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ body }) });
      }
      const data = (await res.json().catch(() => ({}))) as { message?: Msg; error?: string };
      if (!res.ok || !data.message) throw new Error(data.error ?? "No se pudo enviar el mensaje.");
      const real = { ...data.message, localUrl: att?.url };
      setMessages((m) => (m.some((x) => x.id === real.id) ? m.filter((x) => x.id !== temp.id) : m.map((x) => (x.id === temp.id ? real : x))));
      lastAt.current = real.createdAt;
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== temp.id));
      setText(body);
      if (att) setDraft(att);
      setError((e as Error).message);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const canWrite = state === "open" || (mode === "staff" && state === "closed");
  const readAt = peer.readAt ? Date.parse(peer.readAt) : 0;
  const status: ReactNode =
    state === "closed" ? (
      "Chat cerrado"
    ) : peer.typing ? (
      <span className="font-medium text-volt-300">escribiendo…</span>
    ) : peer.online ? (
      <span className="inline-flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-ok-400" /> {mode === "staff" ? "El comprador está en línea" : "En línea"}
      </span>
    ) : mode === "staff" ? (
      "El comprador ve tus mensajes en la página de su pedido"
    ) : (
      "Te entregamos la cuenta por aquí · se actualiza solo"
    );

  // Agrupación: separador por día y mensajes seguidos del mismo autor.
  const rows: ReactNode[] = [];
  messages.forEach((m, i) => {
    const prev = messages[i - 1];
    const newDay = !prev || dayKey(new Date(prev.createdAt)) !== dayKey(new Date(m.createdAt));
    if (newDay) {
      rows.push(
        <div key={`d-${m.id}`} className="flex items-center gap-3 py-1" role="separator">
          <span className="h-px flex-1 bg-white/[0.06]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle first-letter:uppercase">{dayLabel(m.createdAt)}</span>
          <span className="h-px flex-1 bg-white/[0.06]" />
        </div>,
      );
    }
    if (m.author === "SYSTEM") {
      rows.push(
        <p key={m.id} className="mx-auto max-w-[90%] rounded-full bg-white/[0.05] px-3 py-1.5 text-center text-[12px] leading-snug text-fg-muted">
          {m.body}
        </p>,
      );
      return;
    }
    const own = m.author === mine;
    const grouped = !newDay && prev && prev.author === m.author && Date.parse(m.createdAt) - Date.parse(prev.createdAt) < GROUP_MS;
    const seenByPeer = own && !m.pending && readAt >= Date.parse(m.createdAt);
    rows.push(
      <div key={m.id} className={cn("flex flex-col", own ? "items-end" : "items-start", grouped ? "-mt-1.5" : "")}>
        {!own && !grouped && <span className="mb-1 px-1 text-[11px] font-semibold text-fg-subtle">{theirName}</span>}
        <div
          className={cn(
            "max-w-[85%] overflow-hidden rounded-[16px] text-[14px] leading-relaxed",
            own ? "rounded-br-[6px] bg-volt-400 text-volt-ink" : "rounded-bl-[6px] bg-ink-750 text-fg ring-1 ring-white/[0.06]",
            m.attachment ? "p-1.5" : "px-3.5 py-2.5",
            m.pending && "opacity-70",
          )}
        >
          {m.attachment && (
            <ChatImage src={`${endpoint}/file/${m.attachment.id}`} headers={tokenHeader()} attachment={m.attachment} localUrl={m.localUrl} onOpen={setViewer} />
          )}
          {m.body && <p className={cn("whitespace-pre-wrap break-words", m.attachment && "px-2 pb-1 pt-2")}>{m.body}</p>}
        </div>
        <span className="mt-1 flex items-center gap-2 px-1 text-[10.5px] text-fg-subtle">
          {m.pending ? (
            "Enviando…"
          ) : (
            <>
              {hour(m.createdAt)}
              {own &&
                (seenByPeer ? (
                  <span className="inline-flex items-center gap-0.5 text-sky-300" title="Visto">
                    <CheckCheck className="size-3.5" /> Visto
                  </span>
                ) : (
                  <Check className="size-3.5" aria-label="Enviado" />
                ))}
            </>
          )}
          {!own && mode === "customer" && m.author === "STAFF" && m.body && <CopyText text={m.body} />}
        </span>
      </div>,
    );
  });

  return (
    <section
      className={cn("relative flex flex-col overflow-hidden rounded-[18px] bg-ink-850 ring-1 ring-white/[0.08]", className)}
      aria-label="Chat de entrega"
      onDragOver={(e) => {
        if (!canWrite || staffViewer || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={(e) => {
        if (!canWrite || staffViewer) return;
        e.preventDefault();
        setDragging(false);
        void pickImage(e.dataTransfer.files?.[0]);
      }}
    >
      <header className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
        <span className="relative grid size-10 place-items-center rounded-xl bg-volt-400/12 text-volt-300">
          <MessagesSquare className="size-[18px]" />
          {peer.online && state !== "closed" && <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-ok-400 ring-2 ring-ink-850" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-bold leading-tight">{mode === "staff" ? "Chat con el comprador" : `Chat con ${theirName}`}</p>
          <p className="truncate text-[12px] text-fg-subtle">{status}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2 py-1 text-[11px] text-fg-subtle ring-1 ring-white/[0.06]" title="Mensajes e imágenes se guardan cifrados">
          <Lock className="size-3" /> Cifrado
        </span>
      </header>

      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        className="h-[400px] space-y-3 overflow-y-auto px-4 py-4 sm:h-[440px]"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div className="grid h-full place-items-center text-center">
            <div>
              <MessagesSquare className="mx-auto size-8 text-fg-subtle" />
              <p className="mt-2 text-[13px] text-fg-subtle">{mode === "staff" ? "Aún no hay mensajes. Saluda al comprador y entrégale la cuenta." : "Aquí recibirás los datos de tu cuenta."}</p>
            </div>
          </div>
        )}
        {rows}
        {peer.typing && state !== "closed" && <TypingBubble name={theirName} />}
      </div>

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-[18px] border-2 border-dashed border-volt-400/70 bg-ink-900/85">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-volt-300">
            <ImagePlus className="size-5" /> Suelta la imagen para adjuntarla
          </p>
        </div>
      )}

      {staffViewer ? (
        <p className="border-t border-white/[0.06] px-4 py-3 text-[12.5px] text-fg-muted">
          Estás viendo el pedido como equipo.{" "}
          <Link href="/admin/chats" className="font-medium text-volt-300 underline-offset-4 hover:underline">
            Responde desde el panel
          </Link>
          .
        </p>
      ) : canWrite ? (
        <div className="border-t border-white/[0.06] p-3">
          {mode === "staff" && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {QUICK_REPLIES.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => {
                    setText(q.text);
                    inputRef.current?.focus();
                  }}
                  className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[11.5px] font-medium text-fg-muted ring-1 ring-white/[0.06] hover:bg-white/10 hover:text-fg"
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}
          {draft && (
            <div className="mb-2 flex items-center gap-3 rounded-[12px] bg-ink-900 p-2 ring-1 ring-white/[0.08]">
              <img src={draft.url} alt="Imagen lista para enviar" className="size-14 rounded-[8px] object-cover" />
              <div className="min-w-0 flex-1 text-[12.5px]">
                <p className="font-semibold">Imagen lista para enviar</p>
                <p className="text-fg-subtle">
                  {draft.width}×{draft.height} · {Math.max(1, Math.round(draft.blob.size / 1024))} KB · puedes agregar un texto
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => {
                    if (d) URL.revokeObjectURL(d.url);
                    return null;
                  })
                }
                aria-label="Quitar imagen" className="grid size-8 place-items-center rounded-full text-fg-subtle hover:bg-white/10 hover:text-fg">
                <X className="size-4" />
              </button>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-end gap-2"
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                void pickImage(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Adjuntar imagen"
              title="Adjuntar imagen (también puedes pegarla o arrastrarla)"
              className="grid size-11 shrink-0 place-items-center rounded-[12px] border border-white/10 bg-ink-900 text-fg-muted transition hover:border-white/25 hover:text-fg"
            >
              <ImagePlus className="size-5" />
            </button>
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value.slice(0, MAX));
                if (e.target.value.trim()) pingTyping();
              }}
              onPaste={(e) => {
                const img = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
                if (img) {
                  e.preventDefault();
                  void pickImage(img);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder={draft ? "Agrega un texto (opcional)…" : mode === "staff" ? "Escribe al comprador…" : "Escribe un mensaje…"}
              aria-label="Mensaje"
              className="max-h-40 min-h-11 flex-1 resize-none rounded-[12px] border border-white/10 bg-ink-900 px-3.5 py-2.5 text-[14px] leading-snug placeholder:text-fg-subtle focus:border-volt-500/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={(!text.trim() && !draft) || sending}
              aria-label="Enviar"
              className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-volt-400 text-volt-ink transition hover:bg-volt-300 disabled:bg-white/[0.06] disabled:text-fg-subtle"
            >
              {sending ? <Loader2 className="size-5 animate-spin" /> : <SendHorizontal className="size-5" />}
            </button>
          </form>
          {error && <p className="mt-2 text-[12.5px] text-bad-400">{error}</p>}
          {mode === "customer" && (
            <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-snug text-fg-subtle">
              <ShieldAlert className="mt-px size-3.5 shrink-0" /> Nunca te pediremos pagos extra ni códigos de tu banco por este chat.
            </p>
          )}
        </div>
      ) : (
        <p className="border-t border-white/[0.06] px-4 py-3 text-[12.5px] text-fg-muted">Este chat está cerrado. Si necesitas algo, escríbenos desde el Centro de ayuda.</p>
      )}

      {viewer && <Lightbox url={viewer} onClose={() => setViewer(null)} />}
    </section>
  );
}
