import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Placeholder, Term, type LegalSection } from "@/components/legal/LegalPage";
import { getSiteContent } from "@/lib/services/content";
import { MEMBERSHIP_PLACEHOLDERS, MEMBERSHIP_START_RULE } from "@/lib/membership";
import {
  CONTACT_EMAIL_PLACEHOLDER, CONTACT_NUMBER_PLACEHOLDER,
  confirmedEmail, confirmedPhone, telHref,
} from "@/lib/utils/contact";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy | Agarwal Milan Matrimony",
  description:
    "How membership payments, failed or duplicate transactions, cancellations and refunds are handled at Agarwal Milan Matrimony.",
};

/*
 * ── Business terms awaiting client confirmation ─────────────────────────────
 * Website Improvements §5: nothing here may be invented. Each unconfirmed term
 * is one of these placeholders; replace the string once it is confirmed and
 * the page updates everywhere it is used. Statements outside this block
 * describe how the website actually behaves.
 */
const LAST_UPDATED = "13 November 2026";
const REFUND_TIMELINE = "[REFUND PROCESSING TIMELINE – TO BE CONFIRMED]";
const GATEWAY_CHARGES = "[PAYMENT GATEWAY CHARGE POLICY – TO BE CONFIRMED]";
const TRANSFERABILITY = "[MEMBERSHIP TRANSFERABILITY – TO BE CONFIRMED]";
const CANCELLATION_PERMITTED = "[WHETHER MEMBERSHIP CANCELLATION IS PERMITTED – TO BE CONFIRMED]";
const CANCELLATION_REFUND = "[WHETHER CANCELLATION QUALIFIES FOR A REFUND – TO BE CONFIRMED]";
const UNUSED_VALIDITY = "[TREATMENT OF UNUSED MEMBERSHIP VALIDITY – TO BE CONFIRMED]";
const BENEFITS_AFTER_CANCELLATION = "[MEMBERSHIP BENEFITS AFTER CANCELLATION – TO BE CONFIRMED]";

