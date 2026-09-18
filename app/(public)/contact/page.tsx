import type { Metadata } from "next";
import { Mail, MapPin, Phone, Clock } from "lucide-react";
import { getSiteContent, getFaqs } from "@/lib/services/content";

/** Contact + FAQ (PRD §4.3, §4.4). Both are CMS-driven and cached. */

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const { contact } = await getSiteContent();
  return {
    title: `Contact — ${contact.companyName || "Matrimony"}`,
    description: `Get in touch with ${contact.companyName}.`,
  };
}

export default async function ContactPage() {
  const [{ contact }, faqs] = await Promise.all([getSiteContent(), getFaqs()]);

  const details = [
    { icon: Phone, label: "Phone", value: contact.phone, href: `tel:${contact.phone?.replace(/\s/g, "")}` },
    { icon: Mail, label: "Email", value: contact.email, href: `mailto:${contact.email}` },
    { icon: MapPin, label: "Address", value: contact.address },
    { icon: Clock, label: "Office hours", value: contact.hours },
  ].filter((d) => d.value);

  return (
    <>
      <section className="border-b border-line bg-primary-soft py-14">
        <div className="container-page">
          <h1 className="text-4xl sm:text-5xl">Contact us</h1>
          <p className="prose-body mt-3 text-lg">
            We are happy to help with registration, verification or anything else.
          </p>
        </div>
      </section>

      {details.length > 0 && (
      <section className="container-page py-14">
        <h2 className="sr-only">Contact details</h2>
        <dl className="grid gap-5 sm:grid-cols-2">
          {details.map(({ icon: Icon, label, value, href }) => (
            <div key={label} className="flex gap-4 rounded-card border border-line bg-surface p-6">
              <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
                <dd className="mt-1 break-words text-base text-ink">
                  {href ? <a href={href} className="hover:text-primary">{value}</a> : value}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </section>
      )}

      <section className="border-t border-line bg-surface py-14">
        <div className="container-page max-w-3xl">
          <h2 className="text-3xl">Frequently asked questions</h2>
          <div className="mt-8 divide-y divide-line border-y border-line">
            {faqs.map((faq) => (
              <details key={faq.id} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink">
                  {faq.question}
                  <span
                    aria-hidden
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-primary-border text-primary transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="prose-body mt-3 text-sm">{faq.answer}</p>
              </details>
            ))}
            {faqs.length === 0 && (
              <p className="py-5 text-sm text-muted">No questions have been published yet.</p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
