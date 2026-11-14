import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock, CircleDot, Phone } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import {
  STATUS_COPY, PROFILE_UNDER_VERIFICATION, needsPersonalDetails, PERSONAL_DETAILS_PATH,
} from "@/lib/auth/routing";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { getSiteContent } from "@/lib/services/content";
import {
  confirmedPhone, confirmedEmail, telHref,
  CONTACT_NUMBER_PLACEHOLDER, CONTACT_EMAIL_PLACEHOLDER,
} from "@/lib/utils/contact";

export const metadata: Metadata = { title: "Your status", robots: { index: false } };

/**
 * The holding screen for anyone who is signed in but cannot browse yet
 * (PRD §6.4, §7.2).
 *
 * Deliberately a real page rather than a redirect loop: a user awaiting
 * verification should be able to log in, see exactly where they are, and know
 * what happens next.
 */
export default async function StatusPage() {
  const user = await requireUser();

  // Checked here as well as in the layout: this is where a member lands
  // straight after paying, via a client-side navigation that does not
  // re-render the shared layout.
  if (needsPersonalDetails(user)) redirect(PERSONAL_DETAILS_PATH);
  if (user.registrationStatus === "VERIFIED") redirect("/dashboard");
  if (user.registrationStatus === "DRAFT") redirect("/register");
  if (["SUBMITTED", "PAYMENT_PENDING", "PAYMENT_FAILED"].includes(user.registrationStatus)) {
    redirect("/payment");
  }

  const copy = STATUS_COPY[user.registrationStatus];
  const { contact } = await getSiteContent();
  // Only a real, admin-entered number becomes a tel: link; the seeded
  // stand-in is replaced by a clearly marked placeholder.
  const phone = confirmedPhone(contact.phone);
  const email = confirmedEmail(contact.email);
  const underVerification =
    user.registrationStatus === "PENDING_VERIFICATION" ||
    user.registrationStatus === "PAYMENT_SUCCESS";

  const timeline = [
    { label: "Registration submitted", done: true },
    { label: "Payment successful", done: user.paymentStatus === "SUCCESS" },
    {
      label: "Verified by our team",
      done: false,
      current: user.registrationStatus === "PENDING_VERIFICATION",
    },
  ];

  return (
    <div className="container-page flex justify-center py-10 sm:py-16">
      <div className="w-full max-w-lg">
        <div className="rounded-card border border-line bg-surface p-7 shadow-soft sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Registration {user.registrationId}
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl">{copy.title}</h1>
          <p className="prose-body mt-3 text-sm">{copy.body}</p>

          {user.registrationStatus === "PENDING_VERIFICATION" && (
            <ol className="mt-8 space-y-4">
              {timeline.map((item) => (
                <li key={item.label} className="flex items-center gap-3 text-sm">
                  {item.done ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
                  ) : item.current ? (
                    <Clock className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                  ) : (
                    <CircleDot className="h-5 w-5 shrink-0 text-line" aria-hidden />
                  )}
                  <span className={item.done ? "text-muted" : "font-medium text-ink"}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {underVerification && (
            <div className="mt-8 rounded-card border border-primary-border bg-primary-soft p-5">
              <p className="text-sm text-body">{PROFILE_UNDER_VERIFICATION.help}</p>
              <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <Phone className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="font-medium text-ink">Contact Number:</span>
                {phone ? (
                  <a href={telHref(phone)} className="font-semibold text-primary underline-offset-4 hover:underline">
                    {phone}
                  </a>
                ) : (
                  <span className="font-semibold text-primary">{CONTACT_NUMBER_PLACEHOLDER}</span>
                )}
              </p>
            </div>
          )}

          {(user.registrationStatus === "REJECTED" ||
            user.registrationStatus === "SUSPENDED" ||
            user.registrationStatus === "DELETED") && (
            <div className="mt-6">
              <Alert tone="danger" title="Need help?">
                Call us on{" "}
                {phone ? (
                  <a href={telHref(phone)} className="font-medium underline">{phone}</a>
                ) : (
                  <span className="font-medium">{CONTACT_NUMBER_PLACEHOLDER}</span>
                )}{" "}
                or email{" "}
                {email ? (
                  <a href={`mailto:${email}`} className="font-medium underline">{email}</a>
                ) : (
                  <span className="font-medium">{CONTACT_EMAIL_PLACEHOLDER}</span>
                )}.
              </Alert>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/contact" variant="secondary">Contact us</ButtonLink>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-muted">
          <Link href="/" className="hover:text-primary">Back to the website</Link>
        </p>
      </div>
    </div>
  );
}
