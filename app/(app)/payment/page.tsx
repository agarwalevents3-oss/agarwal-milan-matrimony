import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PaymentPanel } from "./PaymentPanel";
import { Alert } from "@/components/ui/Alert";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

/** Payment screen (PRD §6.1). Only reachable while a payment is actually due. */
export default async function PaymentPage() {
  const user = await requireUser();

  if (user.registrationStatus === "DRAFT") redirect("/register");
  if (!["SUBMITTED", "PAYMENT_PENDING", "PAYMENT_FAILED"].includes(user.registrationStatus)) {
    redirect("/status");
  }

  const supabase = await createClient();
  const { data: setting } = await supabase
    .from("admin_settings").select("value").eq("key", "registration_fee").maybeSingle();
  const fee = (setting?.value ?? { amount: 999, currency: "INR" }) as { amount: number; currency: string };

  return (
    <div className="container-page flex justify-center py-10 sm:py-16">
      <div className="w-full max-w-md">
        <div className="rounded-card border border-line bg-surface p-7 shadow-soft sm:p-9">
          <h1 className="text-2xl sm:text-3xl">Complete your registration</h1>
          <p className="mt-2 text-sm text-muted">
            Registration <span className="font-mono text-ink">{user.registrationId}</span>
          </p>

          {user.registrationStatus === "PAYMENT_FAILED" && (
            <div className="mt-5">
              <Alert tone="danger" title="Your last payment did not go through">
                Nothing was charged. Please try again.
              </Alert>
            </div>
          )}

          <div className="mt-7">
            <PaymentPanel amount={fee.amount} currency={fee.currency} />
          </div>
        </div>
      </div>
    </div>
  );
}