export default async function RefundPolicyPage() {
  const { contact } = await getSiteContent();
  const phone = confirmedPhone(contact.phone);
  const email = confirmedEmail(contact.email);

  const contactLine = (
    <>
      <Term label="Contact number">
        {phone ? <a href={telHref(phone)} className="text-pink-700 underline">{phone}</a>
               : <Placeholder>{CONTACT_NUMBER_PLACEHOLDER}</Placeholder>}
      </Term>
      <Term label="Email">
        {email ? <a href={`mailto:${email}`} className="text-pink-700 underline">{email}</a>
               : <Placeholder>{CONTACT_EMAIL_PLACEHOLDER}</Placeholder>}
      </Term>
    </>
  );

  const sections: LegalSection[] = [
    {
      heading: "Membership Payment Policy",
      body: (
        <>
          <Term label="Purchase">
            A membership is purchased online once your registration and documents have been
            submitted. Before you pay, the payment page shows the membership plan, its price,
            applicable taxes and charges, the total payable, its validity and its benefits, and
            you must accept our Terms &amp; Conditions and this policy.
          </Term>
          <Term label="Activation">
            A successful payment sends your profile to our verification team. {MEMBERSHIP_START_RULE}
          </Term>
          <Term label="Validity"><Placeholder>{MEMBERSHIP_PLACEHOLDERS.validity}</Placeholder></Term>
          <Term label="Transferability"><Placeholder>{TRANSFERABILITY}</Placeholder></Term>
          <Term label="Cancellation">See section 5, Membership Cancellation.</Term>
        </>
      ),
    },
    {
      heading: "Refund Eligibility",
      body: (
        <>
          <p>
            Refund requests are reviewed individually by our team. The following situations may
            be eligible for a refund, subject to verification against our payment records:
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Duplicate payments for the same membership.</li>
            <li>Technical payment failures.</li>
            <li>An amount debited from your account where the membership was not activated.</li>
            <li>Incorrect payment processing.</li>
            <li>Other cases approved by the company.</li>
          </ul>
        </>
      ),
    },
    {
      heading: "Duplicate Payments",
      body: (
        <>
          <Term label="How duplicates are identified">
            Every payment is recorded against your registration ID with its own transaction
            reference. If more than one successful payment is recorded for the same registration,
            it is flagged to our team. Your membership is activated only once, however many
            payments are received.
          </Term>
          <Term label="How payment records are verified">
            Our team checks the duplicate against our payment records and the payment
            gateway&apos;s records before a refund is decided.
          </Term>
          <Term label="How eligible duplicates are refunded"><Placeholder>{REFUND_TIMELINE}</Placeholder></Term>
          <Term label="Contacting support">
            Contact us (section 8) with your registration ID, registered mobile number, the
            transaction references, payment dates and amounts.
          </Term>
        </>
      ),
    },
    {
      heading: "Failed Transactions",
      body: (
        <>
          <Term label="Failed payments">
            If a payment fails, the payment page tells you that your last payment did not go
            through, and you can try again. A failed payment does not activate a membership.
          </Term>
          <Term label="Amount debited but confirmation not received">
            Please do not pay again straight away. A payment the gateway confirms is recorded
            automatically, which can take a short while. If it still does not appear, contact us
            with the transaction reference and we will check the payment status.
          </Term>
          <Term label="Transactions reported unsuccessful by the gateway">
            These are recorded as failed and do not activate a membership.
          </Term>
          <Term label="Successful payment, membership not yet active">
            This is expected while our team verifies your profile — your payment has been
            received. Your account shows that your profile is under verification until then.
          </Term>
        </>
      ),
    },
    {
      heading: "Membership Cancellation",
      body: (
        <>
          <Term label="Whether cancellation is permitted"><Placeholder>{CANCELLATION_PERMITTED}</Placeholder></Term>
          <Term label="Whether cancellation qualifies for a refund"><Placeholder>{CANCELLATION_REFUND}</Placeholder></Term>
          <Term label="Unused membership validity"><Placeholder>{UNUSED_VALIDITY}</Placeholder></Term>
          <Term label="Membership benefits after cancellation"><Placeholder>{BENEFITS_AFTER_CANCELLATION}</Placeholder></Term>
          <p>Members who wish to close their account can contact us (section 8).</p>
        </>
      ),
    },
    {
      heading: "Refund Processing Timeline",
      body: (
        <>
          <Term label="How to request a refund">
            Contact us (section 8) with your registration ID, registered mobile number,
            transaction reference, payment date, amount and the reason for your request. Never
            send your password, OTP or full card details.
          </Term>
          <Term label="How requests are reviewed">
            Our team checks the request against our payment records and this policy, and tells
            you the outcome.
          </Term>
          <Term label="When refunds are initiated"><Placeholder>{REFUND_TIMELINE}</Placeholder></Term>
          <Term label="When funds reflect in your account">
            <Placeholder>{REFUND_TIMELINE}</Placeholder> The time taken can also depend on your
            bank or payment provider.
          </Term>
        </>
      ),
    },
    {
      heading: "Payment Gateway Charges",
      body: (
        <>
          <p><Placeholder>{GATEWAY_CHARGES}</Placeholder></p>
          <p>Applicable taxes and charges are shown on the payment page before you pay.</p>
        </>
      ),
    },
    {
      heading: "Contact Information",
      body: (
        <>
          <p>For refund, cancellation or payment questions, please contact us:</p>
          {contactLine}
          <p>
            You can also reach us through our <Link href="/contact" className="text-pink-700 underline">Contact page</Link>.
          </p>
        </>
      ),
    },
  ];

  return (
    <LegalPage
      title="Refund & Cancellation Policy"
      lastUpdated={LAST_UPDATED}
      intro={
        <p>
          This policy explains how membership payments, failed or duplicate transactions,
          cancellations and refunds are handled at Agarwal Milan Matrimony. Please read it before
          making a payment.
        </p>
      }
      sections={sections}
    />
  );
}
