"use client";

import { Packer, type Document } from "docx";
import { IMAGE_TIMEOUT_MS } from "@/lib/print-sheet";
import { proposalDocx } from "@/lib/proposal-word";
import { proposalSteps, type ProposalDoc } from "@/lib/proposal";
import { quotationDocx } from "@/lib/quotation-word";
import type { QuoteDoc } from "@/lib/quote";
import type { Shot } from "@/lib/shots";
import type { WordArt, WordImage } from "@/lib/word-paper";

/**
 * Saving the quotation or the proposal as a .docx, in the browser (case #27).
 *
 * The builders are pure; this is the part that needs a page. It fetches the
 * pictures, redraws each on a canvas, packs the file and hands it to the
 * browser as a download. The canvas step is what makes the pictures Word can
 * hold: a WebP logo becomes PNG (Word has no WebP), and a screenshot is cut to
 * the 4:3 frame the paper shows (`object-fit: cover; object-position: top`)
 * and scaled down. A full-page capture is thousands of pixels tall and would
 * otherwise make a fifty-screen file tens of megabytes.
 *
 * Loaded with a dynamic import from the panels, so the docx library is only
 * downloaded when someone asks for a Word file.
 */

/** Logo pixels kept, at most: three times its 200×84 box on the paper, sharp when printed. */
const LOGO_MAX = { width: 600, height: 252 };
/** Screenshot width kept: about three times the 62mm it fills on the proposal. */
const FRAME_WIDTH = 720;

/** The picture behind a URL, or null when it cannot be had in time. One missing picture must not stop the file. */
async function bitmap(url: string): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) });
    if (!res.ok) return null;
    return await createImageBitmap(await res.blob());
  } catch {
    return null;
  }
}

async function encode(canvas: HTMLCanvasElement, type: "png" | "jpg"): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type === "png" ? "image/png" : "image/jpeg", 0.85)
  );
  if (!blob) throw new Error("แปลงภาพไม่สำเร็จ");
  return new Uint8Array(await blob.arrayBuffer());
}

/** The logo whole, scaled into its box, as PNG so a transparent background stays transparent. */
async function logoImage(url: string): Promise<WordImage | null> {
  const bmp = await bitmap(url);
  if (!bmp) return null;
  const scale = Math.min(1, LOGO_MAX.width / bmp.width, LOGO_MAX.height / bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  // The shape is the original's, so the logo prints as large as it does on paper.
  return { data: await encode(canvas, "png"), type: "png", width: canvas.width / scale, height: canvas.height / scale };
}

/** A screenshot cut to the paper's 4:3 frame: full width from the top, or centred when the capture is wider than 4:3. */
async function frameImage(url: string): Promise<WordImage | null> {
  const bmp = await bitmap(url);
  if (!bmp) return null;
  const wide = bmp.width / bmp.height > 4 / 3;
  const sw = wide ? Math.round((bmp.height * 4) / 3) : bmp.width;
  const sh = wide ? bmp.height : Math.round((bmp.width * 3) / 4);
  const sx = wide ? Math.round((bmp.width - sw) / 2) : 0;
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(FRAME_WIDTH, sw);
  canvas.height = Math.round((canvas.width * 3) / 4);
  const ctx = canvas.getContext("2d")!;
  // JPEG has no transparency; a transparent capture would otherwise turn black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, sx, 0, sw, sh, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return { data: await encode(canvas, "jpg"), type: "jpg", width: canvas.width, height: canvas.height };
}

/** Everything the file shows, fetched together. `missing` counts the pictures (logo included) that could not be had. */
async function loadArt(logoUrl: string, shotUrls: string[]): Promise<{ art: WordArt; missing: number }> {
  const [logo, frames] = await Promise.all([
    logoUrl ? logoImage(logoUrl) : Promise.resolve(null),
    Promise.all(shotUrls.map(async (url) => [url, await frameImage(url)] as const)),
  ]);
  const shots = new Map<string, WordImage>();
  for (const [url, img] of frames) if (img) shots.set(url, img);
  const logoMissing = logoUrl && !logo ? 1 : 0;
  return { art: { logo, shots }, missing: shotUrls.length - shots.size + logoMissing };
}

async function download(file: Document, fileName: string): Promise<void> {
  const blob = await Packer.toBlob(file);
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = `${fileName}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on the next task: the click has started the download by then.
  setTimeout(() => URL.revokeObjectURL(href), 0);
}

/** Only the pictures the file will show are fetched — an appendix that is switched off costs nothing. */
export async function saveQuotationWord(doc: QuoteDoc, shots: Shot[], fileName: string): Promise<{ missing: number }> {
  const urls = doc.showShots ? shots.filter((s) => s.url).map((s) => s.url) : [];
  const { art, missing } = await loadArt(doc.brand.logoUrl, urls);
  await download(quotationDocx(doc, shots, art), fileName || "ใบเสนอราคา");
  return { missing };
}

export async function saveProposalWord(
  doc: ProposalDoc,
  quote: QuoteDoc | null,
  shots: Shot[],
  fileName: string
): Promise<{ missing: number }> {
  const urls = doc.showSteps && doc.showShots ? proposalSteps(shots, quote).map((s) => s.url) : [];
  const { art, missing } = await loadArt(doc.brand.logoUrl, urls);
  await download(proposalDocx(doc, quote, shots, art), fileName || "ข้อเสนอโครงการ");
  return { missing };
}
