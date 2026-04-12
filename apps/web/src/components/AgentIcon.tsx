import {
  UserSearch,
  TrendingUp,
  Calendar,
  Mail,
  Database,
  Sparkles,
  LineChart,
  Home,
  Settings,
  Plus,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP = {
  UserSearch,
  TrendingUp,
  Calendar,
  Mail,
  Database,
  Sparkles,
  LineChart,
  Home,
  Settings,
  Plus,
} as const satisfies Record<string, LucideIcon>;

export type LucideIconName = keyof typeof ICON_MAP;

export function AgentIcon({
  name,
  size = 20,
  className,
  strokeWidth = 2,
}: {
  name: LucideIconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon size={size} strokeWidth={strokeWidth} className={className} />;
}
