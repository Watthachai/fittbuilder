# Code Runner deploy side ↔ FITT Builder

Code Runner (CRN) builds on its own machine and pushes every image to Artifact Registry. Its deploy side runs in GCP Cloud Build — once per new image and every five minutes — and asks FITT Builder what each project wants. FITT Builder keeps the answer, records what happened and shows it in the export dialog (`components/studio/CloudDelivery.tsx`). CRN's side lives in its repo at `deploy/gcp/`.

## Data (migration 0059)

| table | holds | who reads / writes |
|---|---|---|
| `fittbuilder_project_delivery` | `target` (`local` \| `cloud`), `admin_email` (required for cloud). No row = local | the project's readers read, editors write (RLS) |
| `fittbuilder_project_deploy_events` | every step: `env` (`uat` \| `production`), `stage`, `build_no`, `digest`, `url`, `message` | service role writes; the project's readers read |
| `fittbuilder_project_initial_passwords` | a first administrator's password, sealed, until shown once (`ciphertext` then null) | service role only |

Stages: `waiting_image` → `registering` → `deploying` → `ready`, or `failed`.

## Credential

A `CODE_RUNNER` binding in `fittbuilder_integration_bindings`, global like FITT Billing's (no workspace, no person). Only its SHA-256 is stored.

```
node scripts/deploy-binding.mjs create "Code Runner deploy"   # shown once
node scripts/deploy-binding.mjs list
node scripts/deploy-binding.mjs revoke <binding-id>
```

Paste the token into the prompt of CRN's `deploy/gcp/setup.sh`; it goes to Secret Manager as `crn-deploy-fb-token`. Never into a chat, a document or a repository.

`FITT_DEPLOY_SECRET_KEY` — 32 random bytes, base64 (`openssl rand -base64 32`) — must be in FITT Builder's server env. Without it a `ready` event that carries a password is refused with a retryable 500, and CRN keeps the password undelivered and sends it again.

## API

Base `/v1/integrations/deploy`, `Authorization: Bearer <token>`, 120 requests a minute per credential, errors in the `fittbuilder.error.v1` envelope (`retryable` true only for `rate_limited` and `internal`).

| request | answer |
|---|---|
| `GET /projects/{id}` | `{ project_id, name, target, admin_email }` · 404 when there is no such project |
| `GET /pending` | `{ projects: [{ project_id }] }` — cloud projects whose newest UAT event is missing or not `ready`, unless their newest build failed 3 times in a row, or another run said `registering`/`deploying` less than 15 minutes ago |
| `POST /projects/{id}/events` | body `{ env, stage, build_no?, digest?, url?, message?, initial_admin_password? }` → 202 · the password only with `stage: "ready"`, 16–200 characters, stored sealed and apart from the event · a `waiting_image` right after another `waiting_image` is not stored again |

## In the studio

`GET/PUT /api/projects/{id}/cloud` read and save the choice through the person's own session (RLS decides). `POST /api/projects/{id}/cloud/initial-password` `{ env }` shows the password once to someone who can edit the project (`fittbuilder_can_edit_project`): it opens the box, then clears it only if it is still the same box, so two clicks reveal it at most once.
