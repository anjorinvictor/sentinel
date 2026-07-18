"use client";

import { useState } from "react";
import {
  Activity as ActivityIcon,
  ShieldCheck,
  MessageSquare,
  Clock,
  Trash2,
  RotateCcw,
  UserMinus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { RiskBadge } from "@/components/ui/badge";
import { shortDateTime } from "@/lib/format";

export interface ActivityEvent {
  id: string;
  type: string;
  summary: string;
  score: number | null;
  tier: string | null;
  createdAt: string;
}

const TYPE_META: Record<string, { icon: typeof ShieldCheck; group: string }> = {
  SCORED: { icon: ShieldCheck, group: "transfers" },
  CONFIRMED_AFTER_CHALLENGE: { icon: ShieldCheck, group: "transfers" },
  COOLING_OFF: { icon: Clock, group: "transfers" },
  SCAM_CHECK: { icon: MessageSquare, group: "scam" },
  PROFILE_DELETE: { icon: Trash2, group: "profile" },
  PROFILE_RESTORE: { icon: RotateCcw, group: "profile" },
  PROFILE_EDIT: { icon: UserMinus, group: "profile" },
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "transfers", label: "Transfers" },
  { key: "scam", label: "Scam checks" },
  { key: "profile", label: "Profile" },
];

export function ActivityView({ events }: { events: ActivityEvent[] }) {
  const [filter, setFilter] = useState("all");

  const shown =
    filter === "all"
      ? events
      : events.filter((e) => TYPE_META[e.type]?.group === filter);

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every action Sentinel has taken — scored, flagged, checked, or changed —
        with the reason and outcome.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={
              "rounded-lg border px-3 py-1.5 text-sm transition-colors " +
              (filter === f.key
                ? "border-primary/40 bg-secondary text-foreground"
                : "border-border bg-background/40 text-muted-foreground hover:bg-secondary/60")
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card className="mt-4">
        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center text-sm text-muted-foreground">
            <ActivityIcon className="h-8 w-8 opacity-50" />
            No activity yet. Send a transfer or run a Scam Check to see Sentinel
            at work.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((e) => {
              const meta = TYPE_META[e.type] ?? {
                icon: ActivityIcon,
                group: "other",
              };
              const Icon = meta.icon;
              return (
                <li key={e.id} className="flex items-start gap-3 p-4">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">{e.summary}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      {e.tier && e.tier !== "UNPROTECTED" && (
                        <RiskBadge tier={e.tier as never} />
                      )}
                      {e.score != null && <span>score {e.score}</span>}
                      <span>{shortDateTime(e.createdAt)}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
