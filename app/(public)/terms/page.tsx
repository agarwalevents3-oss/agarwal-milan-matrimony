
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions | Agarwal Milan Matrimony",
  description:
    "Read the terms and conditions for using Agarwal Milan Matrimony.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-16">
      <article className="mx-auto max-w-3xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-pink-600">
          Agarwal Milan Matrimony
        </p>

        <h1 className="mb-4 text-4xl font-bold text-[#35282D]">
          Terms & Conditions
        </h1>

        <p className="mb-8 text-sm text-gray-500">
          Last updated: 26 October 2026
        </p>

        <p className="mb-6 leading-8 text-gray-700">
          Welcome to Agarwal Milan Matrimony. By accessing our website,
          creating an account, or using our services, you agree to these
          Terms & Conditions. Please read them carefully before proceeding.
        </p>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#35282D]">
            1. Eligibility and Registration
          </h2>
          <p className="leading-8 text-gray-700">
            You must provide accurate, current, and complete information
            during registration. You are responsible for maintaining the
            confidentiality of your login credentials and for activity
            conducted through your account. You must be legally eligible
            to use matrimonial services under applicable law.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#35282D]">
            2. Profile Information and Verification
          </h2>
          <p className="leading-8 text-gray-700">
            Members must provide truthful profile details and submit
            requested documents where required. We may review submitted
            information and documents for verification. Verification does
            not guarantee the accuracy of every detail or the identity,
            character, background, or intentions of another member.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#35282D]">
            3. Membership and Payments
          </h2>
          <p className="leading-8 text-gray-700">
            Certain services may require payment. Applicable fees, plan
            details, and payment conditions will be displayed before
            payment. Please review the details carefully before completing
            a transaction. A successful payment does not guarantee a match
            or a matrimonial outcome.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#35282D]">
            4. Acceptable Use
          </h2>
          <p className="leading-8 text-gray-700">
            You must not impersonate another person, provide misleading
            information, misuse another member&apos;s personal information,
            harass members, upload unlawful content, or attempt to access
            accounts or systems without authorization. You must use
            information obtained through the platform responsibly.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#35282D]">
            5. Privacy and Personal Information
          </h2>
          <p className="leading-8 text-gray-700">
            We process personal information to operate the platform,
            manage registrations, verify profiles, provide matchmaking
            services, and process payments. Sensitive documents, including
            identity documents, must be handled in accordance with our
            Privacy Policy and applicable law. Please review our Privacy
            Policy for further details.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#35282D]">
            6. Suspension and Termination
          </h2>
          <p className="leading-8 text-gray-700">
            We may restrict, suspend, or terminate access where reasonably
            necessary for suspected fraud, misuse, inaccurate information,
            security concerns, or violations of these terms, subject to
            applicable law. Members may contact us to request assistance
            with account-related issues.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#35282D]">
            7. Limitations of the Service
          </h2>
          <p className="leading-8 text-gray-700">
            We provide a platform for discovering matrimonial connections.
            We do not guarantee compatibility, acceptance of interests,
            marriage, or any particular outcome. Members should exercise
            their own judgment and appropriate caution when interacting
            with other people.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#35282D]">
            8. Changes to These Terms
          </h2>
          <p className="leading-8 text-gray-700">
            We may update these terms from time to time. Updated terms
            will be published on this page with a revised date where
            appropriate. Continued use of the service is subject to the
            applicable terms and law.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-[#35282D]">
            9. Contact Us
          </h2>
          <p className="leading-8 text-gray-700">
            For questions about these terms, please visit our Contact page.
          </p>
        </section>
      </article>
    </main>
  );
}
