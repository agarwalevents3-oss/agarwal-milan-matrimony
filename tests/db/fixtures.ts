import type { PGlite } from "@electric-sql/pglite";

/**
 * Seeds a realistic cast of users. Everything goes through the real triggers
 * and the real status machine — verifyUser() below walks the full lifecycle
 * rather than reaching in and setting status = 'VERIFIED', so the fixtures
 * themselves prove the machine works.
 */
export interface Cast {
  alice: string;   // VERIFIED
  bob: string;     // VERIFIED
  carol: string;   // PENDING_VERIFICATION (paid, awaiting review)
  dave: string;    // PAYMENT_PENDING (has not paid)
  admin: string;
}

async function createUser(
  db: PGlite,
  { mobile, email, name, gender, dob, role = "user" }: {
    mobile: string; email: string; name: string;
    gender: "MALE" | "FEMALE"; dob: string; role?: "user" | "admin";
  },
): Promise<string> {
  const auth = await db.query<{ id: string }>(
    `insert into auth.users (phone, email, raw_app_meta_data)
     values ($1, $2, $3::jsonb) returning id`,
    [mobile, email, JSON.stringify({ role })],
  );
  const id = auth.rows[0].id;

  await db.query(
    `insert into public.users (id, mobile, email, role) values ($1, $2, $3, $4)`,
    [id, mobile, email, role],
  );
  await db.query(
    `insert into public.profiles (user_id, full_name, gender, dob, height_cm,
                                  marital_status, subcaste, occupation, annual_income_inr)
     values ($1, $2, $3, $4, 170, 'NEVER_MARRIED', 'Testcaste', 'Engineer', 1200000)`,
    [id, name, gender, dob],
  );
  await db.query(
    `insert into public.addresses (user_id, line1, city, state, pincode)
     values ($1, '1 Test Road', 'Pune', 'Maharashtra', '411001')`,
    [id],
  );
  return id;
}

/** Walks the registration all the way to VERIFIED through the real trigger-enforced machine. */
export async function verifyUser(db: PGlite, userId: string) {
  await db.query(`update public.registrations set status = 'SUBMITTED'        where user_id = $1`, [userId]);
  await db.query(`update public.registrations set status = 'PAYMENT_PENDING'  where user_id = $1`, [userId]);
  await db.query(`update public.registrations set payment_status = 'SUCCESS', status = 'PAYMENT_SUCCESS' where user_id = $1`, [userId]);
  await db.query(`update public.registrations set status = 'PENDING_VERIFICATION' where user_id = $1`, [userId]);
  await db.query(`update public.registrations set status = 'VERIFIED'         where user_id = $1`, [userId]);
}

export async function payAndAwaitReview(db: PGlite, userId: string) {
  await db.query(`update public.registrations set status = 'SUBMITTED'       where user_id = $1`, [userId]);
  await db.query(`update public.registrations set status = 'PAYMENT_PENDING' where user_id = $1`, [userId]);
  await db.query(`update public.registrations set payment_status = 'SUCCESS', status = 'PAYMENT_SUCCESS' where user_id = $1`, [userId]);
  await db.query(`update public.registrations set status = 'PENDING_VERIFICATION' where user_id = $1`, [userId]);
}

export async function seed(db: PGlite): Promise<Cast> {
  const alice = await createUser(db, { mobile: "+919000000001", email: "alice@example.com", name: "Alice Iyer",   gender: "FEMALE", dob: "1996-04-12" });
  const bob   = await createUser(db, { mobile: "+919000000002", email: "bob@example.com",   name: "Bob Nair",     gender: "MALE",   dob: "1993-09-03" });
  const carol = await createUser(db, { mobile: "+919000000003", email: "carol@example.com", name: "Carol Menon",  gender: "FEMALE", dob: "1997-01-20" });
  const dave  = await createUser(db, { mobile: "+919000000004", email: "dave@example.com",  name: "Dave Rao",     gender: "MALE",   dob: "1992-11-30" });
  const admin = await createUser(db, { mobile: "+919000000009", email: "admin@example.com", name: "Site Admin",   gender: "MALE",   dob: "1985-01-01", role: "admin" });

  for (const id of [alice, bob, carol, dave, admin]) {
    await db.query(`insert into public.registrations (user_id) values ($1)`, [id]);
  }

  await verifyUser(db, alice);
  await verifyUser(db, bob);
  await payAndAwaitReview(db, carol);
  await db.query(`update public.registrations set status = 'SUBMITTED'       where user_id = $1`, [dave]);
  await db.query(`update public.registrations set status = 'PAYMENT_PENDING' where user_id = $1`, [dave]);

  // Private records that must never leak across users.
  await db.query(
    `insert into public.documents (user_id, document_type, storage_path, mime_type, size_bytes,
                                   is_locked, consent_given, consent_text, consent_timestamp)
     select id, 'AADHAAR', id || '/aadhaar.webp', 'image/webp', 90000, true, true, 'I consent…', now()
       from public.users where role = 'user'`,
  );
  await db.query(
    `insert into public.payments (user_id, registration_id, amount, status, gateway_order_id)
     select r.user_id, r.id, 999, 'SUCCESS', 'order_' || left(r.user_id::text, 8)
       from public.registrations r
       join public.users u on u.id = r.user_id
      where u.role = 'user'`,
  );

  return { alice, bob, carol, dave, admin };
}
