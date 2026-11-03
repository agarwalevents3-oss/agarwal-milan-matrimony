/**
 * Seeds realistic TEST data for end-to-end verification.
 *
 *   node scripts/seed-test-data.mjs seed --confirm
 *   node scripts/seed-test-data.mjs clean --confirm
 *
 * Every account it creates is identifiable: mobile numbers in the reserved
 * +9190000000xx range and emails at @seed.test. `clean` removes exactly those
 * and nothing else, so it can never touch a real member.
 *
 * Refuses to run without --confirm, because it writes to whatever project
 * .env.local points at — which may well be production.
 *
 * Members are built through the REAL RPCs (create_draft_registration,
 * save_draft_profile, submit_registration, confirm_payment) rather than raw
 * inserts, so seeding exercises the same code path registration does and a
 * broken migration shows up here rather than in a demo.
 */
import zlib from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const command = process.argv[2];
const confirmed = process.argv.includes("--confirm");

if (!["seed", "clean"].includes(command) || !confirmed) {
  console.error("Usage: node scripts/seed-test-data.mjs <seed|clean> --confirm");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;

if (!url || !serviceKey || !dbUrl) {
  console.error("Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env.local) and SUPABASE_DB_URL (env).");
  process.exit(1);
}

const TEST_MOBILE_PREFIX = "+9190000000";
const TEST_PASSWORD = "TestPass123";
const PHOTO_BUCKET = "profile-photos";
const AADHAAR_BUCKET = "aadhaar-documents";

const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const sql = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await sql.connect();

// ── Minimal PNG encoder, so test photos are real images with real bytes ──────
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function makePng(size, [r, g, b]) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      // A soft diagonal wash so cards are visually distinguishable.
      const t = (x + y) / (size * 2);
      raw[o++] = Math.round(r * (0.75 + 0.25 * t));
      raw[o++] = Math.round(g * (0.75 + 0.25 * t));
      raw[o++] = Math.round(b * (0.75 + 0.25 * t));
    }
  }
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", zlib.deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))]);
}

const PALETTE = [
  [194, 37, 92], [156, 79, 140], [93, 109, 176], [64, 145, 148],
  [201, 124, 62], [140, 122, 96], [110, 140, 90], [176, 92, 108],
];

// ── Test population ─────────────────────────────────────────────────────────
const FEMALE = ["Priya Sharma","Ananya Iyer","Meera Nair","Kavya Reddy","Divya Menon","Sneha Kulkarni","Aishwarya Rao","Ritu Agarwal","Pooja Desai","Lakshmi Pillai","Neha Joshi","Shreya Banerjee","Tanvi Shah","Ishita Chatterjee"];
const MALE = ["Arjun Nair","Rohan Mehta","Vikram Reddy","Karthik Iyer","Aditya Kulkarni","Siddharth Rao","Nikhil Agarwal","Rahul Desai","Ganesh Pillai","Amit Joshi","Sourav Banerjee","Harsh Shah","Vivek Menon","Rajat Chopra"];
const CITIES = [["Bengaluru","Karnataka"],["Pune","Maharashtra"],["Hyderabad","Telangana"],["Chennai","Tamil Nadu"],["Mumbai","Maharashtra"],["Kochi","Kerala"],["Delhi","Delhi"],["Ahmedabad","Gujarat"]];
const GOTRAS = ["Kashyap","Bharadwaj","Vashistha","Gautam","Atri"];
const SUBCASTES = ["Iyer","Nair","Reddy","Agarwal","Menon","Kulkarni"];
const QUALIFICATIONS = ["B.Tech","M.Tech","MBA","MBBS","B.Com","M.Sc","CA"];
const OCCUPATIONS = ["Software Engineer","Doctor","Chartered Accountant","Architect","Data Scientist","Teacher","Product Manager"];
const COMPANIES = ["Infosys","TCS","Wipro","Self-employed","Apollo Hospitals","Deloitte","Startup"];
const MARITAL = ["NEVER_MARRIED","NEVER_MARRIED","NEVER_MARRIED","DIVORCED","WIDOWED"];

const pick = (arr, i) => arr[i % arr.length];

/** Deterministic so re-seeding produces the same population. */
function memberSpec(index) {
  const isFemale = index % 2 === 0;
  const name = isFemale ? pick(FEMALE, index / 2) : pick(MALE, (index - 1) / 2);
  const [city, state] = pick(CITIES, index);
  const birthYear = 1988 + (index % 15);          // ages ~23–38
  const month = String((index % 12) + 1).padStart(2, "0");
  const day = String((index % 27) + 1).padStart(2, "0");
  return {
    mobile: `${TEST_MOBILE_PREFIX}${String(index + 10).padStart(2, "0")}`,
    name,
    gender: isFemale ? "FEMALE" : "MALE",
    email: `seed${index}@seed.test`,
    dob: `${birthYear}-${month}-${day}`,
    heightCm: 150 + (index % 35),                  // 150–184
    maritalStatus: pick(MARITAL, index),
    gotra: pick(GOTRAS, index),
    subcaste: pick(SUBCASTES, index),
    qualification: pick(QUALIFICATIONS, index),
    occupation: pick(OCCUPATIONS, index),
    company: pick(COMPANIES, index),
    income: 300000 + (index % 12) * 250000,        // ₹3L–₹30L
    city, state,
    colour: pick(PALETTE, index),
  };
}

