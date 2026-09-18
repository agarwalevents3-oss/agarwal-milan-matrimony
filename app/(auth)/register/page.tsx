import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/guards";
import { RegisterWizard } from "./RegisterWizard";

export const metadata: Metadata = {
  title: "Register",
  robots: { index: false, follow: false },
};

/**
 * A signed-in user who lands here is resuming an interrupted signup, so send
 * them to wherever their registration actually is rather than starting over.
 */
export default async function RegisterPage() {
  const user = await getSessionUser();

  if (user && user.registrationStatus !== "DRAFT") {
    redirect("/dashboard");
  }

  return <RegisterWizard userId={user?.id ?? null} />;
}
