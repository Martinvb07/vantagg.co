import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/primitives";
import { LEGAL, LEGAL_UPDATED } from "@/content/legal";
import { cn } from "@/lib/utils";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = LEGAL[slug];
  return doc ? { title: doc.title, description: doc.description, alternates: { canonical: `/legal/${slug}` } } : {};
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = LEGAL[slug];
  if (!doc) notFound();
  const settings = await getSettings();
  return (
    <Container className="grid gap-10 py-10 sm:py-14 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Documentos legales" className="lg:sticky lg:top-24 lg:self-start">
        <p className="eyebrow mb-3">Legal</p>
        <ul className="flex flex-wrap gap-1 lg:flex-col">
          {Object.entries(LEGAL).map(([s, d]) => (
            <li key={s}>
              <Link
                href={`/legal/${s}`}
                className={cn("block rounded-md px-3 py-2 text-sm", s === slug ? "bg-white/[0.06] text-fg" : "text-fg-muted hover:text-fg")}
              >
                {d.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <article className="max-w-3xl">
        <h1 className="font-display text-3xl font-semibold">{doc.title}</h1>
        <p className="mt-2 text-[13px] text-fg-subtle">{doc.description}</p>
        <p className="mt-1 text-[12.5px] text-fg-subtle">
          Vigente desde el <time dateTime={LEGAL_UPDATED}>{new Date(`${LEGAL_UPDATED}T12:00:00-05:00`).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" })}</time>
        </p>
        <div className="prose-store mt-8">{doc.body(settings)}</div>
      </article>
    </Container>
  );
}
