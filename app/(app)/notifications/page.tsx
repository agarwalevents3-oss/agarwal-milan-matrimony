import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BellOff } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { getNotifications } from "@/lib/services/engagement";
import { NotificationList } from "@/components/notifications/NotificationList";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

/**
 * Notifications (PRD §11).
 *
 * Available to every signed-in member, not only verified ones — a member
 * awaiting verification needs to see the notification telling them the outcome.
 */
export default async function NotificationsPage() {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/login");

  const notifications = await getNotifications();

  return (
    <div className="container-page max-w-3xl py-8 lg:py-10">
      <h1 className="text-2xl sm:text-3xl">Notifications</h1>
      <p className="mt-1.5 text-sm text-muted">Everything that has happened on your account.</p>

      <div className="mt-8">
        {notifications.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title="Nothing yet"
            description="Updates about your registration, interests and matches will appear here."
          />
        ) : (
          <NotificationList notifications={notifications} />
        )}
      </div>
    </div>
  );
}
