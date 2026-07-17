import type { Fingerprint, ProposedTransaction, SignalKind } from "./types";
import { recipientKey } from "./profile";

/** The raw output of one signal, before weighting into the composite score. */
export interface SignalOutput {
  signal: SignalKind;
  /** Normalized severity 0..1 (0 = perfectly normal, 1 = maximally anomalous). */
  severity: number;
  code: string;
  message: string;
  detail: Record<string, number | string | boolean>;
}

export function clamp(x: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, x));
}

const EPSILON = 1e-9;

/**
 * AMOUNT SIGNAL — how far above the user's normal transfer size this is.
 *
 * Primary measure is the z-score against the user's real mean & standard
 * deviation: z = (amount - mean) / std. Only the *high* tail is risky (sending
 * far more than usual); sending less than normal is never penalized. We map the
 * z-score to severity on [2σ, 5σ]: at/below 2σ it's within normal spread (0);
 * by 5σ it's a clear outlier (1).
 *
 * When std is ~0 (history is all one amount) the z-score is undefined, so we
 * fall back to a ratio against the mean.
 */
export function amountSignal(
  tx: ProposedTransaction,
  fp: Fingerprint
): SignalOutput {
  const typical = fp.amountMedian || fp.amountMean || 1;
  const ratio = tx.amount / (typical || 1);

  let severity: number;
  let zScore: number | null = null;

  if (fp.amountStd > EPSILON) {
    zScore = (tx.amount - fp.amountMean) / fp.amountStd;
    // Below 2σ -> 0; at/above 5σ -> 1. Linear in between.
    severity = clamp((zScore - 2) / (5 - 2));
  } else {
    // Degenerate spread: judge purely by ratio to the mean.
    severity = clamp((tx.amount / (fp.amountMean || 1) - 1.5) / (5 - 1.5));
  }

  const roundedRatio = Math.round(ratio * 10) / 10;
  const code =
    severity >= 0.66
      ? "AMOUNT_VERY_HIGH"
      : severity >= 0.33
        ? "AMOUNT_HIGH"
        : "AMOUNT_NORMAL";

  const message =
    severity < 0.15
      ? `Amount is in your normal range (about ${roundedRatio}× your typical transfer).`
      : `Amount is ${roundedRatio}× your typical transfer of ₦${Math.round(
          typical
        ).toLocaleString()}.`;

  return {
    signal: "amount",
    severity,
    code,
    message,
    detail: {
      amount: tx.amount,
      typical: Math.round(typical),
      mean: Math.round(fp.amountMean),
      std: Math.round(fp.amountStd),
      ratio: roundedRatio,
      ...(zScore !== null ? { zScore: Math.round(zScore * 100) / 100 } : {}),
    },
  };
}

/**
 * TIME SIGNAL — how unusual this hour-of-day is for the user.
 *
 * We compare the transaction's hour against the user's real hour-of-day
 * histogram, measured relative to their busiest hour:
 *   activity = count[hour] / max(count)
 *   severity = 1 - activity
 * So the peak banking hour scores 0, an hour with no prior activity scores 1,
 * and half-as-active hours score 0.5. This is fully learned — a night-shift
 * user who always banks at 3 a.m. would have that hour as normal.
 */
