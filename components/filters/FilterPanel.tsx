"use client";

import { useReducer, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { encodeFilters, type Filters } from "@/lib/validation/filters";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";

/**
 * Search filters (PRD §9.1, §9.2).
 *
 * The rule the PRD is emphatic about: changing a filter must NOT trigger a
 * search. Every change lands in local reducer state and goes no further. Only
 * DONE writes the filter set into the URL, which is the single navigation that
 * causes the single database query.
 *
 * Putting the filters in the URL also makes a search shareable and the back
 * button correct — and it means the server can render the results directly.
 */

type Draft = Partial<Record<keyof Filters, string>>;

type Action =
  | { type: "set"; key: keyof Filters; value: string }
  | { type: "reset" };

function reducer(state: Draft, action: Action): Draft {
  switch (action.type) {
    case "set": {
      const next = { ...state };
      if (action.value === "") delete next[action.key];
      else next[action.key] = action.value;
      return next;
    }
    case "reset":
      return {};
  }
}

/** Human-readable summary of what is currently applied. */
const LABELS: Partial<Record<keyof Filters, string>> = {
  gender: "Gender", ageMin: "Age from", ageMax: "Age to",
  heightMinCm: "Height from", heightMaxCm: "Height to",
  maritalStatus: "Marital status", gotra: "Gotra", subcaste: "Subcaste",
  highestQualification: "Qualification", occupation: "Occupation",
  companyBusiness: "Company", incomeMin: "Income from", incomeMax: "Income to",
  city: "City", state: "State",
};

export function FilterPanel({ applied }: { applied: Filters }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const initial: Draft = Object.fromEntries(
    Object.entries(applied)
      .filter(([key, value]) => key !== "page" && value !== undefined && value !== "")
      .map(([key, value]) => [key, String(value)]),
  );
  const [draft, dispatch] = useReducer(reducer, initial);

  const appliedCount = Object.keys(initial).length;
  const field = (key: keyof Filters) => ({
    value: draft[key] ?? "",
    onChange: (e: { target: { value: string } }) =>
      dispatch({ type: "set", key, value: e.target.value }),
  });

  /** The ONLY place a search is issued. */
  function done() {
    const query = encodeFilters({ ...draft, page: 1 } as Partial<Filters>);
    setOpen(false);
    startTransition(() => router.push(query ? `/dashboard?${query}` : "/dashboard"));
  }

  function clearAll() {
    dispatch({ type: "reset" });
    setOpen(false);
    startTransition(() => router.push("/dashboard"));
  }

  const form = (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 lg:px-0 lg:py-0">
        <Field label="Looking for">
          {({ id }) => (
            <Select id={id} {...field("gender")}>
              <option value="">Anyone</option>
              <option value="FEMALE">Women</option>
              <option value="MALE">Men</option>
              <option value="OTHER">Other</option>
            </Select>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Age from">
            {({ id }) => <Input id={id} type="number" min={18} max={100} placeholder="25" {...field("ageMin")} />}
          </Field>
          <Field label="Age to">
            {({ id }) => <Input id={id} type="number" min={18} max={100} placeholder="35" {...field("ageMax")} />}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Height from (cm)">
            {({ id }) => <Input id={id} type="number" min={120} max={250} {...field("heightMinCm")} />}
          </Field>
          <Field label="Height to (cm)">
            {({ id }) => <Input id={id} type="number" min={120} max={250} {...field("heightMaxCm")} />}
          </Field>
        </div>

        <Field label="Marital status">
          {({ id }) => (
            <Select id={id} {...field("maritalStatus")}>
              <option value="">Any</option>
              <option value="NEVER_MARRIED">Never married</option>
              <option value="DIVORCED">Divorced</option>
              <option value="WIDOWED">Widowed</option>
              <option value="SEPARATED">Separated</option>
            </Select>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Gotra">{({ id }) => <Input id={id} {...field("gotra")} />}</Field>
          <Field label="Subcaste">{({ id }) => <Input id={id} {...field("subcaste")} />}</Field>
        </div>

        <Field label="Qualification">
          {({ id }) => <Input id={id} placeholder="B.Tech" {...field("highestQualification")} />}
        </Field>
        <Field label="Occupation">
          {({ id }) => <Input id={id} placeholder="Engineer" {...field("occupation")} />}
        </Field>
        <Field label="Company or business">
          {({ id }) => <Input id={id} {...field("companyBusiness")} />}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Income from (₹)">
            {({ id }) => <Input id={id} type="number" min={0} step={100000} {...field("incomeMin")} />}
          </Field>
          <Field label="Income to (₹)">
            {({ id }) => <Input id={id} type="number" min={0} step={100000} {...field("incomeMax")} />}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="City">{({ id }) => <Input id={id} {...field("city")} />}</Field>
          <Field label="State">{({ id }) => <Input id={id} {...field("state")} />}</Field>
        </div>
      </div>

      <div className="flex gap-3 border-t border-line bg-surface px-5 py-4 lg:px-0 lg:pb-0">
        <Button variant="secondary" onClick={clearAll} disabled={isPending} className="shrink-0">
          <RotateCcw className="h-4 w-4" aria-hidden />
          <span className="sr-only sm:not-sr-only">Clear</span>
        </Button>
        <Button onClick={done} disabled={isPending} className="flex-1">
          {isPending ? "Searching…" : "Done"}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile: a bottom sheet, opened from a toolbar button (PRD §24). */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-medium text-body"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Filters
          {appliedCount > 0 && <Badge tone="primary">{appliedCount}</Badge>}
        </button>

        {open && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-ink/40" role="dialog" aria-modal="true" aria-label="Search filters">
            <button type="button" className="flex-1" onClick={() => setOpen(false)} aria-label="Close filters" />
            <div className="max-h-[85dvh] overflow-hidden rounded-t-card bg-surface">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 className="font-display text-base font-semibold text-ink">Filters</h2>
                <button
                  type="button" onClick={() => setOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-primary-soft"
                  aria-label="Close filters"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {form}
            </div>
          </div>
        )}
      </div>

      {/* Desktop: a persistent sidebar. */}
      <aside className={cn("hidden lg:block", isPending && "opacity-60")}>
        <div className="sticky top-24 rounded-card border border-line bg-surface p-5">
          <h2 className="mb-4 font-display text-base font-semibold text-ink">Filters</h2>
          {form}
        </div>
      </aside>
    </>
  );
}

/** Chips showing what is applied, so the result set is never unexplained. */
export function AppliedFilters({ applied }: { applied: Filters }) {
  const entries = Object.entries(applied).filter(
    ([key, value]) => key !== "page" && value !== undefined && value !== "",
  );
  if (!entries.length) return null;

  return (
    <ul className="flex flex-wrap gap-2">
      {entries.map(([key, value]) => (
        <li key={key}>
          <Badge tone="primary">
            {LABELS[key as keyof Filters] ?? key}: {String(value)}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
