
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy | Agarwal Milan Matrimony",
  description:
    "Review the payment, cancellation, and refund policy of Agarwal Milan Matrimony.",
};

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-16">
      <article className="mx-auto max-w-3xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-pink-600">
          Agarwal Milan Matrimony
        </p>

        <h1 className="mb-4 text-4xl font-bold text-[#35282D]">
          Refund & Cancellation Policy
        </h1>

        <p className="mb-8 text-sm text-gray-500">
          Last updated: 26 October 2026
        </p>

        <p className="mb-6 leading-8 text-gray-700">
          This policy explains how payment cancellation and refund requests
          are handled for services offered by Agarwal Milan Matrimony.
          Please read it before making a payment.
        </p>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#35282D]">
            1. Registration and Membership Fees
          </h2>
          <p className="leading-8 text-gray-700">
            Before paying, members should review the applicable registration
            fee, membership fee, service description, and any other charges
            displayed on the website. Payments should only be made after
            confirming the selected service and amount.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#35282D]">
            2. Refund Eligibility
          </h2>
          <p className="leading-8 text-gray-700">
            Refund requests will be reviewed individually in accordance
            with the service purchased, the circumstances of the request,
            the terms presented at checkout, and applicable law. Where a
            payment was duplicated, incorrectly collected, or made without
            authorization, please contact us promptly for investigation.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#35282D]">
            3. Non-Guaranteed Outcomes
          </h2>
          <p className="leading-8 text-gray-700">
            Fees are charged for the applicable platform services, not for
            a guaranteed match, acceptance of an interest, marriage, or
            any particular result. Dissatisfaction with matchmaking
            outcomes alone does not automatically establish refund
            eligibility. This does not affect any refund rights available
            under applicable law or any specific refund commitment made
            at the time of purchase.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#35282D]">
            4. How to Request a Refund
          </h2>
          <p className="leading-8 text-gray-700">
            To request a refund, contact us through our Contact page and
            provide your registered mobile number, transaction reference,
            payment date, amount, and reason for the request. Please do
            not send your password, OTP, or full payment-card details.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#35282D]">
            5. Review and Processing
          </h2>
          <p className="leading-8 text-gray-700">
            We will review the request and communicate the outcome. If a
            refund is approved, it will be processed through the payment
            method or payment provider's permitted process. The time for
            the refunded amount to appear in your account may depend on
            the bank or payment provider. Any specific processing
            timeline communicated at the time of purchase will apply.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#35282D]">
            6. Failed or Pending Payments
          </h2>
          <p className="leading-8 text-gray-700">
            If money has been debited but the website does not show a
            successful payment, please contact us with the transaction
            reference. We will check the payment status before determining
            whether a refund or other correction is required. Please avoid
            making repeated payments while the original transaction is
            being checked.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#35282D]">
            7. Cancellation Requests
          </h2>
          <p className="leading-8 text-gray-700">
            Members who wish to cancel a service or close an account may
            contact us. Cancellation of an account does not automatically
            mean that a payment is refundable. Any applicable refund will
            be assessed under this policy, the terms of purchase, and
            applicable law.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-[#35282D]">
            8. Contact Us
          </h2>
          <p className="leading-8 text-gray-700">
            For refund, cancellation, or payment-related questions, please
            visit our Contact page and include your transaction reference.
          </p>
        </section>
      </article>
    </main>
  );
}
