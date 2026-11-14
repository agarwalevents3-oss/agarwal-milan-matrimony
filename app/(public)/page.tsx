import type { Metadata } from "next";
import {
  ShieldCheck,
  HeartHandshake,
  Lock,
  Sparkles,
  CheckCircle2,
  Heart,
  ArrowRight,
  Users,
  Gem,
  Flower2,
  Star,
  FileText,
  FileCheck,
  UserCheck,
  BadgeCheck,
  HeartHandshake as MatchHeart,
  MessageCircleHeart,
} from "lucide-react";

import { ButtonLink } from "@/components/ui/Button";
import { getSiteContent, getSiteImages } from "@/lib/services/content";
import { publicUrl, BUCKETS } from "@/lib/services/storage";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const { hero, contact } = await getSiteContent();

  return {
    title: `${contact.companyName || "Matrimony"} — ${hero.title}`,
    description: hero.subtitle,
    openGraph: {
      title: contact.companyName,
      description: hero.subtitle,
    },
  };
}

/*
 * VERIFIED UNSPLASH WEDDING IMAGES
 *
 * These are external images only.
 * Nothing is stored in Supabase.
 */
const IMAGES = {
  hero:
    "https://res.cloudinary.com/m7fmhqcu/image/upload/v1791283437/WhatsApp_Image_2026-10-06_at_3.54.53_PM.jpg" /*https://images.unsplash.com/photo-1735052712489-f45220126a0c?q=80&w=680&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D?auto=format&fit=crop&w=1800&q=90*/,

  couple:
    "https://res.cloudinary.com/m7fmhqcu/image/upload/v1791280002/WhatsApp_Image_2026-10-06_at_2.58.07_PM.jpg",

  wedding:
    "https://res.cloudinary.com/m7fmhqcu/image/upload/v1791280450/WhatsApp_Image_2026-10-06_at_2.58.06_PM.jpg?auto=format&fit=crop&w=1200&q=90",

  moment:
    "https://res.cloudinary.com/m7fmhqcu/image/upload/v1791280494/WhatsApp_Image_2026-10-06_at_2.58.52_PM_2.jpg?auto=format&fit=crop&w=1200&q=90",
};

const ICONS = [
  ShieldCheck,
  HeartHandshake,
  Lock,
  Sparkles,
];

