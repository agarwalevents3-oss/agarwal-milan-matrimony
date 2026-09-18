import "server-only";

import { env } from "@/lib/env";
import { MockPaymentProvider } from "./mock";
import { RazorpayProvider } from "./razorpay";
import type { PaymentProvider } from "./types";

export * from "./types";
export { MockPaymentProvider } from "./mock";

let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (!cached) {
    cached = env.payment.mode === "razorpay"
      ? new RazorpayProvider()
      : new MockPaymentProvider();
  }
  return cached;
}
