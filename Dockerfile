# syntax=docker/dockerfile:1
# FITT Builder — multi-stage production image for Cloud Run.
# Node 24 (current LTS), Debian slim base, non-root runtime, Next.js standalone.

# ---------- deps: install with the lockfile only (best layer cache) ----------
# Hardening (optional): pin the base by digest for reproducible/supply-chain-safe
# builds — `FROM node:24-slim@sha256:<hash>` (get it with `docker inspect node:24-slim`).
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- builder: compile the app ----------
FROM node:24-slim AS builder
WORKDIR /app
# NEXT_PUBLIC_* are inlined into the client bundle at BUILD time, so they must be
# present here as build args (not just at runtime). The anon key is public by
# design (protected by Supabase RLS) — safe to pass as a build arg.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- runner: minimal, non-root ----------
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Run as an unprivileged user.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs
# Next.js standalone output: server.js + only the traced node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Agent prompts read from disk at runtime (process.cwd()/agents). Copy them in
# explicitly so the route handlers can load them regardless of file tracing.
COPY --from=builder --chown=nextjs:nodejs /app/agents ./agents
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
