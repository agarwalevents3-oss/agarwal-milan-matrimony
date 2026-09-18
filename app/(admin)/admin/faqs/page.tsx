import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { FaqManager, type FaqRow } from "./FaqManager";

export const metadata: Metadata = { title: "FAQs", robots: { index: false } };

/** FAQ management (PRD §4.4). */
export default async function AdminFaqsPage() {
  const supabase = await createClient();
  // Admins see hidden entries too; the public read policy filters on is_active.
  const { data } = await supabase
    .from("faqs")
    .select("id, question, answer, sort_order, is_active")
    .order("sort_order");

  const faqs: FaqRow[] = (data ?? []).map((row) => ({
    id: row.id, question: row.question, answer: row.answer,
    sortOrder: row.sort_order, isActive: row.is_active,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl">FAQs</h1>
        <p className="mt-1.5 text-sm text-muted">
          Questions shown on the public contact page.
        </p>
      </div>

      <FaqManager initial={faqs} />
    </div>
  );
}
