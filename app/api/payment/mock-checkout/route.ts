import { z } from "zod";
import { route } from "@/lib/api/handler";
import { MockPaymentProvider } from "@/lib/services/payment";
import { env } from "@/lib/env";
import { forbidden } from "@/lib/utils/errors";

export const runtime = "nodejs";

/**
 * Stands in for the gateway's hosted checkout while PAYMENT_MODE=mock.
 *
 * It produces a genuine HMAC signature over the order, so /api/payment/verify
 * performs a real verification rather than a rubber stamp. The route refuses to
 * exist at all once a real gateway is configured.
 */
export const POST = route(
  { access: "user", schema: z.object({ orderId: z.string().min(1) }) },
  async ({ body }) => {
    if (env.payment.mode !== "mock") {
      throw forbidden("The test checkout is disabled when a real gateway is configured.");
    }
    const provider = new MockPaymentProvider();
    return { ok: true, ...provider.simulateCheckout(body.orderId) };
  },
);
