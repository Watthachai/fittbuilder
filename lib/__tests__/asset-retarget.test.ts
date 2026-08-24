import { describe, expect, it } from "vitest";
import { retargetAssetProxy, retargetAssetProxyText } from "@/lib/asset-retarget";

/**
 * The bug these pin down: generation baked the generating machine's origin
 * into the demo's relay URLs, so a project generated on localhost rendered a
 * page of broken images when opened on production — nothing answers on the
 * viewer's localhost. Every container write path now normalizes the origin.
 */
describe("retargetAssetProxy", () => {
  const PROD = "https://fitt-builder.fittbsa.com";
  const localSrc =
    'src="http://localhost:3000/api/asset?url=https%3A%2F%2Fraft-blast-61784561.figma.site%2F_assets%2Fv11%2Fabc.png"';

  it("repoints a localhost-baked relay URL at the viewing origin", () => {
    const out = retargetAssetProxy({ "src/App.tsx": localSrc }, PROD);
    expect(out["src/App.tsx"]).toBe(
      'src="https://fitt-builder.fittbsa.com/api/asset?url=https%3A%2F%2Fraft-blast-61784561.figma.site%2F_assets%2Fv11%2Fabc.png"'
    );
  });

  it("works in the other direction too — prod-baked files run on localhost", () => {
    const out = retargetAssetProxyText(
      `url(${PROD}/api/asset?url=https%3A%2F%2Fcdn.example%2Ffont.woff2)`,
      "http://localhost:3000"
    );
    expect(out).toBe(
      "url(http://localhost:3000/api/asset?url=https%3A%2F%2Fcdn.example%2Ffont.woff2)"
    );
  });

  it("rewrites every occurrence across every file", () => {
    const files = {
      "a.tsx": `${localSrc}\n${localSrc}`,
      "b.css": `background: url(http://localhost:3000/api/asset?url=x%2Fy.png);`,
    };
    const out = retargetAssetProxy(files, PROD);
    expect(out["a.tsx"].match(/fitt-builder\.fittbsa\.com/g)).toHaveLength(2);
    expect(out["b.css"]).toContain(`${PROD}/api/asset?url=x%2Fy.png`);
  });

  /** The encoded target URL rides behind ?url= — it must survive untouched. */
  it("leaves the encoded destination exactly as it was", () => {
    const out = retargetAssetProxyText(
      "http://localhost:3000/api/asset?url=https%3A%2F%2Fhost%2Fa%3Fv%3D2",
      PROD
    );
    expect(out.endsWith("?url=https%3A%2F%2Fhost%2Fa%3Fv%3D2")).toBe(true);
  });

  it("does not touch URLs that are not the relay", () => {
    const src = 'href="https://example.com/docs" · src="https://cdn.example/a.png"';
    expect(retargetAssetProxyText(src, PROD)).toBe(src);
  });

  it("returns the same object when nothing needs to move", () => {
    const files = { "a.tsx": `src="${PROD}/api/asset?url=x"` };
    expect(retargetAssetProxy(files, PROD)).toBe(files);
  });
});
