import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Login",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="w-full max-w-md rounded-card border border-line bg-surface p-7 shadow-soft sm:p-9">
      <h1 className="text-2xl sm:text-3xl">Welcome back</h1>
      <p className="mt-2 text-sm text-muted">
        Log in with the mobile number you registered with.
      </p>
      <div className="mt-7">
        {/* useSearchParams needs a Suspense boundary during prerender. */}
        <Suspense fallback={<div className="h-64" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
