import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { open, seal } from "@/lib/deploy/secret-box";

const key = randomBytes(32).toString("base64");

describe("secret-box", () => {
  it("opens what it sealed, and never seals the same way twice", () => {
    const a = seal("first-admin-password", key);
    expect(a).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(a).not.toContain("first-admin-password");
    expect(open(a, key)).toBe("first-admin-password");
    expect(seal("first-admin-password", key)).not.toBe(a);
  });

  it("refuses a tampered box, another key and a key that is not 32 bytes", () => {
    const box = seal("x".repeat(24), key);
    const parts = box.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => open(parts.join("."), key)).toThrow();
    expect(() => open(box, randomBytes(32).toString("base64"))).toThrow();
    expect(() => seal("x", randomBytes(16).toString("base64"))).toThrow(/32/);
    expect(() => seal("x", undefined)).toThrow(/FITT_DEPLOY_SECRET_KEY/);
  });
});
