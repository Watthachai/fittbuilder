import {
  CalendarCheck,
  Factory,
  LayoutDashboard,
  Rocket,
  ShoppingCart,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Factory,
  Users,
  ShoppingCart,
  LayoutDashboard,
  CalendarCheck,
  Rocket,
};

/** Renders a skill template's lucide icon by name (falls back to Sparkles). */
export default function SkillIcon({
  name,
  size = 18,
  className = "text-shine",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon size={size} className={className} />;
}
