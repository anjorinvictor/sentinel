import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getDemoUser,
  getEngineFingerprint,
  getRecentDebitTimes,
} from "@/lib/data";
import { scoreTransaction } from "@/lib/scoring";
import {
  generateRecipientChallenge,
  MIN_RECIPIENTS_FOR_CHALLENGE,
} from "@/lib/challenge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generate a behavioural challenge for a challenged transfer. Re-scores the
 * transfer server-side (never trusts the client), then builds a question from
 * the user's real history. The correct answer is stored server-side only.
 *
 * Fail-safe: if there's no profile, the tier is PASS, or there are too few known
 * recipients, we return { fallback: true } and the client keeps the transfer
 * blocked. Any error also results in a block (fail closed).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const amount = Number(body.amount);
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
    }

    const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
    const proposed = {
      amount,
      occurredAt,
      recipientName: body.recipientName ?? null,
      recipientAccount: body.recipientAccount ?? null,
    };

    const fp = await getEngineFingerprint();
    // No profile -> can't challenge from history. Fall back to block.
    if (!fp) {
      return NextResponse.json({ fallback: true, reason: "no_profile" });
    }

    const recent = await getRecentDebitTimes();
    const scored = scoreTransaction(proposed, fp, recent);

    // Only challenge genuinely risky transfers; a PASS shouldn't be here.
    if (scored.tier === "PASS") {
      return NextResponse.json({ fallback: true, reason: "not_risky" });
    }

    // Too little history to build a fair challenge -> fall back to block.
    if (fp.knownRecipients.length < MIN_RECIPIENTS_FOR_CHALLENGE) {
      return NextResponse.json({
        fallback: true,
        reason: "insufficient_history",
      });
    }

    const options = generateRecipientChallenge(
      fp.knownRecipients.map((r) => ({ name: r.name }))
    );
    if (!options) {
      return NextResponse.json({ fallback: true, reason: "cannot_build" });
    }

    const user = await getDemoUser();
    const correctIds = options.filter((o) => o.isCorrect).map((o) => o.id);

    const pending = await prisma.pendingChallenge.create({
      data: {
        userId: user.id,
        correctIds,
        options: options.map((o) => ({ id: o.id, label: o.label })),
        riskScore: Math.round(scored.score),
        riskTier: scored.tier,
        amount,
        recipientName: proposed.recipientName,
        recipientBank: body.recipientBank ?? null,
        recipientAccount: proposed.recipientAccount,
        narration: body.narration ?? null,
        occurredAt,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });

    // Return options WITHOUT the correctness flag.
    return NextResponse.json({
      challengeId: pending.id,
      tier: scored.tier,
      options: options.map((o) => ({ id: o.id, label: o.label })),
    });
  } catch (err) {
    // Fail closed: an error must never let a risky transfer through.
    console.error("Challenge generation failed:", err);
    return NextResponse.json(
      { error: "Could not create a verification challenge.", failClosed: true },
      { status: 500 }
    );
  }
}
