-- Persist the last "sent to FITT Code Runner" hand-off per project so the studio
-- can show a durable chip ("ส่งไป Code Runner แล้ว · build #N") that survives a
-- reload and is visible to every collaborator — instead of relying on a team-chat
-- message that scrolls away. One row per project = the LATEST send.
--
-- jsonb payload shape (camelCase, written by the client after a successful send):
--   { "buildNo": 12, "branch": "crn/<id>", "jobId": "...", "status": "queued",
--     "tag": "alpha-test", "sentAt": "2026-07-01T..." }
--
-- Written by the sender (owner/editor) through the existing projects_update RLS
-- policy (fittbuilder_can_edit_project) — no new policy needed.
alter table fittbuilder_projects
  add column if not exists runner_last jsonb;
