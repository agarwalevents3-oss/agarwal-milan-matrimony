import type { ReactNode } from "react";

/** Definition list used across the profile detail and admin views. */
export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  const present = items.filter((i) => i.value !== null && i.value !== undefined && i.value !== "");
  if (!present.length) {
    return <p className="text-sm text-muted">Not shared.</p>;
  }

  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {present.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{item.label}</dt>
          <dd className="mt-1 break-words text-sm text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line px-5 py-6 sm:px-6">
      <h2 className="mb-4 font-display text-base font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}
