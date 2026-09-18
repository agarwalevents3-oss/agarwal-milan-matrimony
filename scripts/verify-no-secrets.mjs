/**
 * Fails the build if a server secret reached the client bundle.
 *
 * The anon key is public by design and safe. The service-role key is not: it
 * bypasses every RLS policy. This walks the built client chunks and looks for
 * the literal value of each secret, so an accidental NEXT_PUBLIC_ prefix or a
 * stray import into a Client Component is caught before it ships.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const SECRETS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "REGISTRATION_TICKET_SECRET",
  "OTP_HASH_SECRET",
  "CRON_SECRET",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "MSG91_AUTH_KEY",
  "ADMIN_SEED_PASSWORD",
]
  .map((name) => ({ name, value: process.env[name] }))
  // Ignore unset ones, and placeholders too short to be a real credential.
  .filter((s) => s.value && s.value.length >= 16);

const CLIENT_DIRS = [".next/static", ".next/server/app"];

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(js|mjs|cjs|json|html|txt)$/.test(entry.name)) yield full;
  }
}

if (!SECRETS.length) {
  console.log("No non-placeholder secrets configured; nothing to scan for.");
  process.exit(0);
}

const leaks = [];

for (const dir of CLIENT_DIRS) {
  for await (const file of walk(dir)) {
    // Server bundles legitimately contain secrets; only static/ ships to browsers.
    const isBrowserBundle = file.includes(`${path.sep}static${path.sep}`);
    if (!isBrowserBundle) continue;

    const contents = await readFile(file, "utf8");
    for (const secret of SECRETS) {
      if (contents.includes(secret.value)) leaks.push({ file, name: secret.name });
    }
  }
}

if (leaks.length) {
  console.error("\n✗ SECRETS FOUND IN THE CLIENT BUNDLE:\n");
  for (const leak of leaks) console.error(`    ${leak.name} in ${leak.file}`);
  console.error("\nNothing secret may carry a NEXT_PUBLIC_ prefix, and server-only");
  console.error("modules must not be imported from a Client Component.\n");
  process.exit(1);
}

console.log(`✓ No server secrets in the client bundle (checked ${SECRETS.length} values).`);
