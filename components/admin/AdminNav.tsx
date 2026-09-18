"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ClipboardList, Heart, Sparkles,
  FileText, HelpCircle, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/registrations", label: "Registrations", icon: ClipboardList },
  { href: "/admin/interests", label: "Interests", icon: Heart },
  { href: "/admin/matches", label: "Matches", icon: Sparkles },
  { href: "/admin/content", label: "Website content", icon: FileText },
  { href: "/admin/faqs", label: "FAQs", icon: HelpCircle },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

/**
 * Admin navigation. A sidebar on desktop where the operational work happens,
 * and a horizontally scrolling strip on smaller screens (PRD §24).
 */
export function AdminNav() {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="Admin sections" className="lg:sticky lg:top-24">
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        {LINKS.map(({ href, label, icon: Icon, exact }) => (
          <li key={href} className="shrink-0 lg:shrink">
            <Link
              href={href}
              aria-current={isActive(href, exact) ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium transition-colors lg:rounded-xl",
                isActive(href, exact)
                  ? "bg-primary text-white"
                  : "text-body hover:bg-primary-soft hover:text-primary",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
