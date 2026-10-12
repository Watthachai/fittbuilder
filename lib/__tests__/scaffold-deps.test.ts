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
    expect(newPackages(["recharts", "zustand"], {})).toEqual(["recharts", "zustand"]);
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
    const extra = { recharts: "latest", zustand: "^5.0.0" };
    expect(extraDepsOf(packageJsonWithDeps(extra))).toEqual(extra);
  });

  /**
   * Case #20: @react-three/fiber "latest" is 9.x, which needs react >=19; the
   * demo runs React 18, so npm install stopped at ERESOLVE and the preview never
   * opened. Ranges are the last majors whose peers accept React 18 (npm, 12 Oct 2026).
   */
  it("installs the last React 18 major of a package whose latest needs React 19", () => {
    const deps = JSON.parse(
      packageJsonWithDeps({
        "@react-three/fiber": "latest",
        "@react-three/drei": "latest",
        "@react-three/postprocessing": "latest",
        "@react-three/rapier": "latest",
        "react-leaflet": "latest",
        three: "latest",
      })
    ).dependencies;
    expect(deps["@react-three/fiber"]).toBe("^8.18.0");
    expect(deps["@react-three/drei"]).toBe("^9.122.0");
    expect(deps["@react-three/postprocessing"]).toBe("^2.19.1");
    expect(deps["@react-three/rapier"]).toBe("^1.5.0");
    expect(deps["react-leaflet"]).toBe("^4.2.1");
    expect(deps.three).toBe("latest");
  });

  it("keeps a range someone chose on purpose", () => {
    expect(JSON.parse(packageJsonWithDeps({ "@react-three/fiber": "^8.17.0" })).dependencies["@react-three/fiber"]).toBe(
      "^8.17.0"
    );
  });
});
