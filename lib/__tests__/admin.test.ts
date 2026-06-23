import { afterEach, expect, test } from "vitest";
import { isAdminEmail } from "@/lib/admin";

const orig = process.env.ADMIN_EMAILS;
afterEach(() => {
  process.env.ADMIN_EMAILS = orig;
});

test("matches an exact email, case-insensitively", () => {
  process.env.ADMIN_EMAILS = "wattchaichai@gmail.com";
  expect(isAdminEmail("wattchaichai@gmail.com")).toBe(true);
  expect(isAdminEmail("WATTCHAICHAI@GMAIL.COM")).toBe(true);
  expect(isAdminEmail("someone@gmail.com")).toBe(false);
});

test("matches any email at a @domain entry", () => {
  process.env.ADMIN_EMAILS = "@digitalvalue.co.th";
  expect(isAdminEmail("anyone@digitalvalue.co.th")).toBe(true);
  expect(isAdminEmail("a.b@digitalvalue.co.th")).toBe(true);
  expect(isAdminEmail("anyone@other.com")).toBe(false);
});

test("supports multiple entries and rejects nullish / unset", () => {
  process.env.ADMIN_EMAILS = "@digitalvalue.co.th, wattchaichai@gmail.com";
  expect(isAdminEmail("a@digitalvalue.co.th")).toBe(true);
  expect(isAdminEmail("wattchaichai@gmail.com")).toBe(true);
  expect(isAdminEmail("nope@gmail.com")).toBe(false);
  expect(isAdminEmail(null)).toBe(false);
  expect(isAdminEmail("")).toBe(false);
  process.env.ADMIN_EMAILS = "";
  expect(isAdminEmail("wattchaichai@gmail.com")).toBe(false);
});
