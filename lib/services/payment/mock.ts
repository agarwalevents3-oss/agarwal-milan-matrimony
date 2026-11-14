import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import type {
  CreateOrderInput, CreatedOrder, PaymentProvider, VerifyInput, VerifyResult, WebhookEvent,
} from "./types";

/**
 * Demo gateway (Website Improvements §6.3A). No money ever moves.
 *
 * Every demo transaction is identifiable in the payment records: gateway
 * "mock", order ids "mock_order_…", payment ids "mock_pay_…". Whether it may
 * be used at all is decided by demoPaymentsAllowed() in lib/env.ts, which
 * every demo code path checks.
 *
 * It deliberately imitates Razorpay's shape, including a real HMAC signature
 * over `orderId|paymentId`. That is not theatre: it means the verification code
 * path, the signature check and the failure branches are all genuinely
 * exercised now, so switching to Razorpay changes the secret and the endpoint,
 * not the logic.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  private secret() {
    // Reuses an existing server secret; the mock gateway needs no new credential.
    return env.secrets.registrationTicket;
  }

  private sign(orderId: string, paymentId: string) {
    return createHmac("sha256", this.secret()).update(`${orderId}|${paymentId}`).digest("hex");
  }

  async createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
    return {
      orderId: `mock_order_${randomUUID().replace(/-/g, "").slice(0, 14)}`,
      amountInPaise: input.amountInPaise,
      currency: input.currency,
    };
  }

  async verify({ orderId, paymentId, signature }: VerifyInput): Promise<VerifyResult> {
    const expected = this.sign(orderId, paymentId);
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature ?? "", "utf8");
    const ok = a.length === b.length && timingSafeEqual(a, b);
    return ok
      ? { ok: true, gatewayPaymentId: paymentId }
      : { ok: false, reason: "Signature mismatch" };
  }

  async parseWebhook(rawBody: string): Promise<WebhookEvent> {
    return { type: "mock", status: "IGNORED", raw: JSON.parse(rawBody || "{}") };
  }

  /** Test-only helper used by the mock checkout screen to produce a valid signature. */
  simulateCheckout(orderId: string) {
    const paymentId = `mock_pay_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
    return { paymentId, signature: this.sign(orderId, paymentId) };
  }
}
