"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * Persistent left rail. Client component because the active-item highlight
 * depends on the current route (usePathname). Matches the approved design:
 * gold shield brand lockup, "Banking" section, five nav items, signed-in footer.
 */
export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Brand lockup */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Shield className="h-5 w-5" strokeWidth={2.5} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-sidebar-foreground">
            Sentinel
          </div>
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Union Bank
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3">
        <div className="px-2 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Banking
        </div>
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-inset ring-primary/40"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-[18px] w-[18px]",
                      active ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Signed-in footer */}
      <div className="border-t border-sidebar-border px-5 py-4 text-xs text-muted-foreground">
        Signed in as{" "}
        <span className="font-medium text-sidebar-foreground">Amina Okafor</span>
      </div>
    </aside>
  );
}
