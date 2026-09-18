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

/**
 * Policies added in migration 0009, for the profile-detail and admin screens.
 */
describe("Profile detail visibility (migration 0009)", () => {
  let db: PGlite;
  let cast: Cast;

  beforeAll(async () => {
    db = await createTestDb();
    cast = await seed(db);
    for (const id of [cast.alice, cast.bob, cast.carol]) {
      await db.query(
        `insert into public.partner_preferences (user_id, age_min, age_max, education)
         values ($1, 26, 34, 'Postgraduate')`, [id]);
    }
  });

  afterAll(async () => db?.close());

  it("lets a verified member see what another verified member is looking for", async () => {
    const { rows } = await asUser(db, cast.alice,
      `select education from public.partner_preferences where user_id = $1`, [cast.bob]);
    expect(rows).toHaveLength(1);
    expect(rows[0].education).toBe("Postgraduate");
  });

  it("does NOT expose preferences of members who are not verified", async () => {
    const { rows } = await asUser(db, cast.alice,
      `select 1 from public.partner_preferences where user_id = $1`, [cast.carol]);
    expect(rows).toHaveLength(0);
  });

  it("keeps family details private — they name third parties (PRD §8.2)", async () => {
    await db.query(
      `insert into public.family_details (user_id, father_name, mother_name)
       values ($1, 'Mr Nair', 'Mrs Nair')`, [cast.bob]);

    const { rows } = await asUser(db, cast.alice,
      `select father_name from public.family_details where user_id = $1`, [cast.bob]);
    expect(rows, "one member could read another's family details").toHaveLength(0);
  });

  it("still hides preferences from an unverified member", async () => {
    const { rows } = await asUser(db, cast.carol,
      `select 1 from public.partner_preferences where user_id = $1`, [cast.alice]);
    expect(rows).toHaveLength(0);
  });
});

describe("Admin reporting functions (migration 0009)", () => {
  let db: PGlite;
  let cast: Cast;

  beforeAll(async () => {
    db = await createTestDb();
    cast = await seed(db);
  });

  afterAll(async () => db?.close());

  it("refuses to run for a non-admin, even though it is SECURITY DEFINER", async () => {
    for (const fn of ["admin_dashboard_stats()", "admin_recent_activity(5)", "admin_registration_list(null, null, 20, 0)"]) {
      await expect(
        asUser(db, cast.alice, `select * from public.${fn}`),
        `${fn} was reachable by a normal user`,
      ).rejects.toThrow(/Administrator access is required/);
    }
  });

  it("summarises the platform for the admin (PRD §12.1)", async () => {
    const { rows } = await asAdmin<{ s: Record<string, number> }>(db, cast.admin,
      `select public.admin_dashboard_stats() as s`);
    const stats = rows[0].s;

    expect(stats.verified).toBe(2);              // alice, bob
    expect(stats.pending_verification).toBe(1);  // carol
    expect(stats.pending_payments).toBe(1);      // dave
    // Four members, not five: the admin's own registration never leaves DRAFT,
    // and drafts are counted separately rather than as members.
    expect(stats.total_users).toBe(4);
    expect(stats.drafts).toBe(1);
  });

  it("searches the registration queue by id, name, mobile and email", async () => {
    for (const term of ["Alice", "REG", "919000000001", "alice@example.com"]) {
      const { rows } = await asAdmin(db, cast.admin,
        `select registration_id from public.admin_registration_list($1, null, 20, 0)`, [term]);
      expect(rows.length, `search for "${term}" found nothing`).toBeGreaterThan(0);
    }
  });

  it("filters by status and reports the true total for pagination", async () => {
    const { rows } = await asAdmin<{ status: string; total_count: string }>(db, cast.admin,
      `select status, total_count from public.admin_registration_list(null, 'VERIFIED', 20, 0)`);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.status === "VERIFIED")).toBe(true);
    expect(Number(rows[0].total_count)).toBe(2);
  });
});

/**
 * Website images (PRD §13). One image per slot, publicly readable, admin-writable.
 */
describe("Website image management", () => {
  let db: PGlite;
  let cast: Cast;

  beforeAll(async () => {
    db = await createTestDb();
    cast = await seed(db);
  });

  afterAll(async () => db?.close());

  it("is readable by anonymous visitors when active", async () => {
    await db.query(
      `insert into public.site_images (slot, storage_path, alt_text, is_active)
       values ('hero', 'hero/abc.webp', 'A couple', true)`);

    const { rows } = await asAnon(db, `select storage_path from public.site_images`);
    expect(rows).toHaveLength(1);
  });

  it("hides inactive images from visitors but not from the admin", async () => {
    await db.query(`update public.site_images set is_active = false where slot = 'hero'`);

    const anon = await asAnon(db, `select 1 from public.site_images`);
    expect(anon.rows).toHaveLength(0);

    const admin = await asAdmin(db, cast.admin, `select 1 from public.site_images`);
    expect(admin.rows).toHaveLength(1);

    await db.query(`update public.site_images set is_active = true where slot = 'hero'`);
  });

  it("cannot be written by an ordinary member", async () => {
    const insert = await asUser(db, cast.alice,
      `insert into public.site_images (slot, storage_path)
       values ('hero', 'hero/hacked.webp') returning id`).catch(() => ({ rows: [] }));
    expect(insert.rows).toHaveLength(0);

    const update = await asUser(db, cast.alice,
      `update public.site_images set storage_path = 'hero/hacked.webp'`);
    expect(update.affectedRows ?? 0).toBe(0);
  });

  it("can be replaced by the admin", async () => {
    await asAdmin(db, cast.admin,
      `update public.site_images set storage_path = 'hero/new.webp' where slot = 'hero'`);
    const { rows } = await asAdmin<{ storage_path: string }>(db, cast.admin,
      `select storage_path from public.site_images where slot = 'hero'`);
    expect(rows[0].storage_path).toBe("hero/new.webp");
  });
});
