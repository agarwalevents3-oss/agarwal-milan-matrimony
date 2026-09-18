"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

const STATUSES = [
  ["", "All statuses"],
  ["PENDING_VERIFICATION", "Awaiting review"],
  ["VERIFIED", "Verified"],
  ["PAYMENT_PENDING", "Payment pending"],
  ["PAYMENT_FAILED", "Payment failed"],
  ["REJECTED", "Rejected"],
  ["SUSPENDED", "Suspended"],
  ["DRAFT", "Draft"],
  ["DELETED", "Deleted"],
] as const;

/**
 * Registration search (PRD §12.2).
 *
 * Submits as a form so the query lives in the URL — searches are shareable,
 * the back button works, and the results are server-rendered.
 */
export function SearchBar() {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(params.get("search") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (search.trim()) next.set("search", search.trim());
    if (status) next.set("status", status);
    const query = next.toString();
    startTransition(() =>
      router.push(query ? `/admin/registrations?${query}` : "/admin/registrations"),
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Registration ID, name, mobile or email"
          aria-label="Search registrations"
          className="pl-10"
        />
      </div>

      <Select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        aria-label="Filter by status"
        className="sm:w-52"
      >
        {STATUSES.map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </Select>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Searching…" : "Search"}
      </Button>
    </form>
  );
}
