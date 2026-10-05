/**
 * Edits to a shared document, as the smallest changes that describe them.
 *
 * The quotation and the proposal are saved as one JSON document each. Two people
 * editing one used to overwrite each other whole: each screen held the copy it
 * loaded, and whoever saved last wrote that copy over everything the other had
 * typed. Sending each edit as "this field" or "this line, by its id" instead lets
 * the other screen apply it without touching anything else, so the two copies
 * converge rather than taking turns to win.
 *
 * A path walks objects by key and keyed lists — every element an object with a
 * string `id`, like quotation rows or payment terms — by `#<id>`. Any other value
 * changes whole. Two people typing in the very same field still resolve to the
 * last keystroke, which for a form is the expected outcome.
 */

export type Op =
  | { kind: "set"; path: string[]; value: unknown }
  | { kind: "remove"; path: string[] }
  | { kind: "order"; path: string[]; ids: string[] };

type Keyed = { id: string } & Record<string, unknown>;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isItem = (v: unknown): v is Keyed => isObject(v) && typeof v.id === "string";

/** Two lists to diff line by line: something in them, and every element keyed. */
const keyedPair = (a: unknown, b: unknown): a is Keyed[] =>
  Array.isArray(a) && Array.isArray(b) && a.length + b.length > 0 && [...a, ...b].every(isItem);

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const keyOf = (id: string) => `#${id}`;

export function diffDoc(prev: unknown, next: unknown, path: string[] = []): Op[] {
  if (same(prev, next)) return [];
  if (isObject(prev) && isObject(next)) {
    const keys = [...new Set([...Object.keys(prev), ...Object.keys(next)])];
    return keys.flatMap((k) => diffDoc(prev[k], next[k], [...path, k]));
  }
  if (keyedPair(prev, next)) {
    const before = new Map(prev.map((x) => [x.id, x]));
    const after = new Map((next as Keyed[]).map((x) => [x.id, x]));
    const ops: Op[] = [];
    for (const [id, item] of after) {
      const old = before.get(id);
      ops.push(...(old ? diffDoc(old, item, [...path, keyOf(id)]) : [{ kind: "set" as const, path: [...path, keyOf(id)], value: item }]));
    }
    for (const id of before.keys()) if (!after.has(id)) ops.push({ kind: "remove", path: [...path, keyOf(id)] });
    const nextIds = [...after.keys()];
    if (!same([...before.keys()], nextIds)) ops.push({ kind: "order", path, ids: nextIds });
    return ops;
  }
  return [{ kind: "set", path, value: next }];
}

/** The path leads somewhere this copy does not have. Not null: a field may be set to null. */
const MISS = Symbol("miss");

function applyOne(target: unknown, op: Op, depth = 0): unknown {
  const { path } = op;
  if (depth === path.length) {
    if (op.kind === "order" && Array.isArray(target)) {
      const items = target as Keyed[];
      const byId = new Map(items.map((x) => [x.id, x]));
      const placed = op.ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
      // A line only this side has (added here, not yet seen there) stays, at the end.
      return [...placed, ...items.filter((x) => !op.ids.includes(x.id))];
    }
    return op.kind === "set" ? op.value : MISS;
  }
  const seg = path[depth];
  const last = depth === path.length - 1;
  if (seg.startsWith("#") && Array.isArray(target)) {
    const id = seg.slice(1);
    const items = target as Keyed[];
    const at = items.findIndex((x) => isItem(x) && x.id === id);
    if (last && op.kind === "remove") return items.filter((_, i) => i !== at);
    if (at < 0) return last && op.kind === "set" ? [...items, op.value as Keyed] : MISS;
    const child = applyOne(items[at], op, depth + 1);
    if (child === MISS) return MISS;
    return items.map((x, i) => (i === at ? (child as Keyed) : x));
  }
  if (isObject(target)) {
    if (last && op.kind === "remove") return MISS;
    const child = applyOne(target[seg], op, depth + 1);
    if (child === MISS) return MISS;
    return { ...target, [seg]: child };
  }
  return MISS;
}

/**
 * Apply another screen's edits. `complete` is false when one could not land —
 * an edit to a line this copy has never seen — and the caller should reload the
 * saved document rather than carry on from a copy that has drifted.
 */
export function applyOps<T>(doc: T, ops: Op[]): { doc: T; complete: boolean } {
  let current: unknown = doc;
  let complete = true;
  for (const op of ops) {
    const next = applyOne(current, op);
    if (next === MISS) complete = false;
    else current = next;
  }
  return { doc: current as T, complete };
}
