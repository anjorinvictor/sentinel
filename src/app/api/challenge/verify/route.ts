import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAccount, logEvent } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 2; // one initial try + one retry, then hard-block.

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((x) => setB.has(x));
}

/**
 * Verify a behavioural-challenge answer and route the outcome by risk tier.
 *
 * Outcomes:
 *   retry       - first wrong answer; one more try allowed
 *   hard_block  - out of attempts; transfer stays blocked (money kept safe)
 *   released    - correct + medium/high risk; transfer executed
 *   cooloff     - correct + HIGHEST risk; verified but held 24h (not executed)
 *   expired     - challenge missing/expired/already used; blocked
 *
 * Fail closed: any error blocks. Nothing here trusts the client's idea of the
 * risk tier or the correct answer — both come from the stored PendingChallenge.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const challengeId: string = body.challengeId ?? "";
    const selectedIds: string[] = Array.isArray(body.selectedIds)
      ? body.selectedIds
      : [];

    const pc = await prisma.pendingChallenge.findUnique({
      where: { id: challengeId },
    });

    // Missing, already resolved, or expired -> block gracefully.
    if (!pc || pc.status !== "PENDING" || pc.expiresAt < new Date()) {
      return NextResponse.json({ outcome: "expired" });
    }

    const correct = sameSet(selectedIds, pc.correctIds);

    if (!correct) {
      const attempts = pc.attempts + 1;
      const outOfTries = attempts >= MAX_ATTEMPTS;
      await prisma.pendingChallenge.update({
        where: { id: pc.id },
        data: { attempts, status: outOfTries ? "FAILED" : "PENDING" },
      });
      await logEvent({
        type: "FAILED_VERIFICATION",
        summary: outOfTries
          ? `Verification failed for ${
              pc.recipientName ?? "a transfer"
            } — money kept safe.`
          : `A verification attempt for ${
              pc.recipientName ?? "a transfer"
            } didn't match.`,
        score: pc.riskScore,
        tier: pc.riskTier,
        detail: { attempt: attempts },
      });
      return NextResponse.json(
        outOfTries
          ? { outcome: "hard_block" }
          : { outcome: "retry", attemptsLeft: MAX_ATTEMPTS - attempts }
      );
    }

    // Correct answer. Mark passed, then route by risk tier.
    await prisma.pendingChallenge.update({
      where: { id: pc.id },
      data: { status: "PASSED" },
    });

    const amount = Number(pc.amount);

    // HIGHEST risk: verified, but hold for 24h (do NOT release now).
    if (pc.riskTier === "HOLD") {
      const ev = await logEvent({
        type: "COOLING_OFF",
        summary: `Verified, but ${amount.toLocaleString()} to ${
          pc.recipientName ?? "a recipient"
        } is unusual — held for 24 hours. You can cancel anytime.`,
        score: pc.riskScore,
        tier: pc.riskTier,
        detail: {
          status: "active",
          verified: true,
          amount,
          recipientName: pc.recipientName,
        },
      });
      return NextResponse.json({ outcome: "cooloff", eventId: ev.id });
    }

    // Medium/high (SOFT_CHALLENGE): release the transfer now.
    const { account } = await getAccount();
    const tx = await prisma.transaction.create({
      data: {
        accountId: account.id,
        direction: "DEBIT",
        amount,
        recipientName: pc.recipientName,
        recipientBank: pc.recipientBank,
        recipientAccount: pc.recipientAccount,
        category: "TRANSFER",
        channel: "TRANSFER",
        narration:
          pc.narration ?? `Transfer to ${pc.recipientName ?? "recipient"}`,
        occurredAt: pc.occurredAt,
        riskScore: pc.riskScore,
        riskTier: pc.riskTier,
      },
    });
    await prisma.account.update({
      where: { id: account.id },
      data: { balance: { decrement: amount } },
    });
    await logEvent({
      type: "VERIFIED",
      summary: `Identity verified via behavioural challenge — ${amount.toLocaleString()} to ${
        pc.recipientName ?? "a recipient"
      } released.`,
      score: pc.riskScore,
      tier: pc.riskTier,
      detail: { txId: tx.id },
    });
    return NextResponse.json({ outcome: "released", txId: tx.id });
  } catch (err) {
    console.error("Challenge verify failed:", err);
    return NextResponse.json(
      { outcome: "error", failClosed: true },
      { status: 500 }
    );
  }
}
