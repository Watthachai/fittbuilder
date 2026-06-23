-- Multi-party phase approval: every project member (owner + all invited members,
-- any role) must approve a phase before it advances. One row per (project, phase,
-- user). Auto-advance happens client-side once all approvers are present.
create table if not exists fittbuilder_phase_approvals (
  project_id uuid not null references fittbuilder_projects(id) on delete cascade,
  phase text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, phase, user_id)
);

alter table fittbuilder_phase_approvals enable row level security;

-- read: anyone who can read the project (owner or member)
drop policy if exists approvals_select on fittbuilder_phase_approvals;
create policy approvals_select on fittbuilder_phase_approvals
  for select using (fittbuilder_can_read_project(project_id, auth.uid()));

-- insert: you may record only YOUR OWN approval, on a project you can read.
-- (No .select() on insert, so this WITH CHECK is the only gate — no RETURNING.)
drop policy if exists approvals_insert on fittbuilder_phase_approvals;
create policy approvals_insert on fittbuilder_phase_approvals
  for insert with check (
    user_id = auth.uid() and fittbuilder_can_read_project(project_id, auth.uid())
  );

-- delete: you may withdraw your own approval
drop policy if exists approvals_delete on fittbuilder_phase_approvals;
create policy approvals_delete on fittbuilder_phase_approvals
  for delete using (user_id = auth.uid());

notify pgrst, 'reload schema';
