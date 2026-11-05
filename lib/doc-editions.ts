import { docContent, NUMBER_FIELDS } from "./doc-approval";

/**
 * An edition: a quotation or proposal someone chose to keep, to come back to.
 *
 * The document itself is one row that every keystroke saves over, so "keep this
 * price, try another" had nowhere to live. An edition is that price kept apart
 * (migration 0069). Editions are never changed: going back to one copies it onto
 * the open document and it stays as it was.
 *
 * Called an edition because "version" here is the Standard or Premium tier and
 * "revision" is the demo's history.
 */
export interface DocEdition {
  id: string;
  /** Counts up per document and tier, printed as v1, v2. Only ever seen in the panel. */
  number: number;
  /** The name the person gave it; empty when they gave none. */
  label: string;
  /** The document as kept, as stored. */
  payload: unknown;
  savedByName: string;
  savedAt: string;
}

export const editionName = ({ number, label }: Pick<DocEdition, "number" | "label">): string =>
  label ? `v${number} · ${label}` : `v${number}`;

/** What the open document kept as an edition is called when going back to another. */
export const keptLabel = (goingBackTo: number): string => `ก่อนดึง v${goingBackTo} กลับ`;

/**
 * The newest edition that says what the open document says, so the panel can
 * show where the document stands, and going back need not keep the same work twice.
 *
 * Compared the way approval compares, through the document's reader: an edition
 * saved before a field existed reads with that field's default, not as a change.
 *
 * @param editions newest first
 */
export function matchingEdition<E extends Pick<DocEdition, "payload">>(
  live: object,
  editions: E[],
  read: (doc: unknown) => object | null
): E | null {
  const content = docContent(read(live));
  return (
    editions.find((e) => {
      const saved = read(e.payload);
      return saved !== null && docContent(saved) === content;
    }) ?? null
  );
}

/**
 * The open document after going back to an edition: the edition's content under
 * the document's own number. The number is issued once at the first export and
 * is on paper from then on, so an edition saved before that does not take it away.
 */
export function restoredDoc<T extends object>(saved: T, live: T): T {
  const issued = Object.fromEntries(
    Object.entries(live).filter(([key, value]) => NUMBER_FIELDS.has(key) && value)
  );
  return { ...saved, ...issued };
}
