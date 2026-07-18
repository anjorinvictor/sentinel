"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from "recharts";
import {
  Tag,
  Clock,
  Users,
  Repeat,
  Trash2,
  ShieldAlert,
  RotateCcw,
  ScrollText,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/ui/badge";
import { naira, shortDateTime } from "@/lib/format";

export interface TrustData {
  hasProfile: boolean;
  amountMean: number;
  amountMedian: number;
  amountMin: number;
  amountMax: number;
  txPerWeek: number;
  sampleSize: number;
  historyDays: number;
  hourHistogram: number[];
  recipients: {
    id: string;
    name: string;
    bank: string | null;
    accountNumber: string | null;
    txCount: number;
    totalAmount: number;
  }[];
  categories: { category: string; total: number }[];
  auditLog: {
    id: string;
    type: string;
    summary: string;
    tier: string | null;
    createdAt: string;
  }[];
}

export function TrustPanelView({ data }: { data: TrustData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function call(url: string, method: string) {
    setBusy(true);
    try {
      await fetch(url, { method });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!data.hasProfile) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-10">
        <Header />
        <Card className="mt-6 border-risk-blocked/30 bg-risk-blocked/5 p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-risk-blocked" />
          <h2 className="mt-3 text-lg font-semibold">
            Your profile is deleted
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Sentinel currently knows nothing about you. Transfers can&apos;t be
            scored and protection is off. Everything can be rebuilt from your
            transaction history — the same data it was learned from.
          </p>
          <Button
            className="mt-5"
            onClick={() => call("/api/profile/restore", "POST")}
            disabled={busy}
          >
            <RotateCcw className="h-4 w-4" /> Restore my profile
          </Button>
        </Card>
      </div>
    );
  }

  const hourData = data.hourHistogram.map((count, hour) => ({ hour, count }));

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <Header />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Tag className="h-4 w-4 text-primary" /> Typical transfer amount
          </div>
          <div className="mt-2 text-3xl font-semibold">
            {naira(data.amountMedian)}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Range {naira(data.amountMin)} – {naira(data.amountMax)} · mean{" "}
            {naira(data.amountMean)}
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Repeat className="h-4 w-4 text-primary" /> Transaction rhythm
          </div>
          <div className="mt-2 text-3xl font-semibold">
            ~{data.txPerWeek.toFixed(1)} / week
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Based on {data.sampleSize} transactions over {data.historyDays} days
          </div>
        </Card>
      </div>

      {/* Active hours */}
      <Card className="mt-4 p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Clock className="h-4 w-4 text-primary" /> Active hours
        </div>
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourData}>
              <XAxis
                dataKey="hour"
                tickFormatter={(h) => (h % 6 === 0 ? `${h}:00` : "")}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <Tooltip
                cursor={{ fill: "var(--secondary)" }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v) => [`${v} transfers`, "Activity"]}
                labelFormatter={(h) => `${h}:00`}
              />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {hourData.map((d) => (
                  <Cell
                    key={d.hour}
                    fill={d.count > 0 ? "var(--chart-1)" : "var(--border)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Gold bars are hours you actually bank. A transfer at a dead hour scores
          higher risk.
        </p>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Known recipients */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-primary" /> Known recipients
            </div>
            <span className="text-xs text-muted-foreground">
              {data.recipients.length} saved
            </span>
          </div>
          <ul className="space-y-2">
            {data.recipients.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-background/30 p-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                  {r.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.bank ?? "—"} · paid {r.txCount}×
                  </div>
                </div>
                <button
                  onClick={() => call(`/api/recipient/${r.id}`, "DELETE")}
                  disabled={busy}
                  className="text-muted-foreground hover:text-risk-blocked disabled:opacity-50"
                  title="Forget this recipient"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {/* Categories */}
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Tag className="h-4 w-4 text-primary" /> Spending categories learned
          </div>
          <ul className="space-y-2">
            {data.categories.slice(0, 6).map((c) => (
              <li key={c.category} className="flex items-center justify-between text-sm">
                <span className="capitalize text-muted-foreground">
                  {c.category.toLowerCase().replace("_", " ")}
                </span>
                <span className="font-medium">{naira(c.total)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Audit log */}
      {data.auditLog.length > 0 && (
        <Card className="mt-4 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <ScrollText className="h-4 w-4 text-primary" /> Why was this flagged —
            audit log
          </div>
          <ul className="space-y-2">
            {data.auditLog.map((e) => (
              <li key={e.id} className="flex items-center gap-3 text-sm">
                {e.tier && <RiskBadge tier={e.tier as never} />}
                <span className="flex-1 text-muted-foreground">{e.summary}</span>
                <span className="text-xs text-muted-foreground">
                  {shortDateTime(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Danger zone */}
      <Card className="mt-4 border-risk-blocked/30 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-risk-blocked">
              Delete my entire profile
            </div>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              Removes everything Sentinel has learned. Protection turns off and
              transfers can no longer be scored — until you restore it.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => call("/api/profile", "DELETE")}
            disabled={busy}
          >
            <Trash2 className="h-4 w-4" /> Delete profile
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Trust Panel</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Here&apos;s everything Sentinel knows about you. You can edit or delete
        any of it.
      </p>
    </div>
  );
}
