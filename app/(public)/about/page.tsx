
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us | Agarwal Milan Matrimony",
  description:
    "Learn about Agarwal Milan Matrimony and our approach to helping people find meaningful matrimonial connections.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-16">
      <article className="mx-auto max-w-3xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-pink-600">
          Agarwal Milan Matrimony
        </p>

        <h1 className="mb-6 text-4xl font-bold text-[#35282D]">
          About Us
        </h1>

        <p className="mb-5 leading-8 text-gray-700">
          Agarwal Milan Matrimony is a matrimonial platform designed to help
          individuals and families discover meaningful matrimonial connections.
        </p>

        <p className="mb-5 leading-8 text-gray-700">
          Our platform allows members to create profiles, submit required
          information for verification, explore eligible profiles, and express
          interest in potential matches.
        </p>

        <p className="mb-5 leading-8 text-gray-700">
          We encourage members to provide accurate information and exercise
          care when communicating with other members. Profile verification
          does not guarantee a person's identity, background, or intentions.
        </p>

        <h2 className="mb-3 mt-8 text-xl font-semibold text-[#35282D]">
          Contact Us
        </h2>

        <p className="leading-8 text-gray-700">
          For questions about our services, registration, or payments, please
          visit our Contact page.
        </p>
      </article>
    </main>
  );
}
