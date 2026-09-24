import { Banknote, Boxes, ChartPie, Clock, Factory, Landmark, PanelsTopLeft, Ship, Users, Warehouse } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The icons a module can be drawn with, by the name lucide-react exports them under.
 *
 * A module names its icon rather than holding the component because the name
 * travels further: the composer writes it into a built project's App.tsx as an
 * import, and the product's own shell looks the component up here. Keeping the
 * choice on the module is what makes the two agree — the map used to live in
 * the product's shell alone, so every built project fell back to one grid icon
 * for all ten modules.
 */
export const MODULE_ICONS = {
  Banknote,
  Boxes,
  ChartPie,
  Clock,
  Factory,
  Landmark,
  PanelsTopLeft,
  Ship,
  Users,
  Warehouse,
} satisfies Record<string, LucideIcon>;

export type ModuleIconName = keyof typeof MODULE_ICONS;
