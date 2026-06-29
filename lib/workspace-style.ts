import { createElement } from "react";
import {
  Briefcase,
  Building2,
  Code2,
  Flame,
  Heart,
  Leaf,
  Palette,
  Rocket,
  Sparkles,
  Store,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/** Workspace accent colors (hex, stored on the org). */
export const WORKSPACE_COLORS = [
  "#64cefb",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#fbbf24",
  "#fb7185",
  "#22d3ee",
  "#94a3b8",
];

/** Workspace icons by key (stored on the org). */
export const WORKSPACE_ICONS: Record<string, LucideIcon> = {
  building2: Building2,
  rocket: Rocket,
  sparkles: Sparkles,
  briefcase: Briefcase,
  store: Store,
  palette: Palette,
  code2: Code2,
  heart: Heart,
  leaf: Leaf,
  flame: Flame,
};

export const WORKSPACE_ICON_KEYS = Object.keys(WORKSPACE_ICONS);
export const DEFAULT_COLOR = WORKSPACE_COLORS[0];
export const DEFAULT_ICON = "building2";

export function resolveIcon(key?: string | null): LucideIcon {
  return (key && WORKSPACE_ICONS[key]) || Building2;
}

/** Stable component that renders a workspace icon by key (avoids creating a
 *  component during render at each call site). */
export function WorkspaceIcon({ icon, ...props }: { icon?: string | null } & LucideProps) {
  return createElement(resolveIcon(icon), props);
}
