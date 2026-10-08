import { describe, expect, it } from "vitest";
import { pageOf } from "@/lib/paging";

const rows = Array.from({ length: 45 }, (_, i) => i + 1);

describe("pageOf", () => {
  it("shows the requested page of 20", () => {
    const p = pageOf(rows, "2");
    expect(p.items).toEqual(rows.slice(20, 40));
    expect(p).toMatchObject({ page: 2, pages: 3, from: 21, to: 40, total: 45 });
  });

  it("lands a page past the end on the last page", () => {
    const p = pageOf(rows, 9);
    expect(p).toMatchObject({ page: 3, from: 41, to: 45 });
  });

  it("treats a missing or nonsense page as the first", () => {
    expect(pageOf(rows, undefined).page).toBe(1);
    expect(pageOf(rows, "abc").page).toBe(1);
    expect(pageOf(rows, -3).page).toBe(1);
  });

  it("has one empty page when there is nothing", () => {
    expect(pageOf([], 1)).toEqual({ items: [], page: 1, pages: 1, from: 0, to: 0, total: 0 });
  });
});
