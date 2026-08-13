-- Who asked to become a partner.
--
-- The form that writes here is on a public page, so the write goes through
-- /api/partner-lead (zod-validated, rate-limited, service role) rather than
-- straight from the browser. RLS is enabled and there are DELIBERATELY NO
-- POLICIES: with RLS on and nothing granted, anon and authenticated can neither
-- read nor write this table at all. Only the service role reaches it, which is
-- exactly the access this data should have — nobody's contact details, and
-- nobody else's enquiry, is readable by a signed-in user.

create table if not exists fittbuilder_partner_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text not null,
  email text not null,
  phone text not null default '',
  -- What they want to build / how many customers — free text, whatever they typed.
  note text not null default '',
  -- Which page sent them, so we can tell a landing-page lead from a referral.
  source text not null default 'partner-page',
  status text not null default 'new' check (status in ('new', 'contacted', 'won', 'lost')),
  created_at timestamptz not null default now()
);

create index if not exists fittbuilder_partner_leads_created_idx
  on fittbuilder_partner_leads (created_at desc);

alter table fittbuilder_partner_leads enable row level security;

notify pgrst, 'reload schema';
