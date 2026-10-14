import { describe, expect, it } from "vitest";
import { billingError } from "@/lib/billing/errors";

describe("billing error envelope", () => {
  it("maps each code to its status and marks only transient ones retryable", async () => {
    const cases = [
      ["unauthorized", 401, false],
      ["not_found", 404, false],
      ["invalid_request", 400, false],
      ["rate_limited", 429, true],
      ["internal", 500, true],
    ] as const;
    for (const [code, status, retryable] of cases) {
      const res = billingError(code, "ข้อความ", "req_1");
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ schemaVersion: "fittbuilder.error.v1", code, message: "ข้อความ", retryable, requestId: "req_1" });
    }
  });

  it("tells a rate-limited caller when to come back", () => {
    expect(billingError("rate_limited", "ช้าลงหน่อย", "req_2", 17).headers.get("retry-after")).toBe("17");
  });
});
