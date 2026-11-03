# Quotations and proposals are approved before they reach a customer

Date: 2026-11-03 · Status: draft, waiting for the user's approval

## Why

A workspace needs a person to check a quotation or a proposal before it goes
to a customer. Today anyone who can edit a project can print it or export it
to Word, and neither document has a status. The user asked for an approval
step and a role whose whole job is that step.

## What the user decided

- **The Approver role.** A new workspace role, Approver (ผู้อนุมัติ).
  - An approver's FITT Builder is one page: the documents waiting for them,
    and approve or return.
  - To check a document they can open its project, every tab, read-only.
- **Owners and admins approve too.**
- **The sender picks the approver** when they send a document for approval.
- **Documents:** the quotation and the proposal (ข้อเสนอโครงการ). BRD and PRD
  are out.
- **Applies to every workspace,** partner workspaces included. A project that
  is not in a workspace needs no approval.
- **An edit after approval** returns the document to "not approved".
  - Only an approved document can be printed or exported (PDF, Word).
- **Notifying the approver:** the in-app bell and an email.

## Design

### Roles and access

- **Schema.** `fittbuilder_org_members.role` and `fittbuilder_org_invites.role`
  accept `'approver'`, next to `'admin'` and `'member'`.
- **Access functions.** An approver is a member for reading and not for
  writing.
  - `fittbuilder_is_org_member` keeps returning true for an approver. Every
    read path uses it, including the projects SELECT policy.
  - Writes need a new `fittbuilder_can_work_in_org(oid, uid)`: the owner, or
    a member whose role is `admin` or `member`.
- **Policies to switch to the new function.** The write paths that call
  `fittbuilder_is_org_member` today, all of them:
  - `fittbuilder_can_edit_project`: its org branch.
  - `orgs_update`: workspace settings and Org DNA (migration 0015).
  - `skill_templates_insert`, `skill_templates_update` and
    `skill_templates_delete` (0019, 0020).
  - `advisor_reports_insert` and `advisor_reports_delete` (0023).
  - The document-number function in 0041.
  - Check 0021 the same way.
- **Studio.** `getAccess` (lib/storage.ts) returns role `"viewer"` for an
  approver. The studio already opens read-only for a viewer
  (Studio.tsx:2248), so an approver can open every tab without editing.
- **Landing.** A user who is only ever an approver (no project of their own
  and no other role) lands on `/approvals`. Everyone who can approve
  anywhere also gets an "อนุมัติเอกสาร" entry in the header.

### Data

One new table, `fittbuilder_doc_approvals`:

| column | |
|---|---|
| `id` | uuid |
| `project_id` | the project; cascades on delete |
| `doc_kind` | `'quote'` or `'proposal'` |
| `version` | the `VersionKey`. Quotations and proposals are kept per version (0042) |
| `requested_by`, `requested_at` | who sent it, when |
| `approver_id` | the person it was sent to |
| `snapshot` | jsonb. The document as sent; this is what the approver reads |
| `doc_hash` | hash of the snapshot |
| `status` | `'pending'`, `'approved'`, `'returned'` or `'withdrawn'` |
| `decided_by`, `decided_at`, `comment` | the decision, and the reason for a return |

- **Approved means one thing:** the newest request for (project, kind,
  version) that is not withdrawn was approved, and its `doc_hash` equals the
  live document's. The hash is taken
  over the parsed document (`parseDoc` for a quotation, `parseProposal` for a
  proposal; keys sorted), by one shared function. Any edit changes the hash, and the document is not approved
  again until someone approves the new content.
- **One request at a time.** A new request for the same (project, kind,
  version) withdraws the pending one.

**Access rules for the table:**
- **Read:** `fittbuilder_can_read_project`.
- **Request:** insert where `fittbuilder_can_edit_project` holds and
  `requested_by = auth.uid()`. The `approver_id` must be someone who can
  approve in that project's workspace.
- **Decide:** only through a SECURITY DEFINER function
  `fittbuilder_decide_approval(id, approve, comment)`. It accepts the
  request's `approver_id`, or the owner or an admin of the workspace.
- **Approve without a request:** `fittbuilder_approve_now(project, kind,
  version, snapshot, hash)`, for the owner and admins. It records a request
  and its approval in one step.

### The quotation and proposal panels

- **A status line** above the print buttons, in one of these states:
  - ยังไม่ส่งอนุมัติ
  - รออนุมัติจาก ‹name›
  - อนุมัติแล้วโดย ‹name› ‹date›
  - ส่งกลับให้แก้: ‹comment›
  - แก้หลังอนุมัติแล้ว — ต้องอนุมัติใหม่
- **"ส่งอนุมัติ"** opens a list of the people who can approve in this
  workspace: approvers, admins and the owner. Owners and admins also get
  "อนุมัติเอง".
- **Print to PDF and Save as Word** are disabled until the live document is
  approved, and the reason is shown next to them. This applies to workspace
  projects only.

### The approval page, `/approvals`

- **The list:**
  - Requests sent to me, oldest first.
  - Admins and owners also see every pending request in their workspaces.
  - Decided requests appear as history below.
- **One request:**
  - The snapshot, rendered by the same `QuotationPrint` or `ProposalPrint`
    that prints it, so the approver reads the paper the customer will get.
  - Beside it: approve, or return with a comment (the comment is required).
  - A link that opens the project read-only, for the gallery, the flow and
    the other tabs.

### Notifications

- **Email** through DMail, sent from a new API route when a request is made.
  - It needs one new template, "FITT Builder — เอกสารรออนุมัติ", with the
    variables `requesterName`, `docKind`, `projectName` and `link`.
  - The user creates the template in DMail; we design its HTML as we did for
    the partner invite.
- **The bell.** An "อนุมัติ" bell next to the case bell, with the count of
  requests waiting on me, built the way `CaseBell` is.
- **The requester** sees the decision in the panel's status line.

### Rollout

- **Existing documents start unapproved.** Every quotation and proposal
  already in a workspace begins as "ยังไม่ส่งอนุมัติ", so printing it is
  blocked until it is approved.
  - An owner or admin clears their own in one click ("อนุมัติเอง").
  - Members of partner workspaces will hit the block first. Their admins
    should be told before release, and the changelog should say it plainly.
- **The production migration** is applied only with the user's OK.

## Calls I made (the user should check these)

1. Any edit to the content (even a customer's phone number) needs a new
   approval. The approved state is the hash comparison above.
2. The approver reviews the snapshot that was sent, not the live document, so
   it cannot change under them while they read.
3. The requester gets no email about the decision: the status line and the
   bell are enough for now.
4. Owners and admins can approve without a request ("อนุมัติเอง").
5. The block on printing lives in the UI. Printing and the Word file are made
   in the browser, so the server cannot stop someone who goes around the
   buttons. This is a process control, not a security boundary.
6. A new request withdraws the one already pending.
7. Someone shared into a single project (a project editor outside the
   workspace) can send for approval but cannot approve.
8. An approver who also has projects or other roles keeps the normal studio,
   plus the "อนุมัติเอกสาร" entry.

## Not in this

- Approving BRD/PRD or demo code.
- Chains of approvers, or thresholds by amount.
- Electronic signatures.

## Order of work

1. Roles and access: migration, the new access function and the policy
   switch, the role in the members page and in invites, and `getAccess`.
2. The approvals table and functions. Then the quotation panel: status,
   sending, "อนุมัติเอง", and the print and Word block.
3. The same for the proposal panel.
4. The `/approvals` page.
5. The bell and the email (plus the DMail template).
