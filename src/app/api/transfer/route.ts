import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getAccount,
  getEngineFingerprint,
  getRecentDebitTimes,
  logEvent,
} from "@/lib/data";
import { scoreTransaction } from "@/lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Execute (or cool off) a transfer the user has decided to proceed with. The
 * server ALWAYS re-scores — it never trusts a score computed on the client.
 *
 * decision:
 *   "send"    - low-risk, executed with no friction
 *   "confirm" - user confirmed a challenged transfer ("This is me")
 *   "cooloff" - user chose the 24h cooling-off; money does NOT move now
 */
export async function POST(req: Request) {
  const body = await req.json();
  const amount = Number(body.amount);
  const decision: string = body.decision ?? "send";
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
  }

  const { account } = await getAccount();
  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
  const proposed = {
    amount,
    occurredAt,
    recipientName: body.recipientName ?? null,
    recipientAccount: body.recipientAccount ?? null,
  };

  const fp = await getEngineFingerprint();
  const recent = await getRecentDebitTimes();
  const scored = fp ? scoreTransaction(proposed, fp, recent) : null;
  const score = scored?.score ?? null;
  const tier = scored?.unprotected ? "UNPROTECTED" : scored?.tier ?? null;

  // Cooling-off: do not move money; just log the decision.
  if (decision === "cooloff") {
    await logEvent({
      type: "COOLING_OFF",
      summary: `24h cooling-off started on ${amount.toLocaleString()} to ${
        proposed.recipientName ?? "a recipient"
      }.`,
      score: score ?? undefined,
      tier: tier ?? undefined,
      detail: { amount, recipientName: proposed.recipientName },
    });
    return NextResponse.json({ ok: true, decision, cooled: true });
  }

  // Execute: record the transaction, decrement balance, log the outcome.
  const tx = await prisma.transaction.create({
    data: {
      accountId: account.id,
      direction: "DEBIT",
      amount,
      recipientName: proposed.recipientName,
      recipientBank: body.recipientBank ?? null,
      recipientAccount: proposed.recipientAccount,
      category: "TRANSFER",
      channel: "TRANSFER",
      narration: body.narration ?? `Transfer to ${proposed.recipientName ?? "recipient"}`,
      occurredAt,
      riskScore: score ? Math.round(score) : null,
      riskTier: tier ?? null,
    },
  });

  await prisma.account.update({
    where: { id: account.id },
    data: { balance: { decrement: amount } },
  });

  await logEvent({
    type: decision === "confirm" ? "CONFIRMED_AFTER_CHALLENGE" : "SCORED",
    summary:
      decision === "confirm"
        ? `You confirmed a ${tier ?? ""} transfer of ${amount.toLocaleString()} to ${proposed.recipientName ?? "a recipient"}.`
        : `Transfer of ${amount.toLocaleString()} to ${proposed.recipientName ?? "a recipient"} passed with no friction.`,
    score: score ?? undefined,
    tier: tier ?? undefined,
    detail: { amount, recipientName: proposed.recipientName, txId: tx.id },
  });

  return NextResponse.json({ ok: true, decision, txId: tx.id, score, tier });
}
