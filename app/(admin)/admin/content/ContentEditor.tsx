"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { apiPost } from "@/lib/api/client";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { SiteContent } from "@/lib/services/content";

/**
 * Website content editing (PRD §13).
 *
 * Each section saves independently, so a long edit cannot be lost to one
 * validation error elsewhere on the page. Saving invalidates the cache tag, so
 * the public site reflects the change on the very next request — no redeploy.
 */

function useSectionSave(key: string) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(value: unknown) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await apiPost("/api/admin/content", { key, value });
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return { save, saving, error, saved };
}

function SectionCard({
  title, description, error, saved, saving, onSave, children,
}: {
  title: string; description?: string; error: string | null; saved: boolean;
  saving: boolean; onSave: () => void; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="space-y-4 p-5 sm:p-6">
        {error && <Alert tone="danger">{error}</Alert>}
        {saved && <Alert tone="success">Saved. The website is already showing this.</Alert>}
        {children}
        <div className="flex justify-end pt-1">
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save section"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function ContentEditor({ content }: { content: SiteContent }) {
  return (
    <div className="space-y-5">
      <HeroSection initial={content.hero} />
      <AboutSection initial={content.about} />
      <WhySection initial={content.why_choose_us} />
      <CtaSection initial={content.cta} />
      <ContactSection initial={content.contact} />
      <FooterSection initial={content.footer} />
    </div>
  );
}

function HeroSection({ initial }: { initial: SiteContent["hero"] }) {
  const [value, setValue] = useState(initial);
  const { save, saving, error, saved } = useSectionSave("hero");
  const set = (k: keyof typeof value) => (e: { target: { value: string } }) =>
    setValue((v) => ({ ...v, [k]: e.target.value }));

  return (
    <SectionCard title="Hero" description="The first thing a visitor reads"
                 error={error} saved={saved} saving={saving} onSave={() => save(value)}>
      <Field label="Headline" required>
        {({ id }) => <Input id={id} value={value.title} onChange={set("title")} />}
      </Field>
      <Field label="Supporting text">
        {({ id }) => <Textarea id={id} rows={2} value={value.subtitle} onChange={set("subtitle")} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Primary button" required>
          {({ id }) => <Input id={id} value={value.ctaPrimary} onChange={set("ctaPrimary")} />}
        </Field>
        <Field label="Secondary button" required>
          {({ id }) => <Input id={id} value={value.ctaSecondary} onChange={set("ctaSecondary")} />}
        </Field>
      </div>
    </SectionCard>
  );
}

function AboutSection({ initial }: { initial: SiteContent["about"] }) {
  const [value, setValue] = useState(initial);
  const { save, saving, error, saved } = useSectionSave("about");

  return (
    <SectionCard title="About us" description="Leave the body empty to hide this section"
                 error={error} saved={saved} saving={saving} onSave={() => save(value)}>
      <Field label="Heading" required>
        {({ id }) => <Input id={id} value={value.title}
                            onChange={(e) => setValue((v) => ({ ...v, title: e.target.value }))} />}
      </Field>
      <Field label="Body">
        {({ id }) => <Textarea id={id} rows={5} value={value.body}
                               onChange={(e) => setValue((v) => ({ ...v, body: e.target.value }))} />}
      </Field>
    </SectionCard>
  );
}

function WhySection({ initial }: { initial: SiteContent["why_choose_us"] }) {
  const [value, setValue] = useState(initial);
  const { save, saving, error, saved } = useSectionSave("why_choose_us");

  const setItem = (index: number, key: "title" | "body", next: string) =>
    setValue((v) => ({
      ...v,
      items: v.items.map((item, i) => (i === index ? { ...item, [key]: next } : item)),
    }));

  return (
    <SectionCard title="Why choose us" description="Up to eight points. Remove them all to hide the section."
                 error={error} saved={saved} saving={saving} onSave={() => save(value)}>
      <Field label="Heading" required>
        {({ id }) => <Input id={id} value={value.title}
                            onChange={(e) => setValue((v) => ({ ...v, title: e.target.value }))} />}
      </Field>

      <ul className="space-y-3">
        {value.items.map((item, index) => (
          <li key={index} className="rounded-xl border border-line bg-canvas p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-3">
                <Field label={`Point ${index + 1} title`}>
                  {({ id }) => <Input id={id} value={item.title}
                                      onChange={(e) => setItem(index, "title", e.target.value)} />}
                </Field>
                <Field label="Description">
                  {({ id }) => <Textarea id={id} rows={2} value={item.body}
                                         onChange={(e) => setItem(index, "body", e.target.value)} />}
                </Field>
              </div>
              <button
                type="button"
                onClick={() => setValue((v) => ({ ...v, items: v.items.filter((_, i) => i !== index) }))}
                className="mt-6 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger"
                aria-label={`Remove point ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {value.items.length < 8 && (
        <Button
          variant="secondary" size="sm"
          onClick={() => setValue((v) => ({ ...v, items: [...v.items, { title: "", body: "" }] }))}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add a point
        </Button>
      )}
    </SectionCard>
  );
}

function CtaSection({ initial }: { initial: SiteContent["cta"] }) {
  const [value, setValue] = useState(initial);
  const { save, saving, error, saved } = useSectionSave("cta");
  const set = (k: keyof typeof value) => (e: { target: { value: string } }) =>
    setValue((v) => ({ ...v, [k]: e.target.value }));

  return (
    <SectionCard title="Call to action" description="The pink band near the bottom of the home page"
                 error={error} saved={saved} saving={saving} onSave={() => save(value)}>
      <Field label="Heading" required>{({ id }) => <Input id={id} value={value.title} onChange={set("title")} />}</Field>
      <Field label="Supporting text">{({ id }) => <Textarea id={id} rows={2} value={value.subtitle} onChange={set("subtitle")} />}</Field>
      <Field label="Button" required>{({ id }) => <Input id={id} value={value.button} onChange={set("button")} />}</Field>
    </SectionCard>
  );
}

function ContactSection({ initial }: { initial: SiteContent["contact"] }) {
  const [value, setValue] = useState(initial);
  const { save, saving, error, saved } = useSectionSave("contact");
  const set = (k: keyof typeof value) => (e: { target: { value: string } }) =>
    setValue((v) => ({ ...v, [k]: e.target.value }));

  return (
    <SectionCard title="Contact details" description="Shown on the contact page, the footer and the header"
                 error={error} saved={saved} saving={saving} onSave={() => save(value)}>
      <Field label="Company name" required>{({ id }) => <Input id={id} value={value.companyName} onChange={set("companyName")} />}</Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone">{({ id }) => <Input id={id} value={value.phone} onChange={set("phone")} />}</Field>
        <Field label="Email">{({ id }) => <Input id={id} type="email" value={value.email} onChange={set("email")} />}</Field>
      </div>
      <Field label="Address">{({ id }) => <Textarea id={id} rows={2} value={value.address} onChange={set("address")} />}</Field>
      <Field label="Office hours">{({ id }) => <Input id={id} value={value.hours ?? ""} onChange={set("hours")} />}</Field>
      <p className="text-xs leading-relaxed text-muted">
        This is the company&apos;s public number. The number shown on member profile
        pages is set separately, under Settings.
      </p>
    </SectionCard>
  );
}

function FooterSection({ initial }: { initial: SiteContent["footer"] }) {
  const [value, setValue] = useState(initial);
  const { save, saving, error, saved } = useSectionSave("footer");
  const set = (k: keyof typeof value) => (e: { target: { value: string } }) =>
    setValue((v) => ({ ...v, [k]: e.target.value }));

  return (
    <SectionCard title="Footer" error={error} saved={saved} saving={saving} onSave={() => save(value)}>
      <Field label="Tagline">{({ id }) => <Input id={id} value={value.tagline} onChange={set("tagline")} />}</Field>
      <Field label="Copyright line">{({ id }) => <Input id={id} value={value.copyright} onChange={set("copyright")} />}</Field>
    </SectionCard>
  );
}
