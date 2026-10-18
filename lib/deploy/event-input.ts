import { DEPLOY_ENVS, DEPLOY_STAGES, type DeployEnv, type DeployStage } from "./types";

export interface EventInput {
  env: DeployEnv;
  stage: DeployStage;
  build_no: number | null;
  digest: string | null;
  url: string | null;
  message: string;
  initial_admin_password: string | null;
}

const DIGEST = /^sha256:[a-f0-9]{64}$/;

/** What the deploy side may report. The same limits as migration 0059's checks. */
export function parseEventInput(body: unknown): { ok: true; value: EventInput } | { ok: false; message: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, message: "ต้องส่ง JSON object" };
  const b = body as Record<string, unknown>;
  if (!DEPLOY_ENVS.includes(b.env as DeployEnv)) return { ok: false, message: "env ต้องเป็น uat หรือ production" };
  if (!DEPLOY_STAGES.includes(b.stage as DeployStage)) return { ok: false, message: `stage ต้องเป็นหนึ่งใน ${DEPLOY_STAGES.join(", ")}` };
  const build = b.build_no ?? null;
  if (build !== null && !(Number.isInteger(build) && (build as number) >= 0)) return { ok: false, message: "build_no ต้องเป็นจำนวนเต็มตั้งแต่ 0" };
  const digest = b.digest ?? null;
  if (digest !== null && !(typeof digest === "string" && DIGEST.test(digest))) return { ok: false, message: "digest ต้องเป็น sha256:<64 hex>" };
  const url = b.url ?? null;
  if (url !== null && !(typeof url === "string" && url.startsWith("https://") && url.length <= 500)) return { ok: false, message: "url ต้องเป็น https:// และยาวไม่เกิน 500" };
  const message = typeof b.message === "string" ? b.message.trim() : b.message === undefined ? "" : null;
  if (message === null || message.length > 2000) return { ok: false, message: "message ต้องเป็นข้อความยาวไม่เกิน 2000" };
  const password = b.initial_admin_password ?? null;
  if (password !== null) {
    if (b.stage !== "ready") return { ok: false, message: "ส่งรหัสผ่านได้เฉพาะตอน stage = ready" };
    if (typeof password !== "string" || password.length < 16 || password.length > 200) return { ok: false, message: "รหัสผ่านต้องยาว 16–200 ตัว" };
  }
  return {
    ok: true,
    value: { env: b.env as DeployEnv, stage: b.stage as DeployStage, build_no: build as number | null, digest: digest as string | null, url: url as string | null, message, initial_admin_password: password as string | null },
  };
}
