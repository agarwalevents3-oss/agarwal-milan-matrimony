"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Unread notification badge (PRD §11.3).
 *
 * Subscribes to Supabase Realtime rather than polling — one open socket instead
 * of a request every few seconds, which matters both for responsiveness and for
 * staying inside the free tier. Realtime respects RLS, so this only ever
 * receives rows addressed to this member; the filter is a second narrowing.
 *
 * The count is the server's figure plus however many arrived since. That delta
 * is reset DURING RENDER when a fresh server count lands, rather than in an
 * effect — React's documented pattern for state derived from props, and it
 * avoids the extra render pass an effect would cause.
 */
export function NotificationBell({ initialCount, userId }: { initialCount: number; userId: string }) {
  const router = useRouter();
  const [arrivedSinceRender, setArrivedSinceRender] = useState(0);
  const [lastServerCount, setLastServerCount] = useState(initialCount);

  // A new server count means the refresh has landed and already includes
  // everything we had counted locally, so the delta starts again from zero.
  // Previous props are held in state rather than a ref because a ref must not
  // be read during render.
  if (lastServerCount !== initialCount) {
    setLastServerCount(initialCount);
    setArrivedSinceRender(0);
  }

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        () => {
          // Show it immediately, then refresh so an open list picks it up too.
          setArrivedSinceRender((n) => n + 1);
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, router]);

  const count = initialCount + arrivedSinceRender;
  const label = count > 0 ? `Notifications, ${count} unread` : "Notifications";

  return (
    <Link
      href="/notifications"
      aria-label={label}
      className="relative grid h-11 w-11 place-items-center rounded-full text-body hover:bg-primary-soft hover:text-primary"
    >
      <Bell className="h-5 w-5" aria-hidden />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute right-1.5 top-1.5 grid min-w-4.5 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-white"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
      {/* Announced politely for screen readers without stealing focus. */}
      <span className="sr-only" aria-live="polite">{label}</span>
    </Link>
  );
}
