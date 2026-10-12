import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { VITE_CONFIG } from "../scaffold";

// @babel/core ships no types; this is the one call the test makes.
const { transformSync } = createRequire(import.meta.url)("@babel/core") as {
  transformSync: (code: string, opts: object) => { code: string } | null;
};

/**
 * Case #21: a 3D demo built on @react-three/fiber crashed in the preview with
 * "Cannot read properties of undefined (reading 'fitt')". The dev-only Babel
 * plugin in the canonical vite config stamped data-fitt-loc on every lowercase
 * JSX element — <mesh>, <boxGeometry> too — and fiber reads a dashed prop as a
 * path into the object: data.fitt.loc. The vite build (no plugin) ran fine,
 * which is why it only ever broke in the preview.
 *
 * The plugin is run here as the preview runs it: its own source, cut from the
 * config string, through Babel.
 */
const start = VITE_CONFIG.indexOf("// Stamps data-fitt-loc");
const end = VITE_CONFIG.indexOf("export default defineConfig");
const fittLoc: unknown = new Function(`${VITE_CONFIG.slice(start, end)}; return fittLoc;`)();

const stamp = (code: string) =>
  transformSync(code, {
    filename: "/home/project/src/Scene.tsx",
    parserOpts: { plugins: ["jsx", "typescript"] },
    plugins: [fittLoc],
    babelrc: false,
    configFile: false,
  })!.code;

describe("the data-fitt-loc stamp", () => {
  it("marks HTML and SVG elements with their line in the source", () => {
    const out = stamp(`const a = <div>\n  <button />\n  <svg><path d="M0 0" /><linearGradient id="g" /></svg>\n</div>;`);
    expect(out).toContain('data-fitt-loc="src/Scene.tsx:1:10"');
    expect(out).toContain('data-fitt-loc="src/Scene.tsx:2:2"');
    expect(out.match(/data-fitt-loc/g)).toHaveLength(5);
  });

  it("leaves react-three-fiber's scene elements alone", () => {
    const out = stamp(
      `const s = <group><mesh castShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="red" /></mesh><ambientLight /><color attach="background" args={["#000"]} /></group>;`
    );
    expect(out).not.toContain("data-fitt-loc");
  });

  it("leaves components alone, as before", () => {
    expect(stamp(`const c = <Canvas><Scene /></Canvas>;`)).not.toContain("data-fitt-loc");
  });
});
