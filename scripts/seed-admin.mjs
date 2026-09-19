/**
 * Creates the single administrator (PRD §3).
 *
 * Run once against a fresh project:  npm run seed:admin
 * Then rotate ADMIN_SEED_PASSWORD — it has served its purpose.
 *
 * The role is written to BOTH app_metadata (which RLS reads from the JWT) and
 * public.users.role (which the server guards re-check). Both must agree for
 * admin access to work, which means a tampered token alone is not enough.
 *
 * Branches on AUTH_IDENTITY_STRATEGY exactly as lib/auth/identity.ts does.
 * This script cannot import that file — it runs as a plain Node script with
 * no bundler, and the file is wrapped in "server-only" — so the env var is
 * what keeps the two in agreement rather than a shared constant. See
 * docs/DECISIONS.md.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const phone = process.env.ADMIN_SEED_PHONE;
const password = process.env.ADMIN_SEED_PASSWORD;
const strategy = process.env.AUTH_IDENTITY_STRATEGY || "phone";
const syntheticEmail = `${phone?.replace("+", "") ?? ""}@phone.internal`;

const missing = Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: url,
  SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  ADMIN_SEED_PHONE: phone,
  ADMIN_SEED_PASSWORD: password,
}).filter(([, v]) => !v).map(([k]) => k);

if (missing.length) {
  console.error(`Missing environment variables:\n  ${missing.join("\n  ")}`);
  process.exit(1);
}

if (!/^\+91[6-9]\d{9}$/.test(phone)) {
  console.error(`ADMIN_SEED_PHONE must be E.164, e.g. +919876543210 (got: ${phone})`);
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: existing } = await db.from("users").select("id").eq("mobile", phone).maybeSingle();
if (existing) {
  console.log(`An account already exists for ${phone}. Promoting it to admin.`);
  await db.auth.admin.updateUserById(existing.id, { app_metadata: { role: "admin" } });
  await db.from("users").update({ role: "admin" }).eq("id", existing.id);
  console.log("Done.");
  process.exit(0);
}

const { data: created, error: authError } = await db.auth.admin.createUser(
  strategy === "synthetic-email"
    ? { email: syntheticEmail, password, email_confirm: true, app_metadata: { role: "admin" } }
    : { phone, password, phone_confirm: true, app_metadata: { role: "admin" } },
);

if (authError) {
  console.error("Could not create the auth user:", authError.message);
  if (/phone|sms/i.test(authError.message)) {
    console.error(
      "\nSupabase's Phone provider needs a configured SMS provider (Twilio, etc.) before it\n" +
      "can be enabled — even though our own OTP service is what actually verifies numbers.\n" +
      "Set AUTH_IDENTITY_STRATEGY=synthetic-email in .env.local to avoid needing it at all,\n" +
      "then re-run this script.",
    );
  }
  process.exit(1);
}

const userId = created.user.id;

const { error: dbError } = await db.from("users").insert({
  id: userId,
  mobile: phone,
  // public.users.email is ordinary profile data, unrelated to the synthetic
  // address (if any) used as the Auth identity above.
  email: `admin@${new URL(url).hostname.split(".")[0]}.local`,
  role: "admin",
});

if (dbError) {
  await db.auth.admin.deleteUser(userId);
  console.error("Could not create the users row:", dbError.message);
  process.exit(1);
}

// The admin needs a profile row so the header and account menu render.
await db.from("profiles").insert({ user_id: userId, full_name: "Administrator", gender: "OTHER" });

console.log(`Administrator created for ${phone}.`);
console.log("Now rotate ADMIN_SEED_PASSWORD — it is no longer needed.");
