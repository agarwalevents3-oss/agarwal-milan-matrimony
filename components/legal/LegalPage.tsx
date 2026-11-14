import type { ReactNode } from "react";
import { BRAND_NAME } from "@/lib/utils/contact";

/**
 * Layout for the policy pages, matching the existing Terms & Conditions page.
 *
 * Policy text is passed in as data (title + sections), so each page keeps its
 * wording in one block at the top of its file — easy to edit once the client
 * confirms the business terms that are still placeholders.
 *
 * Renders a <div>, not a <main>: the public layout already provides the
 * page's single main landmark.
 */
export interface LegalSection {
  heading: string;
  body: ReactNode;
}

export function LegalPage({
  title, lastUpdated, intro, sections,
}: {
  title: string;
  lastUpdated: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div className="bg-white px-6 py-16">
      <article className="mx-auto max-w-3xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-pink-600">
          {BRAND_NAME}
        </p>

        <h1 className="mb-4 text-4xl font-bold text-[#35282D]">{title}</h1>

        <p className="mb-8 text-sm text-gray-500">Last updated: {lastUpdated}</p>

        <div className="mb-6 leading-8 text-gray-700">{intro}</div>

        {sections.map((section, index) => (
          <section key={section.heading} className="mb-8">
            <h2 className="mb-3 text-xl font-semibold text-[#35282D]">
              {index + 1}. {section.heading}
            </h2>
            <div className="space-y-3 leading-8 text-gray-700">{section.body}</div>
          </section>
        ))}
      </article>
    </div>
  );
}

/** A labelled point within a section, e.g. "Membership validity: …". */
export function Term({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p>
      <span className="font-semibold text-[#35282D]">{label}:</span> {children}
    </p>
  );
}

/** Marks business terms awaiting confirmation so they cannot be mistaken for policy. */
export function Placeholder({ children }: { children: ReactNode }) {
  return <span className="font-medium text-pink-700">{children}</span>;
}
