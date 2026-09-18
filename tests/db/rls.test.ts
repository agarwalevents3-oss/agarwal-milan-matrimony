import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser, asAdmin, asAnon } from "../../scripts/pg-harness.mjs";
import { seed, type Cast } from "./fixtures";

/**
 * The security gate.
 *
 * The anon key is public by design, so these policies — not route guards — are
 * what actually protect user data. Each test below corresponds to a promise the
 * PRD makes to its users (§3, §8.2, §18).
 */
describe("Row Level Security", () => {
  let db: PGlite;
  let cast: Cast;

  beforeAll(async () => {
    db = await createTestDb();
    cast = await seed(db);
  });

  afterAll(async () => db?.close());

  describe("a verified user browsing other profiles", () => {
    it("sees other VERIFIED profiles", async () => {
      const { rows } = await asUser(db, cast.alice,
        `select user_id, full_name from public.profiles where user_id = $1`, [cast.bob]);
      expect(rows).toHaveLength(1);
      expect(rows[0].full_name).toBe("Bob Nair");
    });

    it("cannot see profiles that are not yet verified", async () => {
      const { rows } = await asUser(db, cast.alice,
        `select user_id from public.profiles where user_id = $1`, [cast.carol]);
      expect(rows).toHaveLength(0);
    });

    it("NEVER sees another user's mobile number or email (PRD §8.2)", async () => {
      const { rows } = await asUser(db, cast.alice,
        `select mobile, email from public.users where id = $1`, [cast.bob]);
      expect(rows).toHaveLength(0);
    });

    it("sees its own mobile and email", async () => {
      const { rows } = await asUser(db, cast.alice,
        `select mobile from public.users where id = $1`, [cast.alice]);
      expect(rows[0]?.mobile).toBe("+919000000001");
    });

    it("NEVER sees another user's Aadhaar or certificates (PRD §18.1)", async () => {
      const { rows } = await asUser(db, cast.alice,
        `select id, storage_path from public.documents where user_id = $1`, [cast.bob]);
      expect(rows).toHaveLength(0);
    });

    it("NEVER sees another user's payment records (PRD §18)", async () => {
      const { rows } = await asUser(db, cast.alice,
        `select id, amount from public.payments where user_id = $1`, [cast.bob]);
      expect(rows).toHaveLength(0);
    });

    it("cannot read another user's registration or its status", async () => {
      const { rows } = await asUser(db, cast.alice,
        `select registration_id from public.registrations where user_id = $1`, [cast.bob]);
      expect(rows).toHaveLength(0);
    });

    it("cannot read admin settings beyond the public contact number", async () => {
      const { rows } = await asUser(db, cast.alice,
        `select key from public.admin_settings order by key`);
      expect(rows.map((r) => r.key)).toEqual(["admin_contact_number"]);
    });

    it("CAN read the admin contact number shown on profile pages (PRD §8.2)", async () => {
      const { rows } = await asUser(db, cast.alice,
        `select value from public.admin_settings where key = 'admin_contact_number'`);
      expect(rows).toHaveLength(1);
    });
  });

  describe("an unverified user", () => {
    it("cannot browse any profile but their own (PRD §7.2)", async () => {
      const { rows } = await asUser(db, cast.carol,
        `select user_id from public.profiles`);
      expect(rows.map((r) => r.user_id)).toEqual([cast.carol]);
    });

    it("cannot read the admin contact number", async () => {
      const { rows } = await asUser(db, cast.carol,
        `select value from public.admin_settings where key = 'admin_contact_number'`);
      expect(rows).toHaveLength(0);
    });
  });

  describe("a suspended user", () => {
    it("loses profile access immediately, without waiting for a token refresh", async () => {
      const suspendee = cast.bob;
      const before = await asUser(db, suspendee, `select user_id from public.profiles where user_id = $1`, [cast.alice]);
      expect(before.rows).toHaveLength(1);

      await db.query(`update public.registrations set status = 'SUSPENDED' where user_id = $1`, [suspendee]);

      const after = await asUser(db, suspendee, `select user_id from public.profiles where user_id = $1`, [cast.alice]);
      expect(after.rows).toHaveLength(0);

      // And they vanish from everyone else's search results.
      const others = await asUser(db, cast.alice, `select user_id from public.verified_profiles where user_id = $1`, [suspendee]);
      expect(others.rows).toHaveLength(0);

      await db.query(`update public.registrations set status = 'VERIFIED' where user_id = $1`, [suspendee]);
    });
  });

  describe("an anonymous visitor", () => {
    it("reads published FAQs and site content (PRD §4)", async () => {
      const faqs = await asAnon(db, `select id from public.faqs where is_active`);
      expect(faqs.rows.length).toBeGreaterThan(0);
      const content = await asAnon(db, `select key from public.site_content`);
      expect(content.rows.length).toBeGreaterThan(0);
    });

    it("reads no profile, user, document or payment whatsoever", async () => {
      for (const table of ["profiles", "users", "documents", "payments", "interests", "matches", "notifications"]) {
        const { rows } = await asAnon(db, `select * from public.${table}`);
        expect(rows, `anon could read public.${table}`).toHaveLength(0);
      }
    });
  });

  describe("the admin", () => {
    it("reads every registration, document and payment (PRD §12)", async () => {
      const docs = await asAdmin(db, cast.admin, `select id from public.documents`);
      expect(docs.rows.length).toBeGreaterThan(0);
      const pays = await asAdmin(db, cast.admin, `select id from public.payments`);
      expect(pays.rows.length).toBeGreaterThan(0);
      const users = await asAdmin(db, cast.admin, `select mobile from public.users`);
      expect(users.rows.length).toBeGreaterThan(0);
    });

    it("CANNOT edit a user's profile data (PRD §8.4, §12.2)", async () => {
      await asAdmin(db, cast.admin,
        `update public.profiles set occupation = 'Tampered' where user_id = $1`, [cast.alice]);
      const { rows } = await asAdmin(db, cast.admin,
        `select occupation from public.profiles where user_id = $1`, [cast.alice]);
      expect(rows[0].occupation).toBe("Engineer");
    });
  });

  describe("operational tables", () => {
    it("are unreachable from any client role", async () => {
      for (const table of ["phone_verifications", "rate_limits", "audit_log"]) {
        await expect(
          asUser(db, cast.alice, `select * from public.${table}`),
        ).rejects.toThrow(/permission denied/i);
      }
    });
  });
});
