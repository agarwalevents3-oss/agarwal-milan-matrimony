import type { ReactNode } from "react";
import { BadgeCheck, CalendarClock, ShieldCheck, Sparkles } from "lucide-react";
import {
  CONTACT_VISIBILITY_RULES, MEMBERSHIP_BENEFITS, MEMBERSHIP_PLACEHOLDERS, MEMBERSHIP_START_RULE,
  formatPrice, type MembershipPlan,
} from "@/lib/membership";

function Block({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-canvas p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-sans text-sm font-semibold text-ink">
        <span aria-hidden className="text-primary">{icon}</span>
        {title}
      </h2>
      <div className="mt-3 text-sm text-body">{children}</div>
    </section>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className={strong ? "text-right font-display text-2xl text-ink" : "text-right font-medium text-ink"}>
        {value}
      </dd>
    </div>
  );
}

/**
 * Everything a member is told before checkout (Website Improvements §6.1):
 * plan and price split into fee, taxes and total; validity; benefits; and who
 * can see whose contact details. Unconfirmed business terms appear as clearly
 * marked placeholders from lib/membership.ts.
 */
export function MembershipSummary({ plan }: { plan: MembershipPlan }) {
  const price = plan.price ? formatPrice(plan.price) : MEMBERSHIP_PLACEHOLDERS.price;

  return (
    <div className="space-y-4">
      <Block icon={<BadgeCheck className="h-4 w-4" />} title="Membership plan">
        <dl className="divide-y divide-line">
          <Row label="Plan" value={plan.name} />
          <Row label="Membership fee" value={plan.price ? `${price} (${plan.price.currency})` : price} />
          <Row label="Taxes & additional charges" value={MEMBERSHIP_PLACEHOLDERS.taxes} />
          <Row label="Total payable" value={price} strong />
        </dl>
        <p className="mt-2 text-xs text-muted">
          The total payable is exactly the amount you will be charged.
        </p>
      </Block>

      <Block icon={<CalendarClock className="h-4 w-4" />} title="Membership validity">
        <dl className="divide-y divide-line">
          <Row label="Duration" value={MEMBERSHIP_PLACEHOLDERS.validity} />
        </dl>
        <p className="mt-2">{MEMBERSHIP_START_RULE}</p>
        <p className="mt-1 text-muted">Expiry: {MEMBERSHIP_PLACEHOLDERS.expiry}</p>
      </Block>

      <Block icon={<Sparkles className="h-4 w-4" />} title="What your membership includes">
        <ul className="list-disc space-y-1.5 pl-5">
          {MEMBERSHIP_BENEFITS.map((benefit) => <li key={benefit}>{benefit}</li>)}
        </ul>
      </Block>

      <Block icon={<ShieldCheck className="h-4 w-4" />} title="Contact details & privacy">
        <ul className="list-disc space-y-1.5 pl-5">
          {CONTACT_VISIBILITY_RULES.map((rule) => <li key={rule}>{rule}</li>)}
        </ul>
      </Block>
    </div>
  );
}