async function uploadImage(userId, bytes, name) {
  const path = `${userId}/${name}.png`;
  const { error } = await db.storage.from(PHOTO_BUCKET).upload(path, bytes, {
    contentType: "image/png", cacheControl: "31536000", upsert: true,
  });
  if (error) throw new Error(`photo upload failed: ${error.message}`);
  return path;
}

async function uploadAadhaar(userId, bytes) {
  const path = `${userId}/aadhaar.png`;
  const { error } = await db.storage.from(AADHAAR_BUCKET).upload(path, bytes, {
    contentType: "image/png", upsert: true,
  });
  if (error) throw new Error(`aadhaar upload failed: ${error.message}`);
  return path;
}

/**
 * Builds one member up to `targetStatus`, walking the same RPCs the app uses.
 * Statuses: DRAFT | PAYMENT_PENDING | PAYMENT_FAILED | PENDING_VERIFICATION |
 *           VERIFIED | REJECTED | SUSPENDED
 */
async function createMember(spec, targetStatus) {
  const { data: created, error: authError } = await db.auth.admin.createUser({
    email: `${spec.mobile.replace("+", "")}@phone.internal`,
    password: TEST_PASSWORD,
    email_confirm: true,
    app_metadata: { role: "user" },
  });
  if (authError) throw new Error(`auth: ${authError.message}`);
  const userId = created.user.id;

  const { error: draftError } = await db.rpc("create_draft_registration", {
    p_user_id: userId, p_mobile: spec.mobile, p_email: spec.email,
    p_full_name: spec.name, p_gender: spec.gender,
  });
  if (draftError) throw new Error(`draft: ${draftError.message}`);

  if (targetStatus === "DRAFT") return userId;

  const { error: profileError } = await db.rpc("save_draft_profile", {
    p_user_id: userId,
    p_profile: {
      dob: spec.dob, heightCm: spec.heightCm, maritalStatus: spec.maritalStatus,
      gotra: spec.gotra, subcaste: spec.subcaste,
      highestQualification: spec.qualification, occupation: spec.occupation,
      companyBusiness: spec.company, annualIncomeInr: spec.income,
      placeOfBirth: spec.city,
    },
    p_address: { line1: "12 Test Street", city: spec.city, state: spec.state, pincode: "560001" },
    p_family: { fatherName: "Test Father", motherName: "Test Mother", native: spec.city, siblings: "One sibling" },
    p_preferences: {
      ageMin: 24, ageMax: 36, heightMinCm: 150, heightMaxCm: 185,
      education: "Graduate or above", occupation: "Any", location: spec.state,
      otherExpectations: "Family-oriented",
    },
  });
  if (profileError) throw new Error(`profile: ${profileError.message}`);

  const full = makePng(600, spec.colour);
  const thumb = makePng(240, spec.colour);
  const [photoPath, thumbPath, aadhaarPath] = await Promise.all([
    uploadImage(userId, full, "photo"),
    uploadImage(userId, thumb, "thumb"),
    uploadAadhaar(userId, makePng(400, [120, 120, 120])),
  ]);

  const { error: submitError } = await db.rpc("submit_registration", {
    p_user_id: userId,
    p_documents: {
      photoPath, photoThumbPath: thumbPath, photoMime: "image/png", photoSize: full.length,
      aadhaarPath, aadhaarMime: "image/png", aadhaarSize: 1000, aadhaarConsent: true,
      consentText: "I confirm this Aadhaar document belongs to me and I consent to it being stored securely.",
    },
    p_consent_ip: "203.0.113.10",
  });
  if (submitError) throw new Error(`submit: ${submitError.message}`);

  if (targetStatus === "PAYMENT_PENDING") return userId;

  const { rows: reg } = await sql.query(
    `select id from public.registrations where user_id = $1`, [userId]);
  const registrationId = reg[0].id;

  if (targetStatus === "PAYMENT_FAILED") {
    const { rows: pay } = await sql.query(
      `insert into public.payments (user_id, registration_id, amount, status, gateway, gateway_order_id)
       values ($1, $2, 999, 'INITIATED', 'mock', $3) returning id`,
      [userId, registrationId, `order_seed_${userId.slice(0, 8)}`]);
    await db.rpc("fail_payment", { p_payment_id: pay[0].id, p_reason: "Seeded failure for testing." });
    return userId;
  }

  const { rows: pay } = await sql.query(
    `insert into public.payments (user_id, registration_id, amount, status, gateway, gateway_order_id)
     values ($1, $2, 999, 'INITIATED', 'mock', $3) returning id`,
    [userId, registrationId, `order_seed_${userId.slice(0, 8)}`]);

  const { error: payError } = await db.rpc("confirm_payment", {
    p_payment_id: pay[0].id, p_gateway_payment_id: `pay_seed_${userId.slice(0, 8)}`,
  });
  if (payError) throw new Error(`payment: ${payError.message}`);

  if (targetStatus === "PENDING_VERIFICATION") return userId;

  if (targetStatus === "REJECTED") {
    await sql.query(
      `update public.registrations set status = 'REJECTED', rejected_reason = $2 where id = $1`,
      [registrationId, "Seeded rejection: Aadhaar image was not readable."]);
    return userId;
  }

  await sql.query(`update public.registrations set status = 'VERIFIED' where id = $1`, [registrationId]);

  if (targetStatus === "SUSPENDED") {
    await sql.query(`update public.registrations set status = 'SUSPENDED' where id = $1`, [registrationId]);
    await sql.query(`update public.users set account_status = 'SUSPENDED' where id = $1`, [userId]);
  }

  return userId;
}

