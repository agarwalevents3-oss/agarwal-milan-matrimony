import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Placeholder, Term, type LegalSection } from "@/components/legal/LegalPage";
import { getSiteContent } from "@/lib/services/content";
import {
  CONTACT_EMAIL_PLACEHOLDER, CONTACT_NUMBER_PLACEHOLDER,
  confirmedEmail, confirmedPhone, telHref,
} from "@/lib/utils/contact";

export const metadata: Metadata = {
  title: "Privacy Policy | Agarwal Milan Matrimony",
  description:
    "What personal information Agarwal Milan Matrimony collects, how it is used, and who can see it.",
};

/*
 * The footer links here (Website Improvements §2), so the page has to exist.
 * Every statement below describes how the website actually handles data;
 * legal and business terms that have not been confirmed are placeholders, so
 * no unsupported legal claim is published. Replace a placeholder once the
 * client confirms it.
 */
const LAST_UPDATED = "13 November 2026";
const RETENTION_PERIOD = "[DATA RETENTION PERIOD – TO BE CONFIRMED]";
const GRIEVANCE_OFFICER = "[GRIEVANCE OFFICER NAME AND CONTACT DETAILS – TO BE CONFIRMED]";

export default async function PrivacyPolicyPage() {
  const { contact } = await getSiteContent();
  const phone = confirmedPhone(contact.phone);
  const email = confirmedEmail(contact.email);

  const sections: LegalSection[] = [
    {
      heading: "Information We Collect",
      body: (
        <>
          <Term label="Account">
            Your mobile number (confirmed with a one-time code), email address and password. The
            password is stored only in hashed form; we never see or store it as you typed it.
          </Term>
          <Term label="Profile">
            Your name, gender, date of birth, and the personal, education, career, location,
            family and partner-preference details you provide.
          </Term>
          <Term label="Documents">
            Your profile photo, a copy of your Aadhaar (we ask for a masked copy), and an
            educational certificate if you choose to upload one.
          </Term>
          <Term label="Payments">
            The amount, status and transaction references of your payments. Card and bank details
            are entered with the payment gateway and are not stored by us.
          </Term>
          <Term label="Technical">
            Your IP address, used to protect the service against misuse and recorded as part of
            your Aadhaar consent.
          </Term>
        </>
      ),
    },
    {
      heading: "How We Use It",
      body: (
        <ul className="list-disc space-y-1 pl-6">
          <li>To create and secure your account and confirm your mobile number.</li>
          <li>To verify your profile and documents before your profile is shown to other members.</li>
          <li>To show your profile to other verified members, and to send and receive interests and matches.</li>
          <li>To process your membership payment and tell you about your account status.</li>
          <li>To respond when you contact us.</li>
        </ul>
      ),
    },
    {
      heading: "What Other Members Can See",
      body: (
        <>
          <p>
            Only verified members can see other profiles, and only once those profiles are
            verified. They can see your name, photo, age, profile details, city, state and partner
            preferences.
          </p>
          <p>
            Other members never see your mobile number, email address, full address, family
            details, Aadhaar or any document you upload. Profile pages show our official contact
            number instead of yours.
          </p>
        </>
      ),
    },
    {
      heading: "Aadhaar",
      body: (
        <p>
          Your Aadhaar is collected only with your consent, and we keep a record of the consent
          wording you accepted, when, and from which IP address. The Aadhaar number is not stored as
          a separate field. The document is kept in private storage that only our verification team
          can access, every view by the team is logged, and it cannot be changed once submitted.
        </p>
      ),
    },
    {
      heading: "Service Providers",
      body: (
        <p>
          We use third-party service providers to host the website and its database, store files,
          send verification codes by SMS and process payments.
        </p>
      ),
    },
    {
      heading: "How Long We Keep It",
      body: (
        <>
          <Term label="Retention period"><Placeholder>{RETENTION_PERIOD}</Placeholder></Term>
          <p>
            Registrations that are started but never submitted are deleted automatically after 14
            days, and one-time verification codes after 24 hours. When an account is deleted by our
            team, its photos and documents are deleted from storage.
          </p>
        </>
      ),
    },
    {
      heading: "Your Choices",
      body: (
        <>
          <p>
            You can update your profile details from your profile page at any time. To ask for a
            correction or for your account to be deleted, contact us (section 8).
          </p>
          <Term label="Grievance officer"><Placeholder>{GRIEVANCE_OFFICER}</Placeholder></Term>
        </>
      ),
    },
    {
      heading: "Contact Information",
      body: (
        <>
          <Term label="Contact number">
            {phone ? <a href={telHref(phone)} className="text-pink-700 underline">{phone}</a>
                   : <Placeholder>{CONTACT_NUMBER_PLACEHOLDER}</Placeholder>}
          </Term>
          <Term label="Email">
            {email ? <a href={`mailto:${email}`} className="text-pink-700 underline">{email}</a>
                   : <Placeholder>{CONTACT_EMAIL_PLACEHOLDER}</Placeholder>}
          </Term>
          <p>
            You can also reach us through our <Link href="/contact" className="text-pink-700 underline">Contact page</Link>.
          </p>
        </>
      ),
    },
  ];

  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      intro={
        <p>
          This policy explains what personal information Agarwal Milan Matrimony collects when you
          use this website, how it is used, and who can see it.
        </p>
      }
      sections={sections}
    />
  );
}
