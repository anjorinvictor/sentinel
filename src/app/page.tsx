import { ShieldCheck } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="flex items-center gap-2 text-sm text-safe">
        <ShieldCheck className="h-4 w-4" />
        Sentinel is active
      </div>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Hello, Sentinel
      </h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Foundation is live: dark fintech theme, sidebar shell, and brand lockup
        are wired. The five screens, scoring engine, and Trust Panel land next.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { k: "Theme", v: "Navy · Gold · Teal" },
          { k: "Framework", v: "Next.js 16 · App Router" },
          { k: "Engine", v: "Deterministic scoring (next)" },
        ].map((c) => (
          <div key={c.k} className="rounded-xl border border-border bg-card p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {c.k}
            </div>
            <div className="mt-1 text-lg font-medium">{c.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
