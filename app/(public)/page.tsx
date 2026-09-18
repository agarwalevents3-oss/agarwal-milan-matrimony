import type { Metadata } from "next";
import { ShieldCheck, HeartHandshake, Lock, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { getSiteContent } from "@/lib/services/content";

/**
 * Home (PRD §4.2).
 *
 * A Server Component with no client JS: hero, about, why-us and CTA all render
 * from cached CMS rows. That is what keeps LCP low on a 4G phone and the
 * hosting bill near zero.
 */

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const { hero, contact } = await getSiteContent();
  return {
    title: `${contact.companyName || "Matrimony"} — ${hero.title}`,
    description: hero.subtitle,
    openGraph: { title: contact.companyName, description: hero.subtitle },
  };
}

const ICONS = [ShieldCheck, Lock, HeartHandshake, Sparkles];

export default async function HomePage() {
  const { hero, about, why_choose_us: why, cta } = await getSiteContent();

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary-soft to-canvas">
        <div className="container-page grid gap-12 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-primary-border bg-surface px-3 py-1 text-xs font-medium text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Every profile verified by our team
            </p>
            <h1 className="mt-5 text-4xl leading-tight sm:text-5xl lg:text-6xl">{hero.title}</h1>
            <p className="prose-body mt-5 text-lg text-body">{hero.subtitle}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/register" size="lg">{hero.ctaPrimary}</ButtonLink>
              <ButtonLink href="/login" size="lg" variant="secondary">{hero.ctaSecondary}</ButtonLink>
            </div>
          </div>

          {/*
            Placeholder for the couple imagery in PRD §4.2. Once real licensed
            photography is supplied it is uploaded to site-assets and rendered
            from site_images, with no code change.
          */}
          <div className="relative">
            <div className="aspect-4/3 w-full rounded-card border border-primary-border bg-surface shadow-lift">
              <div className="grid h-full place-items-center gap-3 p-8 text-center">
                <HeartHandshake className="h-12 w-12 text-primary-border" aria-hidden />
                <p className="text-sm text-muted">
                  Couple photography goes here — upload it from
                  <span className="whitespace-nowrap"> Admin → Website content</span>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/*
        Sections render only when they have content. If the database is
        unreachable the cached fallback is empty, and a hollow heading over
        blank space looks broken — better to show a shorter, complete page.
      */}
      {about.body && (
        <section className="container-page py-16 lg:py-20">
          <div className="max-w-3xl">
            <h2 className="text-3xl sm:text-4xl">{about.title}</h2>
            <p className="prose-body mt-4 text-lg">{about.body}</p>
          </div>
        </section>
      )}

      {why.items.length > 0 && (
      <section className="border-y border-line bg-surface py-16 lg:py-20">
        <div className="container-page">
          <h2 className="text-3xl sm:text-4xl">{why.title}</h2>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {why.items.map((item, index) => {
              const Icon = ICONS[index % ICONS.length];
              return (
                <li key={item.title} className="rounded-card border border-line bg-canvas p-6">
                  <span aria-hidden className="grid h-10 w-10 place-items-center rounded-full bg-primary-soft text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
      )}

      {/* Call to action */}
      <section className="container-page py-16 lg:py-24">
        <div className="rounded-card bg-primary px-8 py-14 text-center shadow-lift">
          <h2 className="font-display text-3xl text-white sm:text-4xl">{cta.title}</h2>
          {cta.subtitle && <p className="mx-auto mt-3 max-w-xl text-pink-50">{cta.subtitle}</p>}
          <div className="mt-8">
            <ButtonLink href="/register" size="lg" className="bg-white text-primary hover:bg-primary-soft">
              {cta.button}
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
