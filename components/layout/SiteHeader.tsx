"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";

export function SiteHeader({ companyName }: { companyName: string }) {
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/", label: "Home" },
    { href: "/contact", label: "Contact" },
  ];

  const brandName = "Agarwal Enterprises";

  return (
    <header className="sticky top-0 z-40 border-b border-[#F0E1E5] bg-white/95 backdrop-blur-md">

      {/* =====================================================
          DESKTOP / MAIN HEADER
      ====================================================== */}

      <div className="container-page flex h-[86px] items-center justify-between gap-6">

        {/* =================================================
            BRAND
        ================================================== */}

        <Link
          href="/"
          className="group flex items-center gap-4"
          aria-label={brandName}
        >

          {/* LOGO */}
          <span className="flex h-[70px] w-[70px] shrink-0 items-center justify-center overflow-hidden">

            <img
              src="/agarwal-milan-logo.png"
              alt="Agarwal Milan Matrimony"
              className="h-[68px] w-[70px] object-contain transition-transform duration-300 group-hover:scale-105"
            />

          </span>


          {/* COMPANY NAME */}
          <span className="whitespace-nowrap font-display text-[22px] font-semibold leading-tight tracking-[-0.015em] text-[#35282D]">
            {brandName}
          </span>

        </Link>


        {/* =================================================
            DESKTOP NAV
        ================================================== */}

        <nav
          aria-label="Main"
          className="hidden items-center gap-3 md:flex"
        >

          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-6 py-3 text-[17px] font-medium text-[#62585D] transition-all duration-300 hover:bg-[#FFF0F4] hover:text-[#B94D6A]"
            >
              {link.label}
            </Link>
          ))}

        </nav>


        {/* =================================================
            DESKTOP ACTIONS
        ================================================== */}

        <div className="hidden items-center gap-3 md:flex">

          <ButtonLink
            href="/login"
            variant="secondary"
            size="sm"
            className="min-h-[46px] border-[#EBC7D1] px-7 text-[16px] font-semibold"
          >
            Login
          </ButtonLink>


          <ButtonLink
            href="/register"
            size="sm"
            className="min-h-[46px] px-7 text-[16px] font-semibold shadow-[0_8px_22px_rgba(185,77,106,0.20)]"
          >
            Register
          </ButtonLink>

        </div>


        {/* =================================================
            MOBILE MENU BUTTON
        ================================================== */}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="-mr-2 grid h-12 w-12 place-items-center rounded-full text-[#5E5559] transition-colors hover:bg-[#FFF0F4] hover:text-[#B94D6A] md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
        >

          {open ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}

        </button>

      </div>


      {/* =====================================================
          MOBILE NAV
      ====================================================== */}

      {open && (
        <div
          id="mobile-nav"
          className="border-t border-[#F0E1E5] bg-white md:hidden"
        >

          <nav
            aria-label="Main"
            className="container-page flex flex-col py-5"
          >

            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-5 py-4 text-[17px] font-medium text-[#62585D] transition-colors hover:bg-[#FFF0F4] hover:text-[#B94D6A]"
              >
                {link.label}
              </Link>
            ))}


            {/* MOBILE ACTIONS */}

            <div className="mt-4 flex flex-col gap-3 border-t border-[#F0E1E5] pt-5">

              <ButtonLink
                href="/login"
                variant="secondary"
                onClick={() => setOpen(false)}
                className="min-h-[48px] text-[16px] font-semibold"
              >
                Login
              </ButtonLink>


              <ButtonLink
                href="/register"
                onClick={() => setOpen(false)}
                className="min-h-[48px] text-[16px] font-semibold"
              >
                Register
              </ButtonLink>

            </div>

          </nav>

        </div>
      )}

    </header>
  );
}
