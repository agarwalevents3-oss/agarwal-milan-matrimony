import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser, asAnon } from "../../scripts/pg-harness.mjs";

/**
 * Membership payments (Website Improvements §6.3, migration 0011).
 *
 * The payment guarantees the website relies on, proven against the real
 * functions: a membership is activated exactly once, a late or replayed
 * gateway event cannot corrupt a payment, and — most importantly — no member
 * or visitor can call the payment functions directly to mark themselves paid.
 */
describe("Membership payments (migration 0011)", () => {
  let db: PGlite;
  let seq = 0;

  const documents = JSON.stringify({
    photoPath: "x/photo.webp", photoThumbPath: "x/thumb.webp",
    aadhaarPath: "x/aadhaar.webp", aadhaarConsent: true,
    consentText: "I consent to the storage of my Aadhaar for verification purposes.",
  });

  /** A member who has submitted their registration and owes the payment. */
  async function memberAwaitingPayment() {
    seq += 1;
    const mobile = `+91981234${String(5600 + seq).padStart(4, "0")}`;
    const auth = await db.query<{ id: string }>(
      `insert into auth.users (phone, email) values ($1, $2) returning id`, [mobile, `m${seq}@example.com`]);
    const userId = auth.rows[0].id;
    await db.query(
      `select public.create_draft_registration($1, $2, $3, 'Member ${seq}', 'FEMALE')`,
      [userId, mobile, `m${seq}@example.com`]);
    await db.query(`select public.submit_registration($1, $2::jsonb, '203.0.113.9'::inet)`, [userId, documents]);
    const reg = await db.query<{ id: string; registration_id: string }>(
      `select id, registration_id from public.registrations where user_id = $1`, [userId]);
    return { userId, registrationUuid: reg.rows[0].id, registrationId: reg.rows[0].registration_id };
  }

  async function startPayment(userId: string, registrationUuid: string, orderId: string) {
    const pay = await db.query<{ id: string }>(
      `insert into public.payments (user_id, registration_id, amount, status, gateway, gateway_order_id, membership_plan)
       values ($1, $2, 999, 'INITIATED', 'mock', $3, 'standard') returning id`,
      [userId, registrationUuid, orderId]);
    return pay.rows[0].id;
  }

  const registration = async (userId: string) =>
    (await db.query<{ status: string; payment_status: string }>(
      `select status, payment_status from public.registrations where user_id = $1`, [userId])).rows[0];

  const payment = async (id: string) =>
    (await db.query<{ status: string; failure_reason: string | null; membership_plan: string | null }>(
      `select status, failure_reason, membership_plan from public.payments where id = $1`, [id])).rows[0];

  const notifications = async (userId: string, type: string) =>
    (await db.query(`select 1 from public.notifications where recipient_user_id = $1 and type = $2`,
      [userId, type])).rows.length;

  beforeAll(async () => {
    db = await createTestDb();
    // An admin to receive the admin notifications.
    const auth = await db.query<{ id: string }>(
      `insert into auth.users (phone, email, raw_app_meta_data) values ('+919000000099', 'admin@example.com', '{"role":"admin"}') returning id`);
    await db.query(`insert into public.users (id, mobile, email, role) values ($1, '+919000000099', 'admin@example.com', 'admin')`,
      [auth.rows[0].id]);
  });

  afterAll(async () => db?.close());

  it("records the membership plan on the payment", async () => {
    const m = await memberAwaitingPayment();
    const id = await startPayment(m.userId, m.registrationUuid, "order_plan_1");
    expect((await payment(id)).membership_plan).toBe("standard");
  });

  it("confirms a late success after a recorded failure (amount debited, confirmation delayed)", async () => {
    const m = await memberAwaitingPayment();
    const id = await startPayment(m.userId, m.registrationUuid, "order_late_1");

    await db.query(`select public.fail_payment($1, 'Gateway timeout.')`, [id]);
    expect(await registration(m.userId)).toMatchObject({ status: "PAYMENT_FAILED", payment_status: "FAILED" });
    expect(await payment(id)).toMatchObject({ status: "FAILED", failure_reason: "Gateway timeout." });

    const { rows } = await db.query<{ r: { registration_status: string; duplicate: boolean } }>(
      `select public.confirm_payment($1, 'pay_late_1') as r`, [id]);
    expect(rows[0].r).toMatchObject({ registration_status: "PENDING_VERIFICATION", duplicate: false });
    expect(await registration(m.userId)).toMatchObject({ status: "PENDING_VERIFICATION", payment_status: "SUCCESS" });
    expect(await payment(id)).toMatchObject({ status: "SUCCESS", failure_reason: null });
  });

  it("records a second successful payment as a duplicate without activating twice", async () => {
    const m = await memberAwaitingPayment();
    const first = await startPayment(m.userId, m.registrationUuid, "order_dup_1");
    const second = await startPayment(m.userId, m.registrationUuid, "order_dup_2");

    await db.query(`select public.confirm_payment($1, 'pay_dup_1')`, [first]);
    const { rows } = await db.query<{ r: { duplicate: boolean; registration_status: string } }>(
      `select public.confirm_payment($1, 'pay_dup_2') as r`, [second]);

    expect(rows[0].r).toMatchObject({ duplicate: true, registration_status: "PENDING_VERIFICATION" });
    expect(await payment(second)).toMatchObject({ status: "SUCCESS" }); // the money is on record for a refund
    expect(await registration(m.userId)).toMatchObject({ status: "PENDING_VERIFICATION", payment_status: "SUCCESS" });
    expect(await notifications(m.userId, "PAYMENT_SUCCESS")).toBe(1); // activated once

    const admin = await db.query(
      `select 1 from public.notifications n join public.users u on u.id = n.recipient_user_id
        where u.role = 'admin' and n.title = 'Duplicate payment received'`);
    expect(admin.rows.length).toBeGreaterThan(0);
  });

  it("never lets a failed attempt mark an already-paid registration as unpaid", async () => {
    const m = await memberAwaitingPayment();
    const paid = await startPayment(m.userId, m.registrationUuid, "order_mixed_1");
    const other = await startPayment(m.userId, m.registrationUuid, "order_mixed_2");

    await db.query(`select public.confirm_payment($1, 'pay_mixed_1')`, [paid]);
    await db.query(`select public.fail_payment($1, 'Card declined.')`, [other]);

    expect(await registration(m.userId)).toMatchObject({ status: "PENDING_VERIFICATION", payment_status: "SUCCESS" });
    expect(await notifications(m.userId, "PAYMENT_FAILED")).toBe(0);
  });

  it("does not change a confirmed payment when a delayed failure arrives", async () => {
    const m = await memberAwaitingPayment();
    const id = await startPayment(m.userId, m.registrationUuid, "order_delayed_1");
    await db.query(`select public.confirm_payment($1, 'pay_delayed_1')`, [id]);
    await db.query(`select public.fail_payment($1, 'late webhook')`, [id]);

    expect(await payment(id)).toMatchObject({ status: "SUCCESS", failure_reason: null });
    expect(await registration(m.userId)).toMatchObject({ payment_status: "SUCCESS" });
  });

  it("treats a re-delivered failure as a no-op, notifying the member once", async () => {
    const m = await memberAwaitingPayment();
    const id = await startPayment(m.userId, m.registrationUuid, "order_twice_1");
    await db.query(`select public.fail_payment($1, 'Card declined.')`, [id]);
    await db.query(`select public.fail_payment($1, 'Card declined.')`, [id]);
    expect(await notifications(m.userId, "PAYMENT_FAILED")).toBe(1);
  });

  it("keeps the technical failure reason out of the member's notification", async () => {
    const m = await memberAwaitingPayment();
    const id = await startPayment(m.userId, m.registrationUuid, "order_msg_1");
    await db.query(`select public.fail_payment($1, 'Verification failed: Signature mismatch.')`, [id]);
    const { rows } = await db.query<{ message: string }>(
      `select message from public.notifications where recipient_user_id = $1 and type = 'PAYMENT_FAILED'`, [m.userId]);
    expect(rows[0].message).not.toMatch(/signature/i);
  });

  it("processes one gateway transaction at most once", async () => {
    const m = await memberAwaitingPayment();
    const a = await startPayment(m.userId, m.registrationUuid, "order_same_1");
    const b = await startPayment(m.userId, m.registrationUuid, "order_same_2");
    await db.query(`select public.confirm_payment($1, 'pay_same')`, [a]);
    await expect(db.query(`select public.confirm_payment($1, 'pay_same')`, [b]))
      .rejects.toThrow(/payments_gateway_payment_id_key|duplicate key/);
  });

  describe("only the server may call the payment functions", () => {
    it("refuses a member who tries to confirm their own unpaid payment", async () => {
      const m = await memberAwaitingPayment();
      const id = await startPayment(m.userId, m.registrationUuid, "order_attack_1");

      await expect(asUser(db, m.userId, `select public.confirm_payment($1, 'free')`, [id]))
        .rejects.toThrow(/permission denied/i);
      await expect(asAnon(db, `select public.confirm_payment($1, 'free')`, [id]))
        .rejects.toThrow(/permission denied/i);

      expect(await registration(m.userId)).toMatchObject({ status: "PAYMENT_PENDING", payment_status: "PENDING" });
    });

    it("refuses direct calls to fail_payment and begin_payment_retry", async () => {
      const m = await memberAwaitingPayment();
      const id = await startPayment(m.userId, m.registrationUuid, "order_attack_2");
      await expect(asUser(db, m.userId, `select public.fail_payment($1, null)`, [id]))
        .rejects.toThrow(/permission denied/i);
      await expect(asUser(db, m.userId, `select public.begin_payment_retry($1)`, [m.userId]))
        .rejects.toThrow(/permission denied/i);
    });

    it("refuses a member who tries to write another member's profile", async () => {
      const victim = await memberAwaitingPayment();
      const attacker = await memberAwaitingPayment();
      await expect(asUser(db, attacker.userId,
        `select public.save_draft_profile($1, '{"gotra":"Changed"}'::jsonb, null, null, null)`, [victim.userId]))
        .rejects.toThrow(/permission denied/i);

      const { rows } = await db.query<{ gotra: string | null }>(
        `select gotra from public.profiles where user_id = $1`, [victim.userId]);
      expect(rows[0].gotra).toBeNull();
    });
  });
});
