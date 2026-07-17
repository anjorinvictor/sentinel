import {
  LayoutGrid,
  Send,
  ShieldCheck,
  Eye,
  Activity,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

/**
 * The five Sentinel screens (CLAUDE.md design spec). This is the whole product —
 * no sixth item. Order matches the approved Lovable design.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutGrid },
  { label: "Transfer", href: "/transfer", icon: Send },
  { label: "Scam Check", href: "/scam-check", icon: ShieldCheck },
  { label: "Trust Panel", href: "/trust-panel", icon: Eye },
  { label: "Activity", href: "/activity", icon: Activity },
];
