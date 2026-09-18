import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";

/**
 * Public website content (PRD §13).
 *
 * Content is database-driven so the admin can edit copy without a redeploy, and
 * cached with a tag so an edit invalidates instantly rather than waiting out a
 * timer. Net effect: the marketing pages are static-fast and cost effectively
 * nothing to serve, while still being editable.
 */

export const CONTENT_TAG = "site-content";

export interface HeroContent    { title: string; subtitle: string; ctaPrimary: string; ctaSecondary: string }
export interface AboutContent   { title: string; body: string }
export interface WhyUsContent   { title: string; items: { title: string; body: string }[] }
export interface CtaContent     { title: string; subtitle: string; button: string }
export interface ContactContent { companyName: string; phone: string; email: string; address: string; hours?: string }
export interface FooterContent  { tagline: string; copyright: string }

export interface SiteContent {
  hero: HeroContent;
  about: AboutContent;
  why_choose_us: WhyUsContent;
  cta: CtaContent;
  contact: ContactContent;
  footer: FooterContent;
}

/** Rendered if the database is unreachable, so the site never shows an error page. */
const FALLBACK: SiteContent = {
  hero: { title: "Find the one who feels like home", subtitle: "A considered, private matrimonial service.", ctaPrimary: "Register free", ctaSecondary: "Login" },
  about: { title: "About us", body: "" },
  why_choose_us: { title: "Why choose us", items: [] },
  cta: { title: "Begin your search today", subtitle: "", button: "Create your profile" },
  contact: { companyName: "", phone: "", email: "", address: "" },
  footer: { tagline: "", copyright: "All rights reserved." },
};

export const getSiteContent = unstable_cache(
  async (): Promise<SiteContent> => {
    const supabase = createAnonClient();
    const { data, error } = await supabase.from("site_content").select("key, value");

    if (error || !data) {
      console.error("[content] could not load site content", error);
      return FALLBACK;
    }

    const byKey = Object.fromEntries(data.map((row) => [row.key, row.value]));
    return { ...FALLBACK, ...byKey } as SiteContent;
  },
  ["site-content"],
  { tags: [CONTENT_TAG], revalidate: 3600 },
);

export const getFaqs = unstable_cache(
  async () => {
    const supabase = createAnonClient();
    const { data } = await supabase
      .from("faqs")
      .select("id, question, answer")
      .eq("is_active", true)
      .order("sort_order");
    return data ?? [];
  },
  ["faqs"],
  { tags: [CONTENT_TAG], revalidate: 3600 },
);

export const getSiteImages = unstable_cache(
  async () => {
    const supabase = createAnonClient();
    const { data } = await supabase
      .from("site_images")
      .select("id, slot, storage_path, alt_text")
      .eq("is_active", true)
      .order("sort_order");
    return data ?? [];
  },
  ["site-images"],
  { tags: [CONTENT_TAG], revalidate: 3600 },
);