export function timeSignal(
  tx: ProposedTransaction,
  fp: Fingerprint
): SignalOutput {
  const hour = tx.occurredAt.getHours();
  const hist = fp.hourHistogram;
  const total = hist.reduce((a, b) => a + b, 0);
  const maxCount = Math.max(...hist, 0);

  const countThisHour = hist[hour] ?? 0;
  const activity = maxCount > 0 ? countThisHour / maxCount : 1;
  const severity = clamp(1 - activity);

  // Describe the user's usual active window (hours with any activity).
  const activeHours = hist
    .map((c, h) => (c > 0 ? h : -1))
    .filter((h) => h >= 0);
  const lo = activeHours.length ? Math.min(...activeHours) : 0;
  const hi = activeHours.length ? Math.max(...activeHours) : 23;

  const fmt = (h: number) => {
    const period = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12} ${period}`;
  };

  const freqPct = total > 0 ? Math.round((countThisHour / total) * 100) : 0;
  const code =
    severity >= 0.66
      ? "TIME_UNUSUAL"
      : severity >= 0.33
        ? "TIME_ATYPICAL"
        : "TIME_NORMAL";

  const message =
    countThisHour === 0
      ? `${fmt(hour)} is outside your active hours — you usually bank between ${fmt(
          lo
        )} and ${fmt(hi)}.`
      : `You occasionally bank around ${fmt(hour)} (${freqPct}% of your activity).`;

  return {
    signal: "time",
    severity,
    code,
    message,
    detail: {
      hour,
      countThisHour,
      peakCount: maxCount,
      freqPct,
      activeFrom: lo,
      activeTo: hi,
    },
  };
}

/**
 * RECIPIENT SIGNAL — is this someone the user has paid before?
 *
 * Novelty is categorical: the recipient is either in the learned known-set or
 * not. A brand-new recipient is the single strongest structural marker of an
 * account-takeover transfer, so it scores 1; a previously-paid recipient scores
 * 0 (and we surface how many times they've been paid for the explanation).
 */
export function recipientSignal(
  tx: ProposedTransaction,
  fp: Fingerprint
): SignalOutput {
  const key = recipientKey(tx.recipientName, tx.recipientAccount);
  const match = key
    ? fp.knownRecipients.find((r) => r.key === key)
    : undefined;

  if (match) {
    return {
      signal: "recipient",
      severity: 0,
      code: "RECIPIENT_KNOWN",
      message: `You've paid ${match.name} ${match.txCount} time${
        match.txCount === 1 ? "" : "s"
      } before — a trusted recipient.`,
      detail: { known: true, txCount: match.txCount },
    };
  }

  return {
    signal: "recipient",
    severity: 1,
    code: "RECIPIENT_NEW",
    message: `${
      tx.recipientName?.trim() || "This recipient"
    } is new — you've never sent money here before.`,
    detail: { known: false, txCount: 0 },
  };
}

/**
 * VELOCITY SIGNAL — is this transfer part of a rapid burst?
 *
 * We count how many debits fall in the hour immediately before this one, add
 * this transfer, and compare to what's normal for the user. The allowed pace is
 * 1 (this transfer) plus the user's own baseline hourly rate (txPerWeek / 168).
 * Each transfer beyond that adds severity; ~4 excess transfers in an hour = 1.
 * A heavy transactor's baseline is higher, so this adapts per user.
 */
export function velocitySignal(
  tx: ProposedTransaction,
  fp: Fingerprint,
  recentDebitTimes: Date[]
): SignalOutput {
  const WINDOW_MS = 60 * 60 * 1000; // 1 hour
  const start = tx.occurredAt.getTime() - WINDOW_MS;
  const priorInWindow = recentDebitTimes.filter(
    (d) => d.getTime() >= start && d.getTime() <= tx.occurredAt.getTime()
  ).length;
  const countInWindow = priorInWindow + 1; // include the proposed transfer

  const baselinePerHour = fp.txPerWeek / (7 * 24);
  const allowed = 1 + baselinePerHour;
  const severity = clamp((countInWindow - allowed) / 4);

  const code =
    severity >= 0.66
      ? "VELOCITY_SPIKE"
      : severity >= 0.33
        ? "VELOCITY_ELEVATED"
        : "VELOCITY_NORMAL";

  const message =
    countInWindow <= 1
      ? `Normal pace — no other transfers in the last hour.`
      : `${countInWindow} transfers in the last hour — faster than your usual pace.`;

  return {
    signal: "velocity",
    severity,
    code,
    message,
    detail: {
      countInWindow,
      baselinePerHour: Math.round(baselinePerHour * 100) / 100,
    },
  };
}
