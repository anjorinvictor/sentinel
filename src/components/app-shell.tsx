import { PanelLeft } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";

/**
 * Top-level layout frame shared by every screen: persistent sidebar on the left,
 * a header strip ("SENTINEL · PERSONAL BANKING"), and the scrollable page body.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-6">
          <PanelLeft className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Sentinel · Personal Banking
          </span>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
