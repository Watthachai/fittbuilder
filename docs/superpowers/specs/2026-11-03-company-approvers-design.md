# Company approvers (0.119.0)

## Why

0.118.0 put the approver on a workspace. Live data on 2026-11-03: 41 workspaces,
owned by 11 people, nearly all one customer each with nobody else in them. Only
"Digitalvalue" is shared (owner + 3 members, 21 projects). An approver set on one
workspace could not be sent a quotation from any other, and in those workspaces
the only name in "ส่งอนุมัติ" was the owner, who approves their own document.

Approval belongs to the company that sends the quotation, not to the customer's
workspace. So the approver moves up a level.

## The model

- **Company** (`fittbuilder_companies`): a name and an email domain. Made by us
  (migration), not by users. Digitalvalue (`digitalvalue.co.th`) is the first.
- **Company member** (`fittbuilder_company_members`): one company per person,
  role `admin` | `approver` | `member`.
  - Staff whose email has the company's domain join as `member` at sign-up
    (`fittbuilder_handle_new_user`); existing ones were added by the migration.
  - Anyone else joins by a **company link**: one use, a week, carries a role.
    Someone already in the company moves up to the link's role, never down; a
    link that would not move them is not spent.
  - The owner of the Digitalvalue workspace is the first admin.
- **A workspace belongs to the company of its owner.** No column: derived, so
  nothing has to be moved and a new workspace is in the company at once.

## What a company approver (or admin) gets

- Reads every workspace whose owner is in the company, and their projects —
  `fittbuilder_is_org_member` is true for them. Only SELECT policies call it.
- Is offered in "ส่งอนุมัติ" for those projects, labelled ผู้อนุมัติ / ผู้ดูแลบริษัท,
  after the workspace's owner and admins (who stay, as in 0.118.0).
- Writes nothing in the workspaces. `projects_insert` now also asks
  `fittbuilder_can_work_in_org` when a project carries a workspace id — before,
  any account could insert one into any workspace it knew the id of.
- Uses the app: company membership counts in `fittbuilder_has_access` (0061).
  Only company admins add people, and companies are made by us.

## Removed

The workspace `approver` role, its link invites (`email` null) and
`fittbuilder_accept_org_link`. Nobody held the role; the two link rows were
revoked test links.

## Pages

- `/company`: the company's people and roles; admins change roles, remove
  people, and make links (role chosen per link) with copy and revoke.
- `/join/<token>` also resolves company links; an approver lands on `/approvals`,
  anyone else on `/company`.
- Workspace members: roles are ผู้ดูแล / สมาชิก again, with a pointer to `/company`
  for approvers.

## Not now

ToWorkSmile (partner, 3 accounts) gets a company later; until then its
workspaces approve as in 0.118.0 (owner and admins). Email and the bell for
approvers are still to come.
