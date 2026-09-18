"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, CreditCard } from "lucide-react";
import { apiPost } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

interface CreatedOrder {
  paymentId: string; orderId: string; amount: number;
  currency: string; gateway: string; publicKey: string | null;
}

/**
 * Payment (PRD §6, §20.2).
 *
 * Under the mock gateway this simulates a checkout and then goes through the
 * REAL /api/payment/verify route, signature check included. That is the whole
 * point of the mock: the state machine exercised here is precisely the one
 * Razorpay will drive, so switching gateways touches the provider class and
 * nothing else.
 */
export function PaymentPanel({ amount, currency }: { amount: number; currency: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "creating" | "paying" | "verifying">("idle");

  const busy = stage !== "idle";

  async function pay() {
    setError(null);
    try {
      setStage("creating");
      const order = await apiPost<CreatedOrder>("/api/payment/create");

      if (order.gateway === "razorpay") {
        // Razorpay's checkout widget is loaded and opened here once the
        // credentials exist. Until then this branch is unreachable.
        setError("The payment gateway is not switched on yet. Please contact support.");
        setStage("idle");
        return;
      }

      setStage("paying");
      const simulated = await apiPost<{ paymentId: string; signature: string }>(
        "/api/payment/mock-checkout", { orderId: order.orderId },
      );

      setStage("verifying");
      await apiPost("/api/payment/verify", {
        paymentId: order.paymentId,
        gatewayPaymentId: simulated.paymentId,
        signature: simulated.signature,
      });

      router.replace("/status");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The payment could not be completed.");
      setStage("idle");
    }
  }

  const label =
    stage === "creating" ? "Starting…"
    : stage === "paying" ? "Processing payment…"
    : stage === "verifying" ? "Confirming…"
    : `Pay ₹${amount.toLocaleString("en-IN")}`;

  return (
    <div className="flex flex-col gap-5">
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="rounded-card border border-line bg-canvas p-6">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-muted">Registration fee</span>
          <span className="font-display text-3xl text-ink">
            ₹{amount.toLocaleString("en-IN")}
            <span className="ml-1 text-sm font-normal text-muted">{currency}</span>
          </span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          A one-time fee. Your profile goes to our verification team as soon as
          the payment succeeds.
        </p>
      </div>

      <Alert tone="warning" title="Test mode">
        No real payment gateway is connected yet, so this simulates a successful
        payment. No money is taken.
      </Alert>

      <Button size="lg" onClick={pay} disabled={busy}>
        <CreditCard className="h-4 w-4" aria-hidden />
        {label}
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        Every payment is verified on our servers before your profile advances.
      </p>
    </div>
  );
}
