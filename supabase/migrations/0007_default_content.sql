-- ═══════════════════════════════════════════════════════════════════════════
-- 0007 — Default site content and settings
--
-- Everything the public website renders is a row, not a code constant, so the
-- admin can edit copy without a redeploy (PRD §13). These are placeholders —
-- replace them from /admin/content once the real copy arrives.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.site_content (key, value) values
  ('hero', jsonb_build_object(
    'title',    'Find the one who feels like home',
    'subtitle', 'A considered, private matrimonial service for families who value trust as much as tradition.',
    'ctaPrimary',   'Register free',
    'ctaSecondary', 'Login'
  )),
  ('about', jsonb_build_object(
    'title', 'About us',
    'body',  'We help families meet the right match with care, discretion and verification at every step. Every profile on our platform is reviewed by a real person before it becomes visible.'
  )),
  ('why_choose_us', jsonb_build_object(
    'title', 'Why choose us',
    'items', jsonb_build_array(
      jsonb_build_object('title', 'Every profile verified', 'body', 'No profile becomes visible until our team has checked the documents behind it.'),
      jsonb_build_object('title', 'Your privacy protected', 'body', 'Your phone number is never shown to another member. Your documents are never shared.'),
      jsonb_build_object('title', 'Serious intentions only', 'body', 'A paid, verified membership keeps the community genuine.'),
      jsonb_build_object('title', 'Matches, not browsing', 'body', 'Interest is mutual by design — you only connect when both sides agree.')
    )
  )),
  ('cta', jsonb_build_object(
    'title',    'Begin your search today',
    'subtitle', 'Registration takes a few minutes. Verification is usually complete within 24 hours.',
    'button',   'Create your profile'
  )),
  ('contact', jsonb_build_object(
    'companyName', 'Your Company Name',
    'phone',       '+91 00000 00000',
    'email',       'hello@example.com',
    'address',     'Address line 1, City, State 000000',
    'hours',       'Monday to Saturday, 10am to 7pm'
  )),
  ('footer', jsonb_build_object(
    'tagline',   'Thoughtful matchmaking, carefully verified.',
    'copyright', 'All rights reserved.'
  ))
on conflict (key) do nothing;

insert into public.admin_settings (key, value) values
  -- Shown on every profile detail page INSTEAD of the profile owner's own
  -- number, which is never exposed to another member (PRD §8.2).
  ('admin_contact_number', to_jsonb('+91 00000 00000'::text)),
  ('registration_fee',     jsonb_build_object('amount', 999, 'currency', 'INR')),
  ('results_per_page',     to_jsonb(20))
on conflict (key) do nothing;

insert into public.faqs (question, answer, sort_order) values
  ('How do I register?', 'Start with your mobile number, verify it, create a password and complete your profile. Upload your photo and Aadhaar, complete the payment, and our team will verify your profile.', 1),
  ('Why do you need my Aadhaar?', 'Aadhaar lets us confirm that every member is a real, verifiable person. It is stored privately, visible only to our verification team, and is never shown to other members.', 2),
  ('Will other members see my phone number?', 'No. Your personal number is never displayed to another member. Profile pages show our office contact number instead.', 3),
  ('How long does verification take?', 'Most profiles are reviewed within 24 hours of a successful payment.', 4),
  ('What happens when I send an interest?', 'The other member is notified and can accept or decline. When interest is mutual and accepted on both sides, you both become a match.', 5),
  ('Can I edit my profile later?', 'Yes. You can update your optional details and replace your photo at any time. Your name and Aadhaar are fixed once your profile is verified.', 6)
on conflict do nothing;
