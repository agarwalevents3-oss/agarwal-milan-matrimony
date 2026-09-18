import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/guards";
import { landingPathFor } from "@/lib/auth/routing";

export const metadata: Metadata = { title: "Discover", robots: { index: false } };

/**
 * Verified members' home (PRD §7.3).
 *
 * The search and profile grid land here next; for now it routes correctly by
 * status so no unverified user can reach the browsing surface.
 */
export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (user.registrationStatus !== "VERIFIED") {
    redirect(landingPathFor(user.registrationStatus));
  }

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl">Discover</h1>
      <p className="prose-body mt-3 text-sm">
        Search, filters and the profile grid are the next milestone — see
        docs/STATUS.md for exactly what is built and what is pending.
      </p>
    </div>
  );
}
