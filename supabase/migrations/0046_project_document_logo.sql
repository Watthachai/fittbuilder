-- A logo for a project's documents, uploadable by whoever may edit the project.
--
-- The quotation and proposal each carry their own copy of the letterhead (see
-- QuoteBrand), and any editor can already change its name, address and tax id.
-- The logo was the one field they could not: it was uploaded into the
-- workspace's folder, which only the workspace owner or an admin may write to
-- (0029). An editor invited from outside the workspace — the normal way a
-- project is shared — was told they had no right to change the workspace's
-- logo, when all they were doing was putting one on this document.
--
-- A document's logo now lives under the project: org-brand/<project id>/…,
-- writable by anyone fittbuilder_can_edit_project admits. The workspace's own
-- default letterhead is still set only by its owner (orgs_update is unchanged).
--
-- Insert only: every upload gets a fresh timestamped name (a reprint of an old
-- document must keep the logo it was sent with), so nothing here is overwritten
-- or deleted. Every folder in this bucket is a uuid — a workspace, a person or
-- now a project — so the existing policies' uuid casts are unaffected.

drop policy if exists project_document_logo_insert on storage.objects;
create policy project_document_logo_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'org-brand'
    and fittbuilder_can_edit_project(((storage.foldername(name))[1])::uuid, auth.uid())
  );
