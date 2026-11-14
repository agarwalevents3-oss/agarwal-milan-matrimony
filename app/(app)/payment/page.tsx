import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getMembershipPlan, paymentAvailability } from "@/lib/services/membership";
import { formatPrice } from "@/lib/membership";
import { MembershipSummary } from "./MembershipSummary";
import { PaymentPanel } from "./PaymentPanel";
import { Alert } from "@/components/ui/Alert";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

/**
 * Payment screen (PRD §6.1, Website Improvements §6.1).
 *
 * Before checkout the member sees the plan, its price split into fee, taxes
 * and total, validity, benefits, contact-visibility rules and the payment
 * conditions, and must accept the Terms and the Refund & Cancellation Policy.
 * The price comes from the same function /api/payment/create charges from, so
 * what is shown is what is charged.
 *
 * Only reachable while a payment is actually due.
 */
export default async function PaymentPage() {
  const user = await requireUser();

  if (user.registrationStatus === "DRAFT") redirect("/register");
  if (!["SUBMITTED", "PAYMENT_PENDING", "PAYMENT_FAILED"].includes(user.registrationStatus)) {
    redirect("/status");
  }

  const plan = await getMembershipPlan();
  const availability = paymentAvailability(plan);

  return (
    <div className="container-page flex justify-center py-10 sm:py-16">
      <div className="w-full max-w-2xl">
        <div className="rounded-card border border-line bg-surface p-6 shadow-soft sm:p-9">
          <h1 className="text-2xl sm:text-3xl">Complete your registration</h1>
          <p className="mt-2 text-sm text-muted">
            Registration <span className="font-mono text-ink">{user.registrationId}</span>
          </p>

          {user.registrationStatus === "PAYMENT_FAILED" && (
            <div className="mt-5">
              <Alert tone="danger" title="Your last payment did not go through">
                Please try again.
              </Alert>
            </div>
          )}

          <div className="mt-7">
            <MembershipSummary plan={plan} />
          </div>

          <div className="mt-7">
            <PaymentPanel
              amountLabel={plan.price ? formatPrice(plan.price) : null}
              planName={plan.name}
              demo={availability.demo}
              unavailableReason={availability.available ? null : availability.reason}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
