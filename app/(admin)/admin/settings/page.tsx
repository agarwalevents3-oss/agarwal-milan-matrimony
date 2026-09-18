import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./SettingsForm";
import { Card, CardHeader } from "@/components/ui/Card";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

/** Admin settings (PRD §13). */
export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("admin_settings").select("key, value");

  const byKey = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
  const contactNumber = typeof byKey.admin_contact_number === "string" ? byKey.admin_contact_number : "";
  const fee = (byKey.registration_fee ?? { amount: 999, currency: "INR" }) as {
    amount: number; currency: string;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl">Settings</h1>
        <p className="mt-1.5 text-sm text-muted">Configuration for the platform.</p>
      </div>

      <SettingsForm contactNumber={contactNumber} fee={fee} />

      {/*
        Integration status, read from server configuration. Useful when going
        live: it says plainly whether real OTP and payments are switched on.
      */}
      <Card>
        <CardHeader title="Integrations" description="Set through environment variables, not here" />
        <dl className="divide-y divide-line">
          <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
            <div>
              <dt className="text-sm font-medium text-ink">SMS / OTP</dt>
              <dd className="mt-0.5 text-xs text-muted">
                {env.otp.mode === "mock"
                  ? "Test mode — every code is the fixed development code, and no SMS is sent."
                  : `Live via ${env.otp.mode}.`}
              </dd>
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              env.otp.mode === "mock"
                ? "border-warning/25 bg-warning-soft text-warning"
                : "border-success/25 bg-success-soft text-success"
            }`}>
              {env.otp.mode === "mock" ? "Test mode" : "Live"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
            <div>
              <dt className="text-sm font-medium text-ink">Payments</dt>
              <dd className="mt-0.5 text-xs text-muted">
                {env.payment.mode === "mock"
                  ? "Test mode — payments are simulated and no money is taken."
                  : `Live via ${env.payment.mode}.`}
              </dd>
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              env.payment.mode === "mock"
                ? "border-warning/25 bg-warning-soft text-warning"
                : "border-success/25 bg-success-soft text-success"
            }`}>
              {env.payment.mode === "mock" ? "Test mode" : "Live"}
            </span>
          </div>
        </dl>
      </Card>
    </div>
  );
}
