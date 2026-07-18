"use client";

import { useState } from "react";
import {
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Flag,
  Lightbulb,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import type { ScamResult } from "@/app/api/scam-check/route";

const EXAMPLES: { label: string; text: string }[] = [
  {
    label: "Fake account suspension",
    text: "URGENT: Your Union Bank account will be suspended in 24 hours due to incomplete BVN verification. Click http://union-verify.ng to reactivate immediately or lose access to your funds.",
  },
  {
    label: "Investment scam (600% in 9 days)",
    text: "Congratulations! Invest ₦50,000 in our CBN-approved forex platform and earn 600% guaranteed returns in just 9 days. Limited slots available. Send now to secure your spot.",
  },
  {
    label: "Fake BVN update link",
    text: "Dear customer, your BVN has been deactivated. Update now via http://bvn-update.com/verify to avoid account closure. Enter your card number, expiry and PIN to confirm your identity.",
  },
];

const VERDICT_UI = {
  SCAM: {
    label: "Scam",
    icon: ShieldAlert,
    cls: "border-risk-blocked/30 bg-risk-blocked/10 text-risk-blocked",
  },
  SUSPICIOUS: {
    label: "Suspicious",
    icon: ShieldQuestion,
    cls: "border-risk-reviewed/30 bg-risk-reviewed/10 text-risk-reviewed",
  },
  LIKELY_SAFE: {
    label: "Likely safe",
    icon: ShieldCheck,
    cls: "border-safe/30 bg-safe/10 text-safe",
  },
} as const;

export default function ScamCheckPage() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScamResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    if (!message.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/scam-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Scam Check</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Paste any suspicious SMS, WhatsApp message, or email. Sentinel reads it
        for scam intent — before you act.
      </p>

      <Card className="mt-6 p-5">
        <div className="mb-3 flex items-center gap-2 font-medium">
          <MessageSquare className="h-4 w-4 text-primary" /> Message
        </div>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Paste the message here…"
          className="min-h-[160px]"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Try
          </span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              onClick={() => {
                setMessage(ex.text);
                setResult(null);
                setError(null);
              }}
              className="rounded-lg border border-border bg-background/40 px-3 py-1.5 text-xs hover:bg-secondary/60"
            >
              {ex.label}
            </button>
          ))}
        </div>
        <Button
          className="mt-4 w-full"
          size="lg"
          onClick={analyze}
          disabled={loading || !message.trim()}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
            </>
          ) : (
            "Analyze message"
          )}
        </Button>
      </Card>

      {error && (
        <Card className="mt-4 border-risk-reviewed/30 p-5">
          <div className="text-sm text-risk-reviewed">{error}</div>
        </Card>
      )}

      {result && <ResultCard result={result} />}
    </div>
  );
}

function ResultCard({ result }: { result: ScamResult }) {
  const ui = VERDICT_UI[result.verdict] ?? VERDICT_UI.SUSPICIOUS;
  const Icon = ui.icon;
  return (
    <Card className="mt-4 p-5">
      <div className="flex items-center gap-3">
        <span
          className={
            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold " +
            ui.cls
          }
        >
          <Icon className="h-4 w-4" />
          {ui.label}
        </span>
        <span className="text-sm text-muted-foreground">
          {result.confidence}% confidence
        </span>
      </div>

      <p className="mt-3 text-sm">{result.summary}</p>

      {result.redFlags?.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Flag className="h-4 w-4 text-risk-blocked" /> Red flags
          </div>
          <ul className="space-y-2">
            {result.redFlags.map((f, i) => (
              <li
                key={i}
                className="rounded-lg border border-border bg-background/30 p-3 text-sm"
              >
                <span className="font-medium">{f.tactic}.</span>{" "}
                <span className="text-muted-foreground">{f.explanation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.advice?.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="h-4 w-4 text-primary" /> What you should do
          </div>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {result.advice.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
