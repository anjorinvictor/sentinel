import type { LucideIcon } from "lucide-react";

/**
 * Temporary placeholder used by not-yet-built screens so the sidebar nav
 * resolves to real routes. Replaced screen-by-screen in the build order.
 */
export function ScreenPlaceholder({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-card text-primary ring-1 ring-inset ring-border">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-8 rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
        Coming next in the build order.
      </div>
    </div>
  );
}
