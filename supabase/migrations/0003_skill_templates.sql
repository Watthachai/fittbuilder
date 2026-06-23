-- Admin-authored domain skill templates. Idempotent.
create table if not exists fittbuilder_skill_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  name_en text not null,
  tagline text not null default '',
  icon text not null default 'Sparkles',
  keywords jsonb not null default '[]',
  persona text not null default '',
  domain_knowledge text not null default '',
  build_guidance text not null default '',
  seed_data text not null default '',
  design_hints text,
  question_bank jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft','published')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fittbuilder_skill_templates_status_idx on fittbuilder_skill_templates (status);

-- reuse the updated_at touch fn from 0001
drop trigger if exists fittbuilder_skill_templates_touch on fittbuilder_skill_templates;
create trigger fittbuilder_skill_templates_touch
  before update on fittbuilder_skill_templates
  for each row execute function fittbuilder_touch_updated_at();

alter table fittbuilder_skill_templates enable row level security;

-- Published templates are readable by any authenticated user; authors can read their
-- own drafts. Writes have NO policy → denied for normal users; admin writes go through
-- the service-role client after an isAdminEmail check in the API route.
drop policy if exists skill_templates_select on fittbuilder_skill_templates;
create policy skill_templates_select on fittbuilder_skill_templates
  for select using (status = 'published' or created_by = auth.uid());

notify pgrst, 'reload schema';
