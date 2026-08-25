"use client";

/**
 * Printing a sheet that has pictures on it.
 *
 * `window.print()` freezes the document the instant it is called, so anything
 * still in flight prints as a blank box. The quotation used to wait two
 * animation frames — about 32 ms — which is a paint wait, not a load wait. Two
 * frames is plenty for layout and nowhere near enough to fetch a dozen PNGs
 * from object storage, so whether a picture appeared came down to whether the
 * browser happened to have it cached already: browse the gallery tab first and
 * the appendix printed, go straight to print and it came out empty, print a
 * second time and it worked because the first attempt had warmed the cache.
 *
 * So wait on the images themselves. `decode()` is the right signal — it
 * resolves when the pixels are ready to paint, where `complete` is also true
 * for an image that failed to load.
 */

/** A dead or crawling URL must not trap the person at a button that never fires. */
export const IMAGE_TIMEOUT_MS = 8_000;

/**
 * The part of an `<img>` this module actually needs.
 *
 * Narrowed to three members so the waiting rules can be tested without a DOM —
 * the timeout and the swallowed rejection below are exactly the behaviours
 * worth pinning down, and they do not need a browser to exercise.
 */
export interface Decodable {
  complete: boolean;
  naturalWidth: number;
  decode(): Promise<unknown>;
}

const after = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const nextPaint = (): Promise<void> =>
  new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/**
 * Resolve once this image has pixels — or once it is certain it never will.
 *
 * A 404 resolves rather than rejecting: one missing screenshot must not hold
 * the whole document hostage. It prints as the browser's broken-image box,
 * which is the honest outcome.
 */
function settled(img: Decodable): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return Promise.resolve(img.decode()).then(
    () => undefined,
    () => undefined
  );
}

/** Wait for every picture, but never longer than the timeout. */
export async function awaitImages(
  imgs: Decodable[],
  timeoutMs: number = IMAGE_TIMEOUT_MS
): Promise<void> {
  if (imgs.length === 0) return;
  await Promise.race([Promise.all(imgs.map(settled)), after(timeoutMs)]);
}

/** DOM adapter: every `<img>` inside `root`. */
export const imagesReady = (root: HTMLElement): Promise<void> =>
  awaitImages(Array.from(root.querySelectorAll("img")));

/**
 * Mount a print sheet, wait for it to be photographable, print, unmount.
 *
 * `mount` and `unmount` are the caller's state setters — this owns the timing,
 * not the markup. `rootId` is the element the print stylesheet keeps visible;
 * if it is missing we still print, because a sheet with no pictures is a real
 * case and refusing to print would be worse than printing early.
 *
 * `fileName` names the saved PDF: the browser's "Save as PDF" takes its
 * default from document.title, so it is swapped in for the duration of the
 * dialog and restored after — the only lever a web page has over that name.
 */
export async function printSheet(
  mount: () => void,
  unmount: () => void,
  opts: { rootId?: string; fileName?: string } = {}
): Promise<void> {
  const { rootId = "fitt-print-root", fileName } = opts;
  const restoreTitle = document.title;
  mount();
  try {
    await nextPaint();
    const root = document.getElementById(rootId);
    if (root) await imagesReady(root);
    // One more paint: decoded images change their box, and the print dialog
    // should see the settled layout rather than one mid-reflow.
    await nextPaint();
    if (fileName) document.title = fileName;
    window.print();
  } finally {
    document.title = restoreTitle;
    unmount();
  }
}
