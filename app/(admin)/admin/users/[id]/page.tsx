import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail } from "lucide-react";
import { getAdminUserDetail } from "@/lib/services/admin";
import { formatHeight, formatIncome } from "@/lib/utils/age";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, StatusBadge, PaymentBadge } from "@/components/ui/Badge";
import { ProfilePhoto } from "@/components/ui/ProfilePhoto";
import { DetailList } from "@/components/profile/DetailList";
import { DocumentViewer } from "@/components/admin/DocumentViewer";
import { MemberActions } from "@/components/admin/MemberActions";
import { Alert } from "@/components/ui/Alert";

export const metadata: Metadata = { title: "Member", robots: { index: false } };

const MARITAL_LABEL = {
  NEVER_MARRIED: "Never married", DIVORCED: "Divorced",
  WIDOWED: "Widowed", SEPARATED: "Separated",
} as const;

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

/** Complete member record (PRD §12.3). Read-only, plus the status actions. */
export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const member = await getAdminUserDetail(id);
  if (!member) notFound();

  const { profile, contact, address, family, preferences } = member;

  return (
    <div className="space-y-5">
      <Link
        href="/admin/registrations"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to registrations
      </Link>

      <div className="grid gap-5 lg:grid-cols-[20rem_1fr] lg:items-start">
        <div className="space-y-5 lg:sticky lg:top-24">
          <Card className="overflow-hidden">
            <ProfilePhoto src={profile.photoUrl} name={profile.fullName} size="detail" priority />
            <div className="p-5">
              <h1 className="font-display text-lg font-semibold text-ink">{profile.fullName}</h1>
              <p className="mt-1 font-mono text-xs text-muted">{member.registrationId}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge status={member.status} />
                <PaymentBadge status={member.paymentStatus} />
              </div>

              {/*
                The admin CAN see contact details — that is the whole point of
                the verification role. Other members never can.
              */}
              <dl className="mt-5 space-y-3 border-t border-line pt-4 text-sm">
                <div className="flex items-center gap-2">
                  <dt className="sr-only">Mobile</dt>
                  <Phone className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                  <dd><a href={`tel:${contact.mobile}`} className="hover:text-primary">{contact.mobile}</a></dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="sr-only">Email</dt>
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                  <dd className="min-w-0 break-all">
                    <a href={`mailto:${contact.email}`} className="hover:text-primary">{contact.email}</a>
                  </dd>
                </div>
              </dl>

              <dl className="mt-4 space-y-2 border-t border-line pt-4 text-xs text-muted">
                <div><dt className="inline font-medium">Registered: </dt><dd className="inline">{formatDateTime(member.createdAt)}</dd></div>
                {member.verifiedAt && (
                  <div><dt className="inline font-medium">Verified: </dt><dd className="inline">{formatDateTime(member.verifiedAt)}</dd></div>
                )}
              </dl>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          {member.rejectedReason && (
            <Alert tone="danger" title="Rejection reason recorded">{member.rejectedReason}</Alert>
          )}

          <Card>
            <CardHeader title="Actions" description="Verification and account status" />
            <div className="p-5 sm:p-6">
              <MemberActions
                userId={member.userId}
                status={member.status}
                paymentStatus={member.paymentStatus}
                name={profile.fullName}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Documents" description="Private — admin access only" />
            <div className="p-5 sm:p-6">
              <DocumentViewer documents={member.documents} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Personal" />
            <div className="p-5 sm:p-6">
              <DetailList
                items={[
                  { label: "Gender", value: profile.gender.charAt(0) + profile.gender.slice(1).toLowerCase() },
                  { label: "Age", value: profile.age !== null ? `${profile.age} years` : null },
                  { label: "Date of birth", value: profile.dob },
                  { label: "Height", value: profile.heightCm ? formatHeight(profile.heightCm) : null },
                  { label: "Marital status", value: profile.maritalStatus ? MARITAL_LABEL[profile.maritalStatus] : null },
                  { label: "Place of birth", value: profile.placeOfBirth },
                  { label: "Time of birth", value: profile.timeOfBirth },
                  { label: "Gotra", value: profile.gotra },
                  { label: "Subcaste", value: profile.subcaste },
                ]}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Education & career" />
            <div className="p-5 sm:p-6">
              <DetailList
                items={[
                  { label: "Qualification", value: profile.highestQualification },
                  { label: "Occupation", value: profile.occupation },
                  { label: "Company or business", value: profile.companyBusiness },
                  { label: "Annual income", value: profile.annualIncomeInr ? formatIncome(profile.annualIncomeInr) : null },
                ]}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Address" />
            <div className="p-5 sm:p-6">
              <DetailList
                items={[
                  { label: "Address", value: address?.line1 },
                  { label: "City", value: address?.city },
                  { label: "State", value: address?.state },
                  { label: "PIN code", value: address?.pincode },
                ]}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Family" />
            <div className="p-5 sm:p-6">
              <DetailList
                items={[
                  { label: "Father", value: family?.fatherName },
                  { label: "Mother", value: family?.motherName },
                  { label: "Native place", value: family?.native },
                  { label: "Siblings", value: family?.siblings },
                ]}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Partner preferences" />
            <div className="p-5 sm:p-6">
              <DetailList
                items={Object.entries(preferences ?? {}).map(([label, value]) => ({ label, value }))}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Payments" />
            {member.payments.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted sm:px-6">No payment has been attempted.</p>
            ) : (
              <ul className="divide-y divide-line">
                {member.payments.map((payment) => (
                  <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        ₹{payment.amount.toLocaleString("en-IN")} {payment.currency}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {payment.gateway === "mock" ? "Demo gateway" : payment.gateway}
                        {payment.gatewayPaymentId && ` · ${payment.gatewayPaymentId}`}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">{formatDateTime(payment.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Website Improvements §6.3: demo transactions must be
                          unmistakable — no money moved. */}
                      {payment.gateway === "mock" && <Badge tone="warning">Demo · no money received</Badge>}
                      <PaymentBadge status={payment.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