// ── clean ───────────────────────────────────────────────────────────────────
async function clean() {
  const { rows } = await sql.query(
    `select id from public.users where mobile like $1`, [`${TEST_MOBILE_PREFIX}%`]);
  console.log(`Removing ${rows.length} seeded account(s)…`);

  for (const { id } of rows) {
    for (const bucket of [PHOTO_BUCKET, AADHAAR_BUCKET, "educational-documents"]) {
      const { data: files } = await db.storage.from(bucket).list(id);
      if (files?.length) {
        await db.storage.from(bucket).remove(files.map((f) => `${id}/${f.name}`));
      }
    }
    // public.users cascades to profiles/registrations/etc; auth.users does not.
    await sql.query(`delete from public.users where id = $1`, [id]);
    await db.auth.admin.deleteUser(id).catch(() => {});
  }
  console.log("Done.");
}

// ── seed ────────────────────────────────────────────────────────────────────
async function seed() {
  const plan = [
    ...Array.from({ length: 24 }, (_, i) => [i, "VERIFIED"]),
    [24, "PENDING_VERIFICATION"], [25, "PENDING_VERIFICATION"], [26, "PENDING_VERIFICATION"],
    [27, "PAYMENT_PENDING"], [28, "PAYMENT_PENDING"],
    [29, "PAYMENT_FAILED"],
    [30, "REJECTED"],
    [31, "SUSPENDED"],
    [32, "DRAFT"],
  ];

  const byStatus = {};
  const verified = [];

  for (const [index, status] of plan) {
    const spec = memberSpec(index);
    try {
      const userId = await createMember(spec, status);
      byStatus[status] = (byStatus[status] ?? 0) + 1;
      if (status === "VERIFIED") verified.push({ userId, ...spec });
      process.stdout.write(".");
    } catch (error) {
      console.error(`\n✗ ${spec.mobile} (${status}): ${error.message}`);
    }
  }
  console.log("");

  // A little engagement history, so the admin oversight screens have content.
  // Inserted directly rather than through send_interest(), which reads
  // auth.uid() and so cannot be driven by the service role.
  const [a, b, c, d, e] = verified;
  await sql.query(
    `insert into public.interests (sender_user_id, receiver_user_id, status, responded_at)
     values ($1,$2,'PENDING',null), ($3,$4,'ACCEPTED',now()), ($4,$3,'ACCEPTED',now()),
            ($5,$1,'REJECTED',now())
     on conflict do nothing`,
    [a.userId, b.userId, c.userId, d.userId, e.userId]);

  // c and d accepted in both directions, so they are a genuine mutual match.
  await sql.query(
    `insert into public.matches (user_a_id, user_b_id)
     values (least($1::uuid,$2::uuid), greatest($1::uuid,$2::uuid))
     on conflict do nothing`,
    [c.userId, d.userId]);

  console.log("\nSeeded:");
  for (const [status, n] of Object.entries(byStatus)) console.log(`  ${status.padEnd(22)} ${n}`);
  console.log("\nSign in with any seeded member:");
  console.log(`  mobile   ${verified[0].mobile.replace("+91", "")}  (${verified[0].name})`);
  console.log(`  password ${TEST_PASSWORD}`);
}

try {
  if (command === "clean") await clean();
  else await seed();
} finally {
  await sql.end();
}
