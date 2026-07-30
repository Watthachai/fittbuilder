import { describe, expect, it } from "vitest";
import {
  BASE_DEP_NAMES,
  DEMO_PACKAGE_JSON,
  extraDepsOf,
  newPackages,
  packageJsonWithDeps,
} from "../scaffold";

describe("newPackages", () => {
  it("installs a package the project does not have", () => {
    expect(newPackages(["recharts", "lucide-react"], {})).toEqual(["recharts", "lucide-react"]);
  });

  it("never re-resolves a scaffold base dependency", () => {
    // react → "latest" would drag a React-18 demo onto React 19.
    expect(newPackages(["react", "react-dom", "vite", "@vitejs/plugin-react"], {})).toEqual([]);
    expect(BASE_DEP_NAMES.has("react")).toBe(true);
  });

  it("keeps an already-installed package at its pinned version", () => {
    const installed = { recharts: "^2.15.0" };
    expect(newPackages(["recharts", "sonner"], installed)).toEqual(["sonner"]);
  });
});

describe("packageJsonWithDeps", () => {
  it("returns the scaffold copy byte-for-byte with no extras (install cache hit)", () => {
    expect(packageJsonWithDeps({})).toBe(DEMO_PACKAGE_JSON);
  });

  it("round-trips extras through extraDepsOf", () => {
    const extra = { recharts: "latest", "lucide-react": "^0.500.0" };
    expect(extraDepsOf(packageJsonWithDeps(extra))).toEqual(extra);
  });
});
