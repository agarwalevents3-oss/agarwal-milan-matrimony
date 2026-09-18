import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import type {
  CreateOrderInput, CreatedOrder, PaymentProvider, VerifyInput, VerifyResult, WebhookEvent,
} from "./types";

/**
 * Razorpay. Complete and ready; inert until PAYMENT_MODE=razorpay and the
 * credentials are present (PRD §20.2).
 *
 * Both signature checks are implemented the way Razorpay documents them:
 *   checkout — HMAC-SHA256 of `order_id|payment_id` keyed by KEY_SECRET
 *   webhook  — HMAC-SHA256 of the RAW request body keyed by WEBHOOK_SECRET
 * Both use a constant-time comparison.
 */
export class RazorpayProvider implements PaymentProvider {
  readonly name = "razorpay";

  private credentials() {
    const { keyId, keySecret } = env.payment.razorpay;
    if (!keyId || !keySecret) {
      throw new Error("PAYMENT_MODE=razorpay but RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set.");
    }
    return { keyId, keySecret };
  }

  private static safeEqual(expected: string, received: string) {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(received, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
    const { keyId, keySecret } = this.credentials();

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      },
      body: JSON.stringify({
        amount: input.amountInPaise,
        currency: input.currency,
        receipt: input.receipt,
        notes: input.notes,
      }),
    });

    if (!response.ok) {
      console.error("[payment:razorpay] order creation failed", response.status, await response.text());
      throw new Error("Could not start the payment. Please try again.");
    }

    const order = (await response.json()) as { id: string; amount: number; currency: string };
    return {
      orderId: order.id,
      amountInPaise: order.amount,
      currency: order.currency,
      publicKey: keyId, // publishable; the secret never leaves the server
    };
  }

  async verify({ orderId, paymentId, signature }: VerifyInput): Promise<VerifyResult> {
    const { keySecret } = this.credentials();
    const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
    return RazorpayProvider.safeEqual(expected, signature)
      ? { ok: true, gatewayPaymentId: paymentId }
      : { ok: false, reason: "Signature mismatch" };
  }

  async parseWebhook(rawBody: string, signature: string | null): Promise<WebhookEvent> {
    const secret = env.payment.razorpay.webhookSecret;
    if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET is not set.");
    if (!signature) return { type: "unsigned", status: "IGNORED", raw: null };

    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!RazorpayProvider.safeEqual(expected, signature)) {
      return { type: "invalid-signature", status: "IGNORED", raw: null };
    }

    const event = JSON.parse(rawBody) as {
      event: string;
      payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
    };
    const entity = event.payload?.payment?.entity;

    const status =
      event.event === "payment.captured" ? "SUCCESS"
      : event.event === "payment.failed" ? "FAILED"
      : "IGNORED";

    return { type: event.event, orderId: entity?.order_id, paymentId: entity?.id, status, raw: event };
  }
}
