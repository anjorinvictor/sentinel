import { NextResponse } from "next/server";
import { getEngineFingerprint, getRecentDebitTimes } from "@/lib/data";
import { scoreTransaction } from "@/lib/scoring";
import type { ScoreResult } from "@/lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Score a proposed transfer against the user's fingerprint. Read-only: this is
 * the real-time preview the Transfer form calls before money moves. If the
 * profile has been deleted, protection is unavailable and we say so plainly.
 */
export async function POST(req: Request) {
  const body = await req.json();
  const amount = Number(body.amount);
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
  }

  const proposed = {
    amount,
    occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
    recipientName: body.recipientName ?? null,
    recipientAccount: body.recipientAccount ?? null,
  };

  const fp = await getEngineFingerprint();
  if (!fp) {
    const result: ScoreResult = {
      score: 0,
      tier: "PASS",
      unprotected: true,
      reasons: [
        {
          signal: "amount",
          severity: 0,
          points: 0,
          code: "NO_PROFILE",
          message:
            "Your Sentinel profile is deleted, so this transfer can't be checked. Restore your profile in the Trust Panel to turn protection back on.",
          detail: {},
        },
      ],
    };
    return NextResponse.json(result);
  }

  const recent = await getRecentDebitTimes();
  const result = scoreTransaction(proposed, fp, recent);
  return NextResponse.json(result);
}
