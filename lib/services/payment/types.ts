/**
 * The payment seam (PRD §20.2).
 *
 * The rest of the application talks only to this interface, so Razorpay can be
 * activated later without touching registration, verification or any table.
 * Crucially the MOCK provider goes through the same verify() step as the real
 * one — the state machine exercised in development is exactly the one Razorpay
 * will drive in production.
 */

export interface CreateOrderInput {
  amountInPaise: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface CreatedOrder {
  orderId: string;
  amountInPaise: number;
  currency: string;
  /** Publishable gateway key for the checkout widget. Never the secret. */
  publicKey?: string;
}

export interface VerifyInput {
  /** OUR stored order id — never the one the browser reports back. */
  orderId: string;
  paymentId: string;
  signature: string;
  /** What our payment record says was due, to check against the gateway. */
  expectedAmountInPaise: number;
  expectedCurrency: string;
}

export interface VerifyResult {
  ok: boolean;
  gatewayPaymentId?: string;
  reason?: string;
  /**
   * The gateway could not be asked (network, outage). Neither success nor
   * failure is proven, so the payment must NOT be marked failed — the webhook
   * settles it once the gateway reports.
   */
  inconclusive?: boolean;
}

export interface WebhookEvent {
  type: string;
  orderId?: string;
  paymentId?: string;
  status: "SUCCESS" | "FAILED" | "IGNORED";
  /** As reported by the gateway, checked against our record before confirming. */
  amountInPaise?: number;
  currency?: string;
  /** Gateway's failure description, stored on the payment row. */
  reason?: string;
  raw: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  createOrder(input: CreateOrderInput): Promise<CreatedOrder>;
  /** MUST be server-side. A client claiming success is never sufficient. */
  verify(input: VerifyInput): Promise<VerifyResult>;
  parseWebhook(rawBody: string, signature: string | null): Promise<WebhookEvent>;
}
