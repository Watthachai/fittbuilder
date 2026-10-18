import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Seals a first administrator's password while it waits to be shown once
 * (AES-256-GCM with FITT_DEPLOY_SECRET_KEY, 32 random bytes in base64). A box is
 * "v1.<iv>.<tag>.<ciphertext>" in base64url; opening a tampered one throws.
 */
function key(keyB64: string | undefined): Buffer {
  if (!keyB64) throw new Error("FITT_DEPLOY_SECRET_KEY is not set");
  const k = Buffer.from(keyB64, "base64");
  if (k.length !== 32) throw new Error("FITT_DEPLOY_SECRET_KEY must be 32 bytes (base64)");
  return k;
}

export function seal(plain: string, keyB64: string | undefined = process.env.FITT_DEPLOY_SECRET_KEY): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(keyB64), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function open(sealed: string, keyB64: string | undefined = process.env.FITT_DEPLOY_SECRET_KEY): string {
  const [v, iv, tag, ct] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || ct === undefined) throw new Error("not a sealed box");
  const decipher = createDecipheriv("aes-256-gcm", key(keyB64), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
