import {
  BookOpen,
  Boxes,
  Briefcase,
  Building2,
  CalendarCheck,
  Camera,
  CreditCard,
  Factory,
  GraduationCap,
  HeartPulse,
  LayoutDashboard,
  MessageSquare,
  Plane,
  Radar,
  Rocket,
  ShoppingCart,
  Sparkles,
  Stethoscope,
  Truck,
  Users,
  Utensils,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Factory,
  Users,
  ShoppingCart,
  LayoutDashboard,
  CalendarCheck,
  Rocket,
  Boxes,
  Briefcase,
  Building2,
  CreditCard,
  GraduationCap,
  HeartPulse,
  Stethoscope,
  MessageSquare,
  Plane,
  Radar,
  Truck,
  Utensils,
  Wallet,
  Wrench,
  BookOpen,
  Camera,
  Sparkles,
};

/** Curated lucide icon names admins can choose from when authoring a template. */
export const SKILL_ICON_NAMES: string[] = Object.keys(ICONS);

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
