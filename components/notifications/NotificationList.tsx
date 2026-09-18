"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell, Heart, CheckCircle2, XCircle,
  CreditCard, ShieldCheck, Sparkles, UserPlus,
} from "lucide-react";
import { apiPost } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import type { NotificationItem } from "@/lib/services/engagement";
import type { Enums } from "@/types/database";

const ICONS: Record<Enums["notification_type"], typeof Bell> = {
  REGISTRATION_SUBMITTED: UserPlus,
  PAYMENT_SUCCESS: CreditCard,
  PAYMENT_FAILED: CreditCard,
  PROFILE_VERIFIED: ShieldCheck,
  PROFILE_REJECTED: XCircle,
  INTEREST_RECEIVED: Heart,
  INTEREST_ACCEPTED: CheckCircle2,
  INTEREST_REJECTED: XCircle,
  MATCH_CREATED: Sparkles,
  ADMIN_NOTIFICATION: Bell,
};

const TONE: Partial<Record<Enums["notification_type"], string>> = {
  MATCH_CREATED: "bg-primary-soft text-primary",
  PROFILE_VERIFIED: "bg-success-soft text-success",
  INTEREST_ACCEPTED: "bg-success-soft text-success",
  PAYMENT_FAILED: "bg-danger-soft text-danger",
  PROFILE_REJECTED: "bg-danger-soft text-danger",
  INTEREST_REJECTED: "bg-canvas text-muted",
};

function relativeTime(iso: string) {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000], ["month", 2592000], ["week", 604800],
    ["day", 86400], ["hour", 3600], ["minute", 60],
  ];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of units) {
    if (seconds >= size) return formatter.format(-Math.floor(seconds / size), unit);
  }
  return "just now";
}

/**
 * The notification list (PRD §11.3).
 *
 * Clicking a notification marks it read and follows it to whatever it is about
 * — a profile, an interest or a match.
 */
export function NotificationList({ notifications }: { notifications: NotificationItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(notifications);
  const [marking, setMarking] = useState(false);

  const unread = items.filter((n) => !n.isRead).length;

  async function markAll() {
    setMarking(true);
    setItems((current) => current.map((n) => ({ ...n, isRead: true })));
    try {
      await apiPost("/api/notifications/read", { all: true });
      router.refresh();
    } finally {
      setMarking(false);
    }
  }

  async function markOne(id: string) {
    setItems((current) => current.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    await apiPost("/api/notifications/read", { notificationId: id }).catch(() => {});
    router.refresh();
  }

  /** Where a notification leads, if anywhere. */
  function hrefFor(item: NotificationItem): string | null {
    if (item.relatedMatchId) return "/matches";
    if (item.relatedInterestId) return "/interests";
    if (item.relatedUserId) return `/profiles/${item.relatedUserId}`;
    return null;
  }

  return (
    <>
      {unread > 0 && (
        <div className="mb-4 flex justify-end">
          <Button variant="secondary" size="sm" onClick={markAll} disabled={marking}>
            {marking ? "Marking…" : `Mark all ${unread} as read`}
          </Button>
        </div>
      )}

      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {items.map((item) => {
          const Icon = ICONS[item.type];
          const href = hrefFor(item);

          const body = (
            <div className={cn(
              "flex gap-4 px-5 py-4 transition-colors sm:px-6",
              !item.isRead && "bg-primary-soft/40",
              href && "hover:bg-primary-soft",
            )}>
              <span aria-hidden className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                TONE[item.type] ?? "bg-canvas text-muted",
              )}>
                <Icon className="h-4.5 w-4.5" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className={cn("text-sm", item.isRead ? "text-body" : "font-semibold text-ink")}>
                    {item.title}
                  </p>
                  {!item.isRead && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted">{item.message}</p>
                <p className="mt-1.5 text-xs text-muted">
                  <time dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time>
                </p>
              </div>
            </div>
          );

          return (
            <li key={item.id}>
              {href ? (
                <Link href={href} onClick={() => !item.isRead && markOne(item.id)} className="block">
                  {body}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => !item.isRead && markOne(item.id)}
                  className="block w-full text-left"
                  disabled={item.isRead}
                >
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
