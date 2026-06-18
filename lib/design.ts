/**
 * Design-preview picker (steer-one-build): before the FIRST build, the AI
 * proposes a handful of distinct visual directions. The user picks one, and the
 * choice is folded into the generation prompt as a style directive — so a single
 * build is steered, rather than building N apps (which is impractical in a
 * WebContainer). Mirrors Google AI Studio's "Design previews are ready" step.
 */

export interface DesignPalette {
  bg: string;
  surface: string;
  primary: string;
  text: string;
}

export interface DesignOption {
  /** Memorable English name, AI-Studio style (e.g. "Bento Grid"). */
  name: string;
  /** One-line Thai description of the look/feel. */
  description: string;
  palette: DesignPalette;
  /** Font + layout vibe, free text (e.g. "Inter, geometric sans, airy spacing"). */
  font: string;
}

/** Turn a chosen design into a prompt directive the code generator obeys. */
export function designStyleDirective(o: DesignOption): string {
  const { bg, surface, primary, text } = o.palette;
  return `[DESIGN DIRECTION] ใช้สไตล์ "${o.name}": ${o.description}
โทนสี — พื้นหลัง ${bg}, พื้นผิว/การ์ด ${surface}, สีหลัก/ปุ่ม ${primary}, ตัวอักษร ${text}.
ฟอนต์และเลย์เอาต์ — ${o.font}.
ยึดโทนสีและสไตล์นี้ให้สม่ำเสมอทั้งแอป (ใช้ Tailwind arbitrary values เช่น bg-[${bg}] text-[${text}] ได้).`;
}

/** Fetch design directions for a prompt; throws so the caller can fall back to a plain build. */
export async function fetchDesignOptions(
  input: { prompt: string; brd?: string; prd?: string },
  signal?: AbortSignal
): Promise<DesignOption[]> {
  const res = await fetch("/api/design-options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  if (!res.ok) throw new Error("design options request failed");
  const data = (await res.json()) as { options?: DesignOption[] };
  if (!Array.isArray(data.options) || data.options.length < 2) {
    throw new Error("no design options");
  }
  return data.options;
}
