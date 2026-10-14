import JSZip from "jszip";
import { Packer, type Document } from "docx";

/**
 * Open a built .docx the way Word would and read it back as text.
 *
 * The Word export is checked through the file it produces, not through the
 * docx objects that build it: `header` is the page furniture that repeats on
 * every page, `body` is the document itself, and `pictures` counts the
 * pictures placed in each.
 * Line breaks inside a paragraph come back as "\n", tabs as "\t", and each
 * paragraph ends with "\n".
 */
export async function readWord(
  doc: Document
): Promise<{ header: string; body: string; pictures: { header: number; body: number } }> {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
  const names = Object.keys(zip.files);
  const read = (name: string) => zip.file(name)!.async("string");
  const headers = (await Promise.all(names.filter((n) => /^word\/header\d+\.xml$/.test(n)).map(read))).join("");
  const body = await read("word/document.xml");
  const count = (xml: string) => xml.split("<pic:pic ").length - 1;
  return {
    header: text(headers),
    body: text(body),
    pictures: { header: count(headers), body: count(body) },
  };
}

function text(xml: string): string {
  return xml
    .replace(/<w:br\/>/g, "\n")
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** A real 1×1 PNG — Word refuses a picture whose bytes are not an image. */
export const PIXEL = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0)
);
