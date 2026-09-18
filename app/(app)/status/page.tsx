import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock, CircleDot } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { STATUS_COPY } from "@/lib/auth/routing";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { getSiteContent } from "@/lib/services/content";

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

  if (user.registrationStatus === "VERIFIED") redirect("/dashboard");
  if (user.registrationStatus === "DRAFT") redirect("/register");
  if (["SUBMITTED", "PAYMENT_PENDING", "PAYMENT_FAILED"].includes(user.registrationStatus)) {
    redirect("/payment");
  }

  const copy = STATUS_COPY[user.registrationStatus];
  const { contact } = await getSiteContent();

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

          {(user.registrationStatus === "REJECTED" ||
            user.registrationStatus === "SUSPENDED" ||
            user.registrationStatus === "DELETED") && (
            <div className="mt-6">
              <Alert tone="danger" title="Need help?">
                Call us on{" "}
                <a href={`tel:${contact.phone?.replace(/\s/g, "")}`} className="font-medium underline">
                  {contact.phone}
                </a>{" "}
                or email{" "}
                <a href={`mailto:${contact.email}`} className="font-medium underline">
                  {contact.email}
                </a>.
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
