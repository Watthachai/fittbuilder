import { expect, it } from "vitest";
import { bootFiles } from "../files";
import { TAILWIND_BROWSER_CDN, VITE_CONFIG } from "../scaffold";

// A shared link booted the saved files as they were, while the studio healed
// them first: a demo saved with cdn.tailwindcss.com opened styled in the studio
// and as bare HTML for the customer it was sent to. Every boot path takes the
// files from here, so they cannot drift apart again.

it("heals a saved demo the preview's headers would break", () => {
  const out = bootFiles({
    "index.html": '<script src="https://cdn.tailwindcss.com"></script><div id="root"></div>',
    "src/App.tsx": "export default () => null;",
  });
  expect(out["index.html"]).toContain(TAILWIND_BROWSER_CDN);
  expect(out["index.html"]).not.toContain("cdn.tailwindcss.com");
});

it("boots our vite.config.js, whatever the project saved", () => {
  const out = bootFiles({ "vite.config.js": "export default {};", "src/App.tsx": "export default () => null;" });
  expect(out["vite.config.js"]).toBe(VITE_CONFIG);
});

it("fills the plumbing the model never wrote", () => {
  const out = bootFiles({ "src/App.tsx": "export default () => null;" });
  expect(out["index.html"]).toContain(TAILWIND_BROWSER_CDN);
});
