"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, IndianRupee } from "lucide-react";
import { apiPost } from "@/lib/api/client";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

/**
 * Admin settings (PRD §13).
 *
 * The contact number here is the one shown to members IN PLACE OF each other's
 * personal numbers, so it deserves the prominence — getting it wrong means
 * members cannot reach anyone.
 */
export function SettingsForm({ contactNumber, fee }: {
  contactNumber: string;
  fee: { amount: number; currency: string };
}) {
  const router = useRouter();
  const [number, setNumber] = useState(contactNumber);
  const [amount, setAmount] = useState(String(fee.amount));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function save(label: string, payload: Record<string, unknown>, message: string) {
    setBusy(label);
    setError(null);
    setSaved(null);
    try {
      await apiPost("/api/admin/settings", payload);
      setSaved(message);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">{saved}</Alert>}

      <Card>
        <CardHeader
          title="Member contact number"
          description="Shown on every profile page instead of members&apos; own numbers"
        />
        <div className="space-y-4 p-5 sm:p-6">
          <Alert tone="info">
            Members never see each other&apos;s phone numbers. This number appears on
            every profile detail page and on the matches page, so it is the only
            route a member has to reach anyone. Make sure it is answered.
          </Alert>

          <Field label="Contact number" required
                 hint="Include the country code, for example +91 98765 43210.">
            {({ id }) => (
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <Input id={id} value={number} onChange={(e) => setNumber(e.target.value)} className="pl-10" />
              </div>
            )}
          </Field>

          <div className="flex justify-end">
            <Button
              onClick={() => save("number", { adminContactNumber: number.trim() }, "Contact number updated.")}
              disabled={busy !== null || number.trim().length < 6}
            >
              {busy === "number" ? "Saving…" : "Save contact number"}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Registration fee" description="Charged once, before verification" />
        <div className="space-y-4 p-5 sm:p-6">
          <Field label="Amount" required hint="Whole rupees. Existing unpaid registrations will use the new amount.">
            {({ id }) => (
              <div className="relative">
                <IndianRupee className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <Input
                  id={id} type="number" min={0} step={1} value={amount}
                  onChange={(e) => setAmount(e.target.value)} className="pl-10"
                />
              </div>
            )}
          </Field>

          <div className="flex justify-end">
            <Button
              onClick={() => save("fee", {
                registrationFee: { amount: Number(amount), currency: fee.currency },
              }, "Registration fee updated.")}
              disabled={busy !== null || amount.trim() === "" || Number(amount) < 0}
            >
              {busy === "fee" ? "Saving…" : "Save fee"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
