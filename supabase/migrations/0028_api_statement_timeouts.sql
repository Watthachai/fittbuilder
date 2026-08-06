-- A slow query must fail. It must not take the database with it.
--
-- On 2026-08-06 the studio re-read multi-megabyte project rows in a loop until
-- Postgres stopped answering: 79 of 100 requests timed out and the whole
-- product was down for everyone, including people whose projects had nothing
-- to do with it. The application bug is fixed (migration 0027 and the reads
-- around it), but the shape of that failure — one expensive path saturating
-- shared compute — is not specific to that bug and will be reachable again by
-- some future query nobody predicted.
--
-- These are the blast-radius controls. With them, the same mistake costs one
-- failed request and a visible error instead of an outage.
--
-- The values are per API role, not global: an admin session or a migration
-- can still run long, and Supabase's own internal roles are untouched.

-- PostgREST's roles. `authenticated` is every signed-in user, `anon` is the
-- public/pre-login surface. 15s is far above any healthy request here (the
-- heaviest legitimate read, a whole project, is well under a second) and far
-- below the point where a pile-up becomes unrecoverable.
alter role authenticated set statement_timeout = '15s';
alter role anon set statement_timeout = '10s';

-- A transaction left open holds locks and a connection. On a small instance a
-- handful of these exhausts the pool, which looks exactly like "the database is
-- down" from the outside.
alter role authenticated set idle_in_transaction_session_timeout = '30s';
alter role anon set idle_in_transaction_session_timeout = '30s';

-- The service role runs trusted server-side work (usage logging, admin
-- reports). Still bounded — nothing in this product legitimately runs for a
-- minute — but bounded more generously than a user request.
alter role service_role set statement_timeout = '60s';
alter role service_role set idle_in_transaction_session_timeout = '60s';

notify pgrst, 'reload schema';
