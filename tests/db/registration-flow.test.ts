import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "../../scripts/pg-harness.mjs";

/**
 * The end-to-end journey the PRD calls the delivery principle (§ final):
 * register → payment → admin verification → browsable.
 *
 * Driven entirely through the real RPCs, so this is the same code path the
 * Route Handlers take.
 */
describe("Registration → payment → verification", () => {
  let db: PGlite;
  let userId: string;

  const profile = {
    fullName: "Priya Sharma", gender: "FEMALE", dob: "1995-06-15",
    heightCm: 162, maritalStatus: "NEVER_MARRIED", subcaste: "Testcaste",
    highestQualification: "M.Tech", occupation: "Data Scientist",
    annualIncomeInr: 1800000,
  };
  const documents = {
    photoPath: "x/photo.webp", photoThumbPath: "x/thumb.webp", photoSize: 82000,
    aadhaarPath: "x/aadhaar.webp", aadhaarSize: 140000,
    consentText: "I consent to the storage of my Aadhaar for verification purposes.",
    aadhaarConsent: true,
  };

  beforeAll(async () => {
    db = await createTestDb();
    const auth = await db.query<{ id: string }>(
      `insert into auth.users (phone, email) values ('+919812345678', 'priya@example.com') returning id`);
    userId = auth.rows[0].id;
  });

  afterAll(async () => db?.close());

  it("creates a DRAFT account, so uploads can happen as a signed-in user", async () => {
    const { rows } = await db.query<{ r: { registration_id: string; status: string } }>(
      `select public.create_draft_registration($1, '+919812345678', 'priya@example.com',
              'Priya Sharma', 'FEMALE') as r`, [userId]);

    expect(rows[0].r.status).toBe("DRAFT");
    expect(rows[0].r.registration_id).toMatch(/^REG\d{6}$/);

    const p = await db.query<{ is_verified: boolean }>(
      `select is_verified from public.profiles where user_id = $1`, [userId]);
    expect(p.rows[0].is_verified).toBe(false);
  });

  it("rolls back completely if any part of the draft fails", async () => {
    const auth = await db.query<{ id: string }>(
      `insert into auth.users (phone, email) values ('+919812345679','dup@example.com') returning id`);
    const otherId = auth.rows[0].id;

    // Same mobile as the first user: the unique constraint must abort the lot.
    await expect(
      db.query(`select public.create_draft_registration($1, '+919812345678', 'dup@example.com',
                        'Dup User', 'MALE')`, [otherId]),
    ).rejects.toThrow(/users_mobile_key|duplicate key/);

    const orphans = await db.query(`select 1 from public.profiles where user_id = $1`, [otherId]);
    expect(orphans.rows, "a failed draft left an orphan profile").toHaveLength(0);
  });

  it("saves optional sections idempotently and denormalises location for search", async () => {
    for (let i = 0; i < 2; i++) {
      await db.query(
        `select public.save_draft_profile($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb)`,
        [userId, JSON.stringify(profile),
         JSON.stringify({ line1: "12 MG Road", city: "Bengaluru", state: "Karnataka", pincode: "560001" }),
         JSON.stringify({ fatherName: "Raj Sharma" }),
         JSON.stringify({ ageMin: 28, ageMax: 36 })],
      );
    }

    const addresses = await db.query(`select 1 from public.addresses where user_id = $1`, [userId]);
    expect(addresses.rows, "saving twice duplicated the address").toHaveLength(1);

    const p = await db.query<{ city: string; state: string; occupation: string }>(
      `select city, state, occupation from public.profiles where user_id = $1`, [userId]);
    expect(p.rows[0]).toMatchObject({
      city: "Bengaluru", state: "Karnataka", occupation: "Data Scientist",
    });
  });

  it("refuses to submit without Aadhaar consent (PRD §5.2)", async () => {
    await expect(
      db.query(`select public.submit_registration($1, $2::jsonb, '203.0.113.9'::inet)`,
        [userId, JSON.stringify({ ...documents, aadhaarConsent: false })]),
    ).rejects.toThrow(/Aadhaar consent is required/);
  });

  it("refuses to submit without a photo or an Aadhaar document", async () => {
    await expect(
      db.query(`select public.submit_registration($1, $2::jsonb, '203.0.113.9'::inet)`,
        [userId, JSON.stringify({ ...documents, photoPath: "", aadhaarConsent: true })]),
    ).rejects.toThrow(/profile photo is required/);

    await expect(
      db.query(`select public.submit_registration($1, $2::jsonb, '203.0.113.9'::inet)`,
        [userId, JSON.stringify({ ...documents, aadhaarPath: "", aadhaarConsent: true })]),
    ).rejects.toThrow(/Aadhaar document is required/);
  });

  it("submits, capturing consent as evidence, and lands on PAYMENT_PENDING", async () => {
    const { rows } = await db.query<{ r: { registration_id: string; status: string } }>(
      `select public.submit_registration($1, $2::jsonb, '203.0.113.9'::inet) as r`,
      [userId, JSON.stringify({ ...documents, aadhaarConsent: true })]);

    expect(rows[0].r.status).toBe("PAYMENT_PENDING");

    const doc = await db.query<{ consent_text: string; consent_ip: string; is_locked: boolean }>(
      `select consent_text, host(consent_ip) as consent_ip, is_locked from public.documents
        where user_id = $1 and document_type = 'AADHAAR'`, [userId]);
    expect(doc.rows[0].consent_text).toContain("I consent");
    expect(doc.rows[0].consent_ip).toBe("203.0.113.9");
    expect(doc.rows[0].is_locked).toBe(true);

    const notif = await db.query(
      `select 1 from public.notifications
        where recipient_user_id = $1 and type = 'REGISTRATION_SUBMITTED'`, [userId]);
    expect(notif.rows).toHaveLength(1);
  });

  it("cannot be submitted twice", async () => {
    await expect(
      db.query(`select public.submit_registration($1, $2::jsonb, '203.0.113.9'::inet)`,
        [userId, JSON.stringify({ ...documents, aadhaarConsent: true })]),
    ).rejects.toThrow(/already been submitted/);
  });

  it("cannot be verified while the payment is still pending (PRD §6.5)", async () => {
    await expect(
      db.query(`update public.registrations set status = 'VERIFIED' where user_id = $1`, [userId]),
    ).rejects.toThrow(/Illegal registration transition/);
  });

  it("advances to PENDING_VERIFICATION once payment is confirmed server-side", async () => {
    const reg = await db.query<{ id: string }>(
      `select id from public.registrations where user_id = $1`, [userId]);
    const pay = await db.query<{ id: string }>(
      `insert into public.payments (user_id, registration_id, amount, status, gateway, gateway_order_id)
       values ($1, $2, 999, 'INITIATED', 'mock', 'order_test_1') returning id`,
      [userId, reg.rows[0].id]);

    const { rows } = await db.query<{ confirm_payment: { already: boolean; registration_status: string } }>(
      `select public.confirm_payment($1, 'pay_test_1') as confirm_payment`, [pay.rows[0].id]);

    expect(rows[0].confirm_payment).toMatchObject({
      already: false, registration_status: "PENDING_VERIFICATION",
    });

    const notif = await db.query<{ type: string }>(
      `select type from public.notifications where recipient_user_id = $1 and type = 'PAYMENT_SUCCESS'`, [userId]);
    expect(notif.rows).toHaveLength(1);
  });

  it("moves the registration to PAYMENT_FAILED when a payment fails (migration 0010)", async () => {
    const auth = await db.query<{ id: string }>(
      `insert into auth.users (phone, email) values ('+919812345680','fail@example.com') returning id`);
    const failUser = auth.rows[0].id;

    await db.query(
      `select public.create_draft_registration($1,'+919812345680','fail@example.com','Fail Case','MALE')`,
      [failUser]);
    await db.query(
      `select public.submit_registration($1, $2::jsonb, '203.0.113.9'::inet)`,
      [failUser, JSON.stringify({ ...documents, aadhaarConsent: true })]);

    const reg = await db.query<{ id: string }>(
      `select id from public.registrations where user_id = $1`, [failUser]);
    const pay = await db.query<{ id: string }>(
      `insert into public.payments (user_id, registration_id, amount, status, gateway, gateway_order_id)
       values ($1, $2, 999, 'INITIATED', 'mock', 'order_fail_1') returning id`,
      [failUser, reg.rows[0].id]);

    await db.query(`select public.fail_payment($1, 'Card declined.')`, [pay.rows[0].id]);

    const after = await db.query<{ status: string; payment_status: string }>(
      `select status, payment_status from public.registrations where user_id = $1`, [failUser]);
    // Both must move — the admin's "Payment failed" filter reads status.
    expect(after.rows[0]).toMatchObject({
      status: "PAYMENT_FAILED", payment_status: "FAILED",
    });

    const notif = await db.query(
      `select 1 from public.notifications
        where recipient_user_id = $1 and type = 'PAYMENT_FAILED'`, [failUser]);
    expect(notif.rows).toHaveLength(1);

    // A retry must be possible: PAYMENT_FAILED -> PAYMENT_SUCCESS is NOT a
    // legal transition, so begin_payment_retry has to return it to PENDING
    // first. Without that, the fix above would break every retry.
    await db.query(`select public.begin_payment_retry($1)`, [failUser]);
    const retrying = await db.query<{ status: string }>(
      `select status from public.registrations where user_id = $1`, [failUser]);
    expect(retrying.rows[0].status).toBe("PAYMENT_PENDING");

    const pay2 = await db.query<{ id: string }>(
      `insert into public.payments (user_id, registration_id, amount, status, gateway, gateway_order_id)
       values ($1, $2, 999, 'INITIATED', 'mock', 'order_fail_2') returning id`,
      [failUser, reg.rows[0].id]);
    const confirmed = await db.query<{ r: { registration_status: string } }>(
      `select public.confirm_payment($1, 'pay_retry_1') as r`, [pay2.rows[0].id]);
    expect(confirmed.rows[0].r.registration_status).toBe("PENDING_VERIFICATION");
  });

  it("leaves an already-succeeded payment alone if fail_payment is replayed", async () => {
    const pay = await db.query<{ id: string }>(
      `select id from public.payments where user_id = $1 and status = 'SUCCESS' limit 1`, [userId]);
    await db.query(`select public.fail_payment($1, 'late webhook')`, [pay.rows[0].id]);

    const after = await db.query<{ status: string; payment_status: string }>(
      `select r.status, r.payment_status from public.registrations r where r.user_id = $1`, [userId]);
    expect(after.rows[0].payment_status).toBe("SUCCESS");
  });

  it("is idempotent, so a replayed webhook cannot double-advance it", async () => {
    const pay = await db.query<{ id: string }>(
      `select id from public.payments where user_id = $1`, [userId]);
    const { rows } = await db.query<{ confirm_payment: { already: boolean } }>(
      `select public.confirm_payment($1, 'pay_test_1') as confirm_payment`, [pay.rows[0].id]);
    expect(rows[0].confirm_payment.already).toBe(true);
  });

  it("becomes browsable only after the admin verifies it", async () => {
    const before = await db.query<{ is_verified: boolean }>(
      `select is_verified from public.profiles where user_id = $1`, [userId]);
    expect(before.rows[0].is_verified).toBe(false);

    await db.query(`update public.registrations set status = 'VERIFIED' where user_id = $1`, [userId]);

    const after = await db.query<{ is_verified: boolean; verified_at: string | null }>(
      `select p.is_verified, r.verified_at
         from public.profiles p join public.registrations r on r.user_id = p.user_id
        where p.user_id = $1`, [userId]);
    expect(after.rows[0].is_verified).toBe(true);
    expect(after.rows[0].verified_at).not.toBeNull();

    // And now the user can actually see other verified profiles.
    const visible = await asUser(db, userId, `select user_id from public.verified_profiles`);
    expect(visible.rows).toHaveLength(1);
  });
});
