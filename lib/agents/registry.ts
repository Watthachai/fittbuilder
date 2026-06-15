import { promises as fs } from "node:fs";
import path from "node:path";
import { agentSlugForPhase, type PhaseId } from "../phases";

/**
 * Agent registry. Every agent is a `SKILL.md` file at agents/<slug>/SKILL.md
 * (same convention as Claude Code / DVIBE). The frontmatter is metadata; the
 * markdown body becomes the agent's system prompt. Server-only — reads from
 * the filesystem at runtime, so never import this from a client component.
 */

export interface AgentDefinition {
  slug: string;
  name: string;
  description: string;
  phase: PhaseId;
  whenToUse: string;
  allowedTools: string[];
  /** Markdown body = the agent's system prompt. */
  body: string;
}

const AGENTS_DIR = path.join(process.cwd(), "agents");
const cache = new Map<string, AgentDefinition>();

/**
 * Minimal frontmatter parser for our fixed schema: scalar `key: value`
 * (optionally quoted) and one inline list `key: [a, b, c]`. We control the
 * SKILL.md format, so this stays dependency-free (no gray-matter / yaml).
 */
function parseFrontmatter(raw: string): {
  data: Record<string, string | string[]>;
  body: string;
} {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw.trim() };
  const [, frontmatter, body] = match;
  const data: Record<string, string | string[]> = {};
  for (const line of frontmatter.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = value
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      data[key] = value.replace(/^["']|["']$/g, "");
    }
  }
  return { data, body: body.trim() };
}

async function loadAgent(slug: string): Promise<AgentDefinition> {
  const cached = cache.get(slug);
  // Cache for the lifetime of the server in production; re-read in dev so
  // edits to a SKILL.md take effect without a restart.
  if (cached && process.env.NODE_ENV === "production") return cached;

  const file = path.join(AGENTS_DIR, slug, "SKILL.md");
  const raw = await fs.readFile(file, "utf-8");
  const { data, body } = parseFrontmatter(raw);
  const agent: AgentDefinition = {
    slug,
    name: String(data.name ?? slug),
    description: String(data.description ?? ""),
    phase: (typeof data.phase === "string" ? data.phase : "define") as PhaseId,
    whenToUse: typeof data.when_to_use === "string" ? data.when_to_use : "",
    allowedTools: Array.isArray(data["allowed-tools"]) ? data["allowed-tools"] : [],
    body,
  };
  cache.set(slug, agent);
  return agent;
}

export function getAgent(slug: string): Promise<AgentDefinition> {
  return loadAgent(slug);
}

export function getAgentForPhase(phase: PhaseId): Promise<AgentDefinition> {
  return loadAgent(agentSlugForPhase(phase));
}
