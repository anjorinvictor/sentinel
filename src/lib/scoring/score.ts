import type {
  EngineTransaction,
  Fingerprint,
  ProposedTransaction,
  RiskTier,
  ScoreReason,
  ScoreResult,
  SignalKind,
} from "./types";
import { computeProfile } from "./profile";
import {
  amountSignal,
  timeSignal,
  recipientSignal,
  velocitySignal,
  type SignalOutput,
} from "./signals";

/**
 * Signal weights for the composite score. They sum to 1.0, so the composite is a
 * weighted average of the four severities, scaled to 0..100.
 *
 * Rationale:
 * - amount (0.35): sending far more than normal is the clearest fraud marker.
 * - recipient (0.25): a brand-new payee is central to account-takeover transfers.
 * - time (0.20) and velocity (0.20): strong corroborating context, but on their
 *   own (e.g. a normal-sized payment to a known payee at an odd hour) should not
 *   block a user — so they carry less weight than amount + recipient.
 *
 * Calibration check (the demo cases):
 *   ₦5,000 to a known vendor at 2 PM        -> ~2/100  -> PASS
 *   ₦350,000 to a new payee at 1:47 AM      -> ~80/100 -> HOLD
 */
export const SIGNAL_WEIGHTS: Record<SignalKind, number> = {
  amount: 0.35,
  recipient: 0.25,
  time: 0.2,
  velocity: 0.2,
};

/** Tier thresholds on the 0..100 composite. */
export const TIER_THRESHOLDS = {
  softChallenge: 35,
  hold: 65,
} as const;

/**
 * Minimum debit history needed before Sentinel will score at all. Below this we
 * cannot describe "normal", so we return `unprotected` rather than guess. This
 * is what makes the "delete my profile" demo real: with no history there is no
 * protection.
 */
export const MIN_HISTORY = 5;

function tierFor(score: number): RiskTier {
  if (score >= TIER_THRESHOLDS.hold) return "HOLD";
  if (score >= TIER_THRESHOLDS.softChallenge) return "SOFT_CHALLENGE";
  return "PASS";
}

function toReason(out: SignalOutput, weight: number): ScoreReason {
  return {
    signal: out.signal,
    severity: out.severity,
    points: Math.round(out.severity * weight * 100 * 100) / 100,
    code: out.code,
    message: out.message,
    detail: out.detail,
  };
}

/**
 * Score a proposed transaction against a fingerprint plus the recent debit
 * timestamps needed for the velocity signal. Pure and deterministic: same
 * inputs always produce the same score and reasons.
 */
export function scoreTransaction(
  tx: ProposedTransaction,
  fp: Fingerprint,
  recentDebitTimes: Date[]
): ScoreResult {
  if (fp.sampleSize < MIN_HISTORY) {
    return {
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
            "Sentinel doesn't have enough of your history yet to protect this transfer.",
          detail: { sampleSize: fp.sampleSize, required: MIN_HISTORY },
        },
      ],
    };
  }

  const outputs: SignalOutput[] = [
    amountSignal(tx, fp),
    recipientSignal(tx, fp),
    timeSignal(tx, fp),
    velocitySignal(tx, fp, recentDebitTimes),
  ];

  const reasons = outputs.map((o) => toReason(o, SIGNAL_WEIGHTS[o.signal]));
  const score =
    Math.round(reasons.reduce((acc, r) => acc + r.points, 0) * 100) / 100;

  // Order reasons by contribution so the UI leads with what mattered most.
  reasons.sort((a, b) => b.points - a.points);

  return {
    score: clampScore(score),
    tier: tierFor(score),
    reasons,
    unprotected: false,
  };
}

function clampScore(s: number): number {
  return Math.max(0, Math.min(100, s));
}

/**
 * Convenience wrapper matching the CLAUDE.md API: score a proposed transaction
 * directly against the user's transaction history. Builds the fingerprint and
 * derives the recent debit timestamps, then delegates to scoreTransaction.
 */
export function scoreFromHistory(
  tx: ProposedTransaction,
  history: EngineTransaction[]
): ScoreResult {
  const fp = computeProfile(history);
  const recentDebitTimes = history
    .filter((t) => t.direction === "DEBIT" && t.amount > 0)
    .map((t) => t.occurredAt);
  return scoreTransaction(tx, fp, recentDebitTimes);
}