export default async function HomePage() {
  const [{ hero, about, why_choose_us: why, cta }, images] =
    await Promise.all([
      getSiteContent(),
      getSiteImages(),
    ]);

  /*
   * EXISTING CMS FUNCTIONALITY
   *
   * If admin has uploaded a hero image,
   * continue using it.
   */
  const heroImage = images.find(
    (image) => image.slot === "hero"
  );

  const cmsHeroUrl = publicUrl(
    BUCKETS.siteAssets,
    heroImage?.storage_path
  );

  const heroUrl = cmsHeroUrl || IMAGES.hero;

  return (
    <>
      {/* =====================================================
          ANIMATIONS
      ====================================================== */}

      <style>{`
        @keyframes heroReveal {
          from {
            opacity: 0;
            transform: translateY(35px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes imageReveal {
          from {
            opacity: 0;
            transform: scale(0.94) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes floatSlow {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-12px) rotate(3deg);
          }
        }

        @keyframes floatHeart {
          0% {
            opacity: 0;
            transform: translateY(20px) scale(0.7);
          }
          30% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(-100px) scale(1.15);
          }
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        @keyframes pulseSoft {
          0%, 100% {
            transform: scale(1);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.08);
            opacity: 0.9;
          }
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(25px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .hero-reveal {
          animation: heroReveal 0.9s ease-out both;
        }

        .hero-reveal-delay {
          animation: heroReveal 0.9s 0.18s ease-out both;
        }

        .hero-image {
          animation: imageReveal 1.1s 0.1s ease-out both;
        }

        .float-slow {
          animation: floatSlow 5s ease-in-out infinite;
        }

        .pulse-soft {
          animation: pulseSoft 4s ease-in-out infinite;
        }

        .fade-up {
          animation: fadeUp 0.8s ease-out both;
        }

        .heart-float {
          animation: floatHeart 4s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-reveal,
          .hero-reveal-delay,
          .hero-image,
          .float-slow,
          .pulse-soft,
          .fade-up,
          .heart-float {
            animation: none !important;
          }
        }
      `}</style>

      {/* A <div>, not a second <main>: the public layout already wraps this
          page in the single main landmark. */}
      <div className="overflow-hidden bg-[#FFFDFC] text-[#35282D]">

        {/* =====================================================
            HERO
        ====================================================== */}

        <section className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-[#FFF7F8]">

          {/* Background blush */}
          <div
            aria-hidden
            className="absolute -left-40 -top-40 h-[550px] w-[550px] rounded-full bg-[#F3D5DD] opacity-70 blur-3xl"
          />

          {/* Background thyme */}
          <div
            aria-hidden
            className="absolute -bottom-40 -right-40 h-[550px] w-[550px] rounded-full bg-[#E5EAD8] opacity-70 blur-3xl"
          />

          {/* Decorative gold ring */}
          <div
            aria-hidden
            className="pulse-soft absolute right-[7%] top-[12%] hidden h-32 w-32 rounded-full border border-[#C9A75F]/40 lg:block"
          />

          {/* Floating hearts */}
          <div
            aria-hidden
            className="heart-float absolute left-[8%] top-[55%] text-primary/30"
          >
            <Heart className="h-5 w-5 fill-current" />
          </div>

          <div
            aria-hidden
            className="heart-float absolute left-[42%] top-[30%] text-primary/20"
            style={{ animationDelay: "1.5s" }}
          >
            <Heart className="h-4 w-4 fill-current" />
          </div>

          <div
            aria-hidden
            className="heart-float absolute right-[42%] top-[65%] text-[#C9A75F]/50"
            style={{ animationDelay: "2.2s" }}
          >
            <Heart className="h-4 w-4 fill-current" />
          </div>


          <div className="container-page relative grid min-h-[calc(100vh-64px)] gap-14 py-12 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:py-16">

            {/* =================================================
                LEFT CONTENT
            ================================================== */}

            <div className="relative z-10 max-w-xl">

              <div className="hero-reveal flex items-center gap-3">

                <span className="h-px w-10 bg-primary" />

                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-[#707956]">
                  Meaningful beginnings
                </span>

                <span className="h-px w-5 bg-[#C9A75F]" />

              </div>


              <h1 className="hero-reveal-delay mt-7 max-w-xl text-[3.2rem] font-semibold leading-[1.02] tracking-[-0.045em] text-[#35282D] sm:text-6xl lg:text-[4.6rem]">

                {hero.title}

              </h1>


              <div className="hero-reveal-delay mt-6 flex items-center gap-3">

                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#F3D5DD] text-primary">

                  <Heart className="h-4 w-4 fill-current" />

                </span>

                <span className="h-px w-16 bg-[#E5BBC6]" />

                <span className="text-xs font-medium text-[#707956]">
                  Rooted in values • Made for families
                </span>

              </div>


              <p className="hero-reveal-delay mt-7 max-w-lg text-base leading-8 text-[#6F6368] sm:text-lg">

                {hero.subtitle}

              </p>


              <div className="hero-reveal-delay mt-9 flex flex-col gap-3 sm:flex-row">

                <ButtonLink
                  href="/register"
                  size="lg"
                  className="group shadow-[0_12px_30px_rgba(181,72,103,0.20)]"
                >

                  {hero.ctaPrimary}

                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />

                </ButtonLink>


                <ButtonLink
                  href="/login"
                  size="lg"
                  variant="secondary"
                >

                  {hero.ctaSecondary}

                </ButtonLink>

              </div>


              <div className="hero-reveal-delay mt-9 flex flex-wrap gap-x-6 gap-y-3">

                <span className="flex items-center gap-2 text-xs font-medium text-[#665B60]">

                  <CheckCircle2 className="h-4 w-4 text-[#707956]" />

                  Verified profiles

                </span>


                <span className="flex items-center gap-2 text-xs font-medium text-[#665B60]">

                  <Lock className="h-4 w-4 text-[#707956]" />

                  Privacy protected

                </span>


                <span className="flex items-center gap-2 text-xs font-medium text-[#665B60]">

                  <Heart className="h-4 w-4 text-primary" />

                  Family focused

                </span>

              </div>

            </div>


            {/* =================================================
                HERO IMAGE
            ================================================== */}

            <div className="hero-image relative z-10 mx-auto w-full max-w-[650px] lg:ml-auto">

              {/* Gold ring */}
              <div
                aria-hidden
                className="float-slow absolute -right-8 -top-8 h-32 w-32 rounded-full border border-[#C9A75F]/50"
              />


              {/* Thyme backing */}
              <div
                aria-hidden
                className="absolute -bottom-6 -left-6 h-full w-full rounded-[42px] bg-[#E5EAD8]"
              />


              {/* Image */}
              <div className="relative overflow-hidden rounded-[40px] border-[7px] border-white bg-[#E9E2E4] shadow-[0_35px_90px_rgba(70,45,55,0.22)]">

                <img
                  src={heroUrl}
                  alt={
                    heroImage?.alt_text ||
                    "Indian wedding couple"
                  }
                  fetchPriority="high"
                  className="h-[560px] w-full object-cover object-center transition duration-700 hover:scale-[1.03] sm:h-[650px]"
                />


                {/* Dark bottom gradient */}
                <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#21191C]/75 via-[#21191C]/20 to-transparent" />


                {/* Text on image */}
                <div className="absolute bottom-7 left-7 right-7">

                  <div className="flex items-end justify-between">

                    <div>

                      <p className="text-sm text-white/80">
                        Where two stories become one
                      </p>

                      <p className="mt-1 font-display text-3xl text-white">
                        Begin yours.
                      </p>

                    </div>


                    <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-primary shadow-xl">

                      <Heart className="h-5 w-5 fill-current" />

                    </span>

                  </div>

                </div>

              </div>


              {/* Verified card */}
              <div className="float-slow absolute -bottom-7 left-5 rounded-2xl border border-[#E7DDE0] bg-white px-5 py-4 shadow-[0_15px_40px_rgba(60,40,48,0.16)] sm:left-8">

                <div className="flex items-center gap-3">

                  <span className="grid h-11 w-11 place-items-center rounded-full bg-[#F6E3E8] text-primary">

                    <ShieldCheck className="h-5 w-5" />

                  </span>

                  <div>

                    <p className="text-xs font-bold text-[#34272C]">
                      Verified with care
                    </p>

                    <p className="mt-1 text-[11px] text-[#7B7074]">
                      Profiles reviewed by our team
                    </p>

                  </div>

                </div>

              </div>


              {/* Traditional badge */}
              <div className="absolute right-[-10px] top-16 hidden rounded-full border border-[#DCCB9B] bg-white px-4 py-3 shadow-lg sm:block">

                <div className="flex items-center gap-2">

                  <Flower2 className="h-4 w-4 text-[#707956]" />

                  <span className="text-xs font-semibold text-[#5F585B]">
                    Tradition & trust
                  </span>

                </div>

              </div>

            </div>

          </div>

        </section>


        {/* =====================================================
            ROMANTIC INTRO
        ====================================================== */}

       <section className="relative overflow-hidden bg-white py-20 sm:py-24">

  {/* Soft background decorations */}
  <div
    aria-hidden
    className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-[#F3D5DD]/50 blur-3xl"
  />

  <div
    aria-hidden
    className="absolute -right-32 bottom-10 h-80 w-80 rounded-full bg-[#E5EAD8]/60 blur-3xl"
  />

  <div className="container-page relative">

    {/* Section heading */}
    <div className="mx-auto max-w-3xl text-center">

      <div className="flex items-center justify-center gap-3">

        <span className="h-px w-10 bg-[#C9A75F]" />

        <span className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
          Our matchmaking journey
        </span>

        <span className="h-px w-10 bg-[#C9A75F]" />

      </div>

      <h2 className="mt-5 font-display text-4xl leading-tight text-[#35282D] sm:text-5xl">
        How Agarwal Milan
        <span className="text-primary"> brings you closer</span>
      </h2>

      <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[#75696D] sm:text-base">
        From registration to meaningful connections, every profile goes
        through a thoughtful process designed with trust, verification
        and family values at its heart.
      </p>

    </div>


    {/* Decorative divider */}
    <div className="mx-auto mt-8 flex items-center justify-center gap-3">

      <span className="h-px w-14 bg-[#E9CBD2]" />

      <Heart className="h-4 w-4 fill-primary text-primary" />

      <span className="h-px w-14 bg-[#E9CBD2]" />

    </div>


    {/* =================================================
        PROCESS CARDS
    ================================================== */}

    <div className="relative mt-16">

      {/* Connecting line - desktop */}
      <div
        aria-hidden
        className="absolute left-[8%] right-[8%] top-[45px] hidden h-px bg-gradient-to-r from-[#E8C4CE] via-[#C9A75F] to-[#E8C4CE] lg:block"
      />


      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-6 lg:gap-5">

        {[
          {
            number: "01",
            icon: FileText,
            title: "Fill Registration Form",
            body: "Share your basic details, preferences and expectations with us.",
          },
          {
            number: "02",
            icon: FileCheck,
            title: "Submit Documents",
            body: "Provide the necessary documents for profile verification.",
          },
          {
            number: "03",
            icon: UserCheck,
            title: "Profile Verification",
            body: "Our team carefully reviews each profile for authenticity and credibility.",
          },
          {
            number: "04",
            icon: BadgeCheck,
            title: "Profile Activation",
            body: "Once verified, your profile is activated and made visible to suitable matches.",
          },
          {
            number: "05",
            icon: MatchHeart,
            title: "Receive Matches",
            body: "We share personalised matches based on your preferences and family values.",
          },
          {
            number: "06",
            icon: MessageCircleHeart,
            title: "Connect & Proceed",
            body: "Show interest, connect with verified profiles and take the next step towards a happy future.",
          },
        ].map((step, index) => {

          const Icon = step.icon;

          return (
            <div
              key={step.number}
              className="fade-up group relative text-center"
              style={{
                animationDelay: `${index * 0.12}s`,
              }}
            >

              {/* Number + icon */}
              <div className="relative z-10 mx-auto w-fit">

                <div
                  className={`grid h-[90px] w-[90px] place-items-center rounded-full border-[7px] bg-white shadow-[0_12px_35px_rgba(80,45,58,0.12)] transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_18px_45px_rgba(80,45,58,0.18)] ${
                    index === 1 || index === 3
                      ? "border-[#EFF2E7]"
                      : "border-[#FFF0F3]"
                  }`}
                >

                  <span
                    className={`grid h-[68px] w-[68px] place-items-center rounded-full transition-transform duration-500 group-hover:scale-110 ${
                      index === 1 || index === 3
                        ? "bg-[#707956] text-white"
                        : "bg-[#B94D6A] text-white"
                    }`}
                  >

                    <Icon className="h-7 w-7" />

                  </span>

                </div>


                {/* Step number */}
                <span className="absolute -right-3 -top-2 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[#C9A75F] text-[10px] font-bold text-white shadow-md">
                  {step.number}
                </span>

              </div>


              {/* Arrow between steps */}
              {index < 5 && (
                <div
                  aria-hidden
                  className="absolute -right-7 top-[42px] z-20 hidden text-[#B94D6A] lg:block"
                >
                  <ArrowRight className="h-5 w-5" />
                </div>
              )}


              {/* Text */}
              <div className="mx-auto mt-6 max-w-[190px]">

                <h3 className="text-sm font-bold leading-5 text-[#35282D] transition-colors duration-300 group-hover:text-primary">
                  {step.title}
                </h3>

                <p className="mt-3 text-xs leading-6 text-[#75696D]">
                  {step.body}
                </p>

              </div>

            </div>
          );

        })}

      </div>

    </div>


    {/* =================================================
        BOTTOM TRUST MESSAGE
    ================================================== */}

    <div className="mx-auto mt-16 max-w-4xl">

      <div className="relative overflow-hidden rounded-[28px] border border-[#EAD9DE] bg-[#FFF7F8] px-6 py-7 shadow-[0_15px_45px_rgba(80,45,58,0.07)] sm:px-10">

        {/* Decorative circle */}
        <div
          aria-hidden
          className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#F3D5DD]/60"
        />

        <div className="relative flex flex-col items-center justify-center gap-5 text-center sm:flex-row sm:text-left">

          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#F3D5DD] text-primary">

            <Heart className="h-6 w-6 fill-current" />

          </span>

          <div>

            <p className="text-sm font-bold text-[#35282D]">
              A journey built around trust, tradition & meaningful relationships
            </p>

            <p className="mt-1 text-xs leading-6 text-[#75696D]">
              Every step is handled with care so that you and your family
              can move forward with confidence.
            </p>

          </div>

        </div>

      </div>

    </div>

  </div>

</section>

        {/* =====================================================
            PHOTO COLLAGE
        ====================================================== */}

        <section className="bg-[#FFF1F4] py-20 sm:py-24">

          <div className="container-page">

            <div className="grid gap-8 lg:grid-cols-12 lg:items-center">

              {/* Text */}
              <div className="lg:col-span-4">

                <span className="text-xs font-bold uppercase tracking-[0.22em] text-[#707956]">
                  Your story starts here
                </span>

                <h2 className="mt-5 font-display text-4xl leading-tight sm:text-5xl">

                  Not just finding someone.

                  <span className="mt-2 block text-primary">
                    Finding your person.
                  </span>

                </h2>

                <p className="mt-6 text-sm leading-7 text-[#75696D]">
                  Explore thoughtfully created profiles, express interest
                  and let meaningful connections unfold naturally.
                </p>


                <div className="mt-8">

                  <ButtonLink
                    href="/register"
                    size="lg"
                  >
                    Start your journey
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </ButtonLink>

                </div>

              </div>


              {/* Photos */}
              <div className="grid gap-4 sm:grid-cols-2 lg:col-span-8">

                <div className="group relative overflow-hidden rounded-[30px] sm:row-span-2">

                  <img
                    src={IMAGES.couple}
                    alt="Wedding couple"
                    className="h-[560px] w-full object-cover transition duration-700 group-hover:scale-105"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

                  <div className="absolute bottom-6 left-6 text-white">

                    <p className="text-xs uppercase tracking-[0.2em] text-white/70">
                      Together
                    </p>

                    <p className="mt-1 font-display text-2xl">
                      Two journeys.
                    </p>

                  </div>

                </div>


                <div className="group relative overflow-hidden rounded-[30px]">

                  <img
                    src={IMAGES.wedding}
                    alt="Indian wedding celebration"
                    className="h-[270px] w-full object-cover transition duration-700 group-hover:scale-105"
                  />

                  <div className="absolute bottom-5 left-5 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-primary">
                    Tradition
                  </div>

                </div>


                <div className="group relative overflow-hidden rounded-[30px]">

                  <img
                    src={IMAGES.moment}
                    alt="Wedding moment"
                    className="h-[270px] w-full object-cover transition duration-700 group-hover:scale-105"
                  />

                  <div className="absolute bottom-5 left-5 flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-[#53484D]">

                    <Heart className="h-3.5 w-3.5 fill-primary text-primary" />

                    New beginnings

                  </div>

                </div>

              </div>

            </div>

          </div>

        </section>


        {/* =====================================================
            HOW IT WORKS
        ====================================================== */}

        {/* =====================================================
    AGARWAL MILAN PROCESS
====================================================== */}



        {/* =====================================================
            WHY US
        ====================================================== */}

        {why.items.length > 0 && (
          <section className="bg-[#F3F5ED] py-20 sm:py-24">

            <div className="container-page">

              <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">

                <div>

                  <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[#687050]">

                    <Gem className="h-4 w-4" />

                    Why families trust us

                  </span>

                  <h2 className="mt-5 font-display text-4xl leading-tight sm:text-5xl">
                    Trust should be part of every connection.
                  </h2>

                  <p className="mt-5 max-w-md text-sm leading-7 text-[#756D69]">
                    A thoughtful experience designed around privacy,
                    verification and meaningful relationships.
                  </p>

                </div>


                <ul className="grid gap-4 sm:grid-cols-2">

                  {why.items.map((item, index) => {

                    const Icon = ICONS[index % ICONS.length];

                    return (
                      <li
                        key={item.title}
                        className="group rounded-[24px] border border-[#DFE3D5] bg-white p-6 transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                      >

                        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#EFF2E7] text-[#687050]">

                          <Icon className="h-5 w-5" />

                        </span>

                        <h3 className="mt-5 text-base font-semibold">
                          {item.title}
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-[#756D69]">
                          {item.body}
                        </p>

                      </li>
                    );

                  })}

                </ul>

              </div>

            </div>

          </section>
        )}


        {/* =====================================================
            FINAL CTA
        ====================================================== */}

        <section className="bg-white px-4 py-20 sm:py-28">

          <div className="container-page">

            <div className="relative overflow-hidden rounded-[40px] bg-[#B94D6A] px-6 py-16 text-center shadow-[0_30px_80px_rgba(170,65,95,0.22)] sm:px-12 sm:py-20">

              <div
                aria-hidden
                className="absolute -left-28 -top-28 h-72 w-72 rounded-full bg-white/10"
              />

              <div
                aria-hidden
                className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-[#707956]/25"
              />

              <div className="relative mx-auto max-w-2xl">

                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/15 text-white">

                  <Heart className="h-7 w-7 fill-current" />

                </span>

                <h2 className="mt-7 font-display text-4xl leading-tight text-white sm:text-5xl">
                  {cta.title}
                </h2>

                {cta.subtitle && (
                  <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/80 sm:text-base">
                    {cta.subtitle}
                  </p>
                )}

                <div className="mt-9">

                  <ButtonLink
                    href="/register"
                    size="lg"
                    className="bg-white px-8 text-primary shadow-lg hover:bg-[#FFF3F5]"
                  >

                    {cta.button}

                    <ArrowRight className="ml-2 h-4 w-4" />

                  </ButtonLink>

                </div>

                <div className="mt-6 flex items-center justify-center gap-2 text-xs text-white/60">

                  <Star className="h-3 w-3 fill-current" />

                  Begin with trust. Connect with intention.

                  <Star className="h-3 w-3 fill-current" />

                </div>

              </div>

            </div>

          </div>

        </section>

      </div>

      {/* The footer — legal and information links included — is the shared
          SiteFooter rendered by the public layout (Website Improvements §2). */}
    </>
  );
}
