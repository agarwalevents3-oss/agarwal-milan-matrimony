"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, CreditCard } from "lucide-react";
import { apiPost } from "@/lib/api/client";
import { BRAND_NAME } from "@/lib/utils/contact";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

interface CreatedOrder {
  paymentId: string; orderId: string; amount: number; amountInPaise: number;
  currency: string; gateway: string; publicKey: string | null;
}

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckout {
  open(): void;
  on(event: "payment.failed", handler: () => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout;
  }
}

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

/** Loads Razorpay Checkout once, on demand — never for demo payments. */
function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Payment (PRD §6, §20.2, Website Improvements §6.1E, §6.3).
 *
 * The member must tick the (initially unticked) policy checkbox before paying;
 * /api/payment/create checks it again. Whichever gateway is active, the result
 * goes through the same server-side /api/payment/verify — a success reported
 * by the browser is never enough on its own.
 *
 *   demo     — a simulated checkout signed by the server. No money moves, and
 *              the page says so.
 *   razorpay — Razorpay Checkout opened on the server-created order. Inert
 *              until PAYMENT_MODE=razorpay and the keys are configured.
 */
export function PaymentPanel({
  amountLabel, planName, demo, unavailableReason,
}: {
  /** Formatted total, or null when the price is not configured. */
  amountLabel: string | null;
  planName: string;
  demo: boolean;
  /** Set when payment cannot be taken right now. */
  unavailableReason: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [stage, setStage] = useState<"idle" | "creating" | "paying" | "verifying">("idle");

  const busy = stage !== "idle";
  const canPay = !unavailableReason && accepted && !busy;

  async function verifyAndContinue(paymentId: string, gatewayPaymentId: string, signature: string) {
    setStage("verifying");
    await apiPost("/api/payment/verify", { paymentId, gatewayPaymentId, signature });
    // /status sends a member with incomplete personal details to the
    // mandatory form first (Website Improvements §3).
    router.replace("/status");
    router.refresh();
  }

  function fail(e: unknown) {
    setError(e instanceof Error ? e.message : "The payment could not be completed.");
    setStage("idle");
  }

  async function payWithRazorpay(order: CreatedOrder) {
    if (!order.publicKey || !(await loadRazorpay()) || !window.Razorpay) {
      throw new Error("The payment window could not be opened. Please check your connection and try again.");
    }

    const checkout = new window.Razorpay({
      key: order.publicKey,
      order_id: order.orderId,
      amount: order.amountInPaise,
      currency: order.currency,
      name: BRAND_NAME,
      description: planName,
      theme: { color: "#C2255C" }, // --color-primary
      handler: (response: RazorpaySuccess) => {
        // The order id Razorpay echoes back is ignored: the server verifies
        // against the order it created and stored.
        verifyAndContinue(order.paymentId, response.razorpay_payment_id, response.razorpay_signature)
          .catch(fail);
      },
      modal: {
        ondismiss: () => {
          setNotice("The payment window was closed before the payment was completed. You can try again when you are ready.");
          setStage("idle");
        },
      },
    });
    checkout.on("payment.failed", () => {
      setError("The payment did not go through. You can try again, or use a different payment method.");
    });
    setStage("paying");
    checkout.open();
  }

  async function pay() {
    setError(null);
    setNotice(null);
    try {
      setStage("creating");
      const order = await apiPost<CreatedOrder>("/api/payment/create", { acceptedPolicies: true });

      if (order.gateway === "razorpay") {
        await payWithRazorpay(order);
        return;
      }

      setStage("paying");
      const simulated = await apiPost<{ paymentId: string; signature: string }>(
        "/api/payment/mock-checkout", { orderId: order.orderId },
      );
      await verifyAndContinue(order.paymentId, simulated.paymentId, simulated.signature);
    } catch (e) {
      fail(e);
    }
  }

  const label =
    stage === "creating" ? "Starting…"
    : stage === "paying" ? "Processing payment…"
    : stage === "verifying" ? "Confirming…"
    : amountLabel ? `Pay ${amountLabel}` : "Pay";

  return (
    <div className="flex flex-col gap-5">
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="info">{notice}</Alert>}

      {unavailableReason ? (
        <Alert tone="warning" title="Online payment is not available">
          {unavailableReason}
        </Alert>
      ) : demo ? (
        <Alert tone="warning" title="Test mode">
          No real payment gateway is connected yet, so this simulates a successful
          payment. No money is taken.
        </Alert>
      ) : null}

      <div className="rounded-card border border-line bg-canvas p-5 text-sm">
        <p className="font-medium text-ink">Payment conditions</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-body">
          <li>The price, validity, benefits and contact rules above apply to this membership.</li>
          <li>Your profile goes to our verification team once the payment is confirmed. Membership benefits begin only after our team verifies your profile.</li>
          <li>Refunds and cancellations are handled under our Refund &amp; Cancellation Policy.</li>
        </ul>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-4">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            disabled={busy}
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          />
          <span className="text-body">
            I have read and agree to the{" "}
            <a href="/terms" target="_blank" rel="noopener" className="font-medium text-primary underline underline-offset-2">
              Terms &amp; Conditions
            </a>{" "}
            and{" "}
            <a href="/refund-policy" target="_blank" rel="noopener" className="font-medium text-primary underline underline-offset-2">
              Refund &amp; Cancellation Policy
            </a>.
          </span>
        </label>
      </div>

      <Button size="lg" onClick={pay} disabled={!canPay}>
        <CreditCard className="h-4 w-4" aria-hidden />
        {label}
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Every payment is verified on our servers before your profile advances.
      </p>
    </div>
  );
}
