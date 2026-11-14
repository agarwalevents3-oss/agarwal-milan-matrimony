import { z } from "zod";
import { route } from "@/lib/api/handler";
import { MockPaymentProvider } from "@/lib/services/payment";
import { demoPaymentsAllowed } from "@/lib/env";
import { forbidden } from "@/lib/utils/errors";

export const runtime = "nodejs";

/**
 * Stands in for the gateway's hosted checkout while PAYMENT_MODE=mock.
 *
 * It produces a genuine HMAC signature over the order, so /api/payment/verify
 * performs a real verification rather than a rubber stamp. It refuses to run
 * once a real gateway is configured, and on the production deployment when
 * DEMO_PAYMENTS_IN_PRODUCTION=block (Website Improvements §6.3A).
 */
export const POST = route(
  { access: "user", schema: z.object({ orderId: z.string().min(1) }) },
  async ({ body }) => {
    if (!demoPaymentsAllowed()) {
      throw forbidden("The test checkout is not available.");
    }
    const provider = new MockPaymentProvider();
    return { ok: true, ...provider.simulateCheckout(body.orderId) };
  },
);
