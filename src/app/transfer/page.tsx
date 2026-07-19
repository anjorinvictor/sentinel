"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Zap,
  AlertTriangle,
  X,
  Clock,
  CheckCircle2,
  Fingerprint,
  ShieldX,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { RiskBadge } from "@/components/ui/badge";
import { ScoreGauge } from "@/components/score-gauge";
import { naira } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ScoreResult, ScoreReason } from "@/lib/scoring";

const BANKS = [
  "Union Bank",
  "GTBank",
  "Access Bank",
  "Zenith Bank",
  "UBA",
  "Providus Bank",
  "First Bank",
  "Kuda",
  "OPay",
];

interface Form {
  recipientName: string;
  recipientAccount: string;
  recipientBank: string;
  amount: string;
  occurredAt?: string;
}

const EMPTY: Form = {
  recipientName: "",
  recipientAccount: "",
  recipientBank: "Union Bank",
  amount: "",
};

export default function TransferPage() {
  const router = useRouter();
  const [form, setForm] = useState<Form>(EMPTY);
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function applyPreset(kind: "safe" | "risky") {
    // Pin timestamps to explicit WAT instants (UTC-anchored) so the demo lands
    // identically regardless of the viewer's timezone. 12:00 UTC = 1 PM WAT
    // (a normal active hour); 00:47 UTC = 1:47 AM WAT (a dead hour).
    if (kind === "safe") {
      const t = new Date();
      t.setUTCHours(12, 0, 0, 0);
      setForm({
        recipientName: "Chicken Republic",
        recipientAccount: "0221145098",
        recipientBank: "GTBank",
        amount: "5000",
        occurredAt: t.toISOString(),
      });
    } else {
      // Fraud scenario: large amount, brand-new payee, 1:47 AM.
      const t = new Date();
      t.setUTCHours(0, 47, 0, 0);
      setForm({
        recipientName: "Unknown Payee",
        recipientAccount: "9099887766",
        recipientBank: "OPay",
        amount: "350000",
        occurredAt: t.toISOString(),
      });
    }
    setResult(null);
    setFlash(null);
  }

  async function handleReview(e: React.FormEvent) {
    e.preventDefault();
    setScoring(true);
    setFlash(null);
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(form.amount),
          recipientName: form.recipientName,
          recipientAccount: form.recipientAccount,
          recipientBank: form.recipientBank,
          occurredAt: form.occurredAt,
        }),
      });
      const data: ScoreResult = await res.json();
      setResult(data);

      if (!data.unprotected && data.tier === "PASS") {
        // Low risk -> execute immediately with a "Sentinel verified" flash.
        await execute("send");
      } else {
        setShowModal(true);
      }
    } finally {
      setScoring(false);
    }
  }

  /** Direct execution / proactive cooling-off (not the behavioural challenge path). */
  async function execute(decision: "send" | "cooloff") {
    await fetch("/api/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(form.amount),
        recipientName: form.recipientName,
        recipientAccount: form.recipientAccount,
        recipientBank: form.recipientBank,
        occurredAt: form.occurredAt,
        decision,
      }),
    });
    finish(
      decision === "cooloff"
        ? `24-hour cooling-off started for ${naira(Number(form.amount))} to ${form.recipientName}. No money has moved.`
        : `${naira(Number(form.amount))} sent to ${form.recipientName}. Sentinel verified.`
    );
  }

  function finish(message: string) {
    setShowModal(false);
    setFlash(message);
    setForm(EMPTY);
    setResult(null);
    router.refresh();
  }

  const canSubmit =
    form.recipientName.trim() && Number(form.amount) > 0 && !scoring;

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Transfer</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every transfer is scored in real time against your own fingerprint.
        Normal activity goes straight through; anomalies are challenged before
        money moves.
      </p>

      {/* Demo presets */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Demo
        </span>
        <Button variant="outline" size="sm" onClick={() => applyPreset("safe")}>
          <Zap className="text-safe" /> Safe transfer
        </Button>
        <Button variant="outline" size="sm" onClick={() => applyPreset("risky")}>
          <AlertTriangle className="text-risk-blocked" /> Risky transfer
        </Button>
      </div>

      {flash && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-safe/30 bg-safe/10 px-4 py-3 text-sm text-safe">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {flash}
        </div>
      )}

      <Card className="mt-4 p-6">
        <form onSubmit={handleReview} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Recipient name</Label>
            <Input
              value={form.recipientName}
              onChange={(e) => set("recipientName", e.target.value)}
              placeholder="e.g. Chicken Republic"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Account number</Label>
              <Input
                value={form.recipientAccount}
                onChange={(e) => set("recipientAccount", e.target.value)}
                placeholder="0123456789"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Bank</Label>
              <select
                value={form.recipientBank}
                onChange={(e) => set("recipientBank", e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background/40 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {BANKS.map((b) => (
                  <option key={b} value={b} className="bg-card">
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Amount (₦)</Label>
            <Input
              value={form.amount}
              onChange={(e) => set("amount", e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="5000"
              inputMode="decimal"
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={!canSubmit}>
            {scoring ? "Sentinel is checking…" : "Review & send"}
          </Button>
        </form>
      </Card>

      {showModal && result && (
        <ChallengeModal
          result={result}
          tx={form}
          onCancel={() => setShowModal(false)}
          onProceed={execute}
          onDone={finish}
        />
      )}
    </div>
  );
}

type Phase = "reasons" | "challenge" | "blocked";
type Option = { id: string; label: string };

function ChallengeModal({
  result,
  tx,
  onCancel,
  onProceed,
  onDone,
}: {
  result: ScoreResult;
  tx: Form;
  onCancel: () => void;
  onProceed: (decision: "send" | "cooloff") => Promise<void>;
  onDone: (message: string) => void;
}) {
  const unprotected = result.unprotected;
  const isHold = result.tier === "HOLD";
  const amount = Number(tx.amount);

  const [phase, setPhase] = useState<Phase>("reasons");
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<{
    challengeId: string;
    options: Option[];
  } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string>("");

  function block(message: string) {
    setBlockedMessage(message);
    setPhase("blocked");
  }

  async function startChallenge() {
    setBusy(true);
    setInlineError(null);
    try {
      const res = await fetch("/api/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          recipientName: tx.recipientName,
          recipientAccount: tx.recipientAccount,
          recipientBank: tx.recipientBank,
          occurredAt: tx.occurredAt,
        }),
      });
      const data = await res.json();
      // Fail closed on any error.
      if (!res.ok) {
        block(
          "We couldn't set up verification, so we've kept your money safe. Please try again."
        );
        return;
      }
      if (data.fallback) {
        block(
          "We can't verify this transfer right now, so we've kept it blocked to keep you safe."
        );
        return;
      }
      setChallenge({ challengeId: data.challengeId, options: data.options });
      setSelected([]);
      setPhase("challenge");
    } catch {
      block("Something went wrong, so we've kept your money safe.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!challenge) return;
    setBusy(true);
    setInlineError(null);
    try {
      const res = await fetch("/api/challenge/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          selectedIds: selected,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        block("Something went wrong, so we've kept your money safe.");
        return;
      }
      switch (data.outcome) {
        case "released":
          onDone(
            `Identity verified — ${naira(amount)} sent to ${tx.recipientName}.`
          );
          break;
        case "cooloff":
          onDone(
            `Verified — but this transfer is unusual, so we're holding it for 24 hours. You can cancel anytime from Activity. Scammers rely on urgency; real transfers can wait a day.`
          );
          break;
        case "retry":
          setSelected([]);
          setInlineError(
            "That's not quite right — one more try. Pick everyone you've actually paid before."
          );
          break;
        case "hard_block":
          block(
            "We couldn't verify this was you, so we've kept your money safe."
          );
          break;
        case "expired":
          block(
            "This verification expired. Please start the transfer again."
          );
          break;
        default:
          block("Something went wrong, so we've kept your money safe.");
      }
    } catch {
      block("Something went wrong, so we've kept your money safe.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto">
        <div className="flex items-start justify-between p-5 pb-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-semibold">Security Challenge</span>
          </div>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* PHASE: blocked ------------------------------------------------ */}
        {phase === "blocked" && (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <ShieldX className="h-12 w-12 text-risk-blocked" />
            <div className="font-medium">Transfer kept safe</div>
            <p className="text-sm text-muted-foreground">{blockedMessage}</p>
            <Button variant="outline" className="mt-2" onClick={onCancel}>
              Close
            </Button>
          </div>
        )}

        {/* PHASE: reasons ------------------------------------------------ */}
        {phase === "reasons" && (
          <>
            <div className="flex flex-col items-center gap-3 p-5">
              {unprotected ? (
                <div className="flex flex-col items-center gap-2 text-center">
                  <AlertTriangle className="h-10 w-10 text-risk-blocked" />
                  <div className="font-medium text-risk-blocked">
                    Protection is off
                  </div>
                </div>
              ) : (
                <>
                  <ScoreGauge score={result.score} tier={result.tier} />
                  <RiskBadge tier={result.tier} />
                </>
              )}
              <p className="text-center text-sm text-muted-foreground">
                {unprotected
                  ? "Your profile is deleted, so Sentinel can't check this transfer. Restore it in the Trust Panel to turn protection back on."
                  : `You're about to send ${naira(amount)} to ${tx.recipientName}. Here's what looked different from your usual behaviour:`}
              </p>
            </div>

            {!unprotected && (
              <div className="space-y-2 px-5">
                {result.reasons
                  .filter((r) => r.points > 0 || r.signal === "recipient")
                  .map((r) => (
                    <ReasonRow key={r.signal} reason={r} />
                  ))}
              </div>
            )}

            <div className="flex flex-col gap-2 p-5 sm:flex-row">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onCancel}
                disabled={busy}
              >
                Cancel
              </Button>
              {isHold && !unprotected && (
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={async () => {
                    setBusy(true);
                    await onProceed("cooloff");
                  }}
                  disabled={busy}
                >
                  <Clock className="h-4 w-4" /> Wait 24h
                </Button>
              )}
              {unprotected ? (
                <Button
                  className="flex-1"
                  onClick={async () => {
                    setBusy(true);
                    await onProceed("send");
                  }}
                  disabled={busy}
                >
                  {busy ? "…" : "Send anyway"}
                </Button>
              ) : (
                <Button
                  className="flex-1"
                  onClick={startChallenge}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Fingerprint className="h-4 w-4" />
                  )}
                  This is really me
                </Button>
              )}
            </div>
          </>
        )}

        {/* PHASE: challenge --------------------------------------------- */}
        {phase === "challenge" && challenge && (
          <>
            <div className="p-5 pb-2">
              <div className="flex items-center gap-2 font-medium">
                <Fingerprint className="h-5 w-5 text-primary" />
                Which of these have you sent money to before?
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Only you know your transaction history — that&apos;s why we ask
                this instead of a password. Select everyone you recognise.
              </p>
              {inlineError && (
                <div className="mt-3 rounded-lg border border-risk-reviewed/30 bg-risk-reviewed/10 px-3 py-2 text-sm text-risk-reviewed">
                  {inlineError}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 px-5 sm:grid-cols-2">
              {challenge.options.map((o) => {
                const on = selected.includes(o.id);
                return (
                  <button
                    key={o.id}
                    onClick={() => toggle(o.id)}
                    className={cn(
                      "rounded-lg border px-3 py-3 text-left text-sm transition-colors",
                      on
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background/30 hover:bg-secondary/60"
                    )}
                  >
                    <span
                      className={cn(
                        "mr-2 inline-flex h-4 w-4 items-center justify-center rounded border align-middle text-[10px]",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40"
                      )}
                    >
                      {on ? "✓" : ""}
                    </span>
                    {o.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 p-5 sm:flex-row">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onCancel}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={verify}
                disabled={busy || selected.length === 0}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Verify
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function ReasonRow({ reason }: { reason: ScoreReason }) {
  const strong = reason.points >= 15;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-background/30 p-3">
      <div
        className={
          "mt-0.5 h-2 w-2 shrink-0 rounded-full " +
          (strong ? "bg-risk-blocked" : reason.points > 0 ? "bg-risk-reviewed" : "bg-safe")
        }
      />
      <div className="flex-1">
        <div className="text-sm">{reason.message}</div>
        <div className="mt-0.5 text-xs capitalize text-muted-foreground">
          {reason.signal} signal · +{Math.round(reason.points)} risk points
        </div>
      </div>
    </div>
  );
}
