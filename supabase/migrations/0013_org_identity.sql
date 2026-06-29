-- Workspace visual identity: a color + icon so workspaces are easy to tell apart
-- (in the picker, sidebar, etc.). Defaults keep existing workspaces valid.
alter table fittbuilder_orgs
  add column if not exists color text not null default '#64cefb',
  add column if not exists icon text not null default 'building2';

notify pgrst, 'reload schema';
