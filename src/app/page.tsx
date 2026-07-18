import {
  ShieldCheck,
  ShieldAlert,
  TrendingUp,
  PiggyBank,
  Utensils,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { RiskBadge } from "@/components/ui/badge";
import { SpendingDonut } from "@/components/spending-donut";
import {
  getAccount,
  getStoredFingerprint,
  getInsights,
  getSpendingByCategory,
  getTransactions,
} from "@/lib/data";
import { naira, shortDateTime, greeting } from "@/lib/format";
import type { RiskTier } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const INSIGHT_ICON = {
  trending: TrendingUp,
  piggy: PiggyBank,
  food: Utensils,
} as const;

export default async function DashboardPage() {
  const [{ user, account }, fingerprint, insights, spending, recent] =
    await Promise.all([
      getAccount(),
      getStoredFingerprint(),
      getInsights(),
      getSpendingByCategory(),
      getTransactions(8),
    ]);

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      {/* Header + balance */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-sm text-muted-foreground">{greeting()},</p>
          <h1 className="text-3xl font-semibold tracking-tight">{user.name}</h1>
        </div>
        <Card className="min-w-[260px] bg-gradient-to-br from-card to-secondary/40">
          <div className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Available balance
            </div>
            <div className="mt-1 text-3xl font-semibold">
              {naira(Number(account.balance), { decimals: true })}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {account.bankName} · {account.accountNumber}
            </div>
          </div>
        </Card>
      </div>

      {/* Sentinel status */}
      <Card className="mt-6 border-safe/20">
        <div className="flex items-center gap-4 p-5">
          <div
            className={
              "flex h-11 w-11 items-center justify-center rounded-lg " +
              (fingerprint
                ? "bg-safe/10 text-safe"
                : "bg-risk-blocked/10 text-risk-blocked")
            }
          >
            {fingerprint ? (
              <ShieldCheck className="h-6 w-6" />
            ) : (
              <ShieldAlert className="h-6 w-6" />
            )}
          </div>
          <div className="flex-1">
            {fingerprint ? (
              <>
                <div className="font-medium">Sentinel is active and learning</div>
                <div className="text-sm text-muted-foreground">
                  Learned {fingerprint.historyDays} days of your patterns.{" "}
                  {fingerprint.sampleSize} transactions protected.
                </div>
              </>
            ) : (
              <>
                <div className="font-medium text-risk-blocked">
                  No profile — protection is off
                </div>
                <div className="text-sm text-muted-foreground">
                  You deleted your Sentinel profile. Restore it in the Trust
                  Panel to turn protection back on.
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Insight cards */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {insights.map((ins) => {
          const Icon = INSIGHT_ICON[ins.icon as keyof typeof INSIGHT_ICON];
          return (
            <Card key={ins.title} className="p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Icon className="h-4 w-4 text-primary" />
                {ins.title}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{ins.body}</p>
            </Card>
          );
        })}
      </div>

      {/* Spending + recent */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 font-medium">Spending by category</div>
          <SpendingDonut data={spending.slice(0, 8)} />
        </Card>

        <Card className="p-5">
          <div className="mb-4 font-medium">Recent transactions</div>
          <ul className="divide-y divide-border">
            {recent.map((t) => {
              const isDebit = t.direction === "DEBIT";
              const tier = (t.riskTier as RiskTier | null) ?? "PASS";
              return (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <div
                    className={
                      "flex h-9 w-9 items-center justify-center rounded-full " +
                      (isDebit
                        ? "bg-secondary text-muted-foreground"
                        : "bg-safe/10 text-safe")
                    }
                  >
                    {isDebit ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownLeft className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {t.recipientName ?? t.narration}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {shortDateTime(t.occurredAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={
                        "text-sm font-medium " +
                        (isDebit ? "" : "text-safe")
                      }
                    >
                      {isDebit ? "−" : "+"}
                      {naira(t.amount)}
                    </div>
                    {isDebit && (
                      <div className="mt-0.5">
                        <RiskBadge tier={tier} />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
