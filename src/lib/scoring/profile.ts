import type {
  EngineTransaction,
  Fingerprint,
  KnownRecipientStat,
} from "./types";
import { hourInZone } from "./time";

/** Milliseconds in one day. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Normalize a recipient into a stable identity key. Account number is the
 * strongest signal (a name can be typed many ways); fall back to a lowercased,
 * whitespace-collapsed name. Returns null when there is nothing to key on.
 */
export function recipientKey(
  recipientName?: string | null,
  recipientAccount?: string | null
): string | null {
  const acct = (recipientAccount ?? "").replace(/\s+/g, "");
  if (acct) return `acct:${acct}`;
  const name = (recipientName ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (name) return `name:${name}`;
  return null;
}

/** Population/sample helpers kept explicit so the math is easy to defend. */
function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Sample standard deviation (divides by n-1, Bessel's correction) — we are
 * estimating the spread of the user's true behaviour from a sample of it.
 * Returns 0 for fewer than 2 points (no spread is estimable).
 */
function sampleStd(xs: number[], mu: number): number {
  if (xs.length < 2) return 0;
  const variance =
    xs.reduce((acc, x) => acc + (x - mu) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Compute the Financial Fingerprint from a user's transaction history.
 *
 * Only DEBIT transactions (money the user *sends*) shape the profile — incoming
 * salary credits are not behaviour we score transfers against. Every field is
 * derived arithmetic over the real rows; nothing is hardcoded.
 */
export function computeProfile(history: EngineTransaction[]): Fingerprint {
  const debits = history.filter(
    (t) => t.direction === "DEBIT" && t.amount > 0
  );

  const amounts = debits.map((t) => t.amount);
  const amountMean = mean(amounts);
  const amountStd = sampleStd(amounts, amountMean);

  // Hour-of-day histogram (0..23) of when the user sends money.
  const hourHistogram = new Array(24).fill(0);
  for (const t of debits) {
    hourHistogram[hourInZone(t.occurredAt)] += 1;
  }

  // Observed span of history, in days (at least 1 to avoid divide-by-zero).
  let historyDays = 1;
  if (debits.length >= 2) {
    const times = debits.map((t) => t.occurredAt.getTime());
    const span = Math.max(...times) - Math.min(...times);
    historyDays = Math.max(1, span / DAY_MS);
  }
  const txPerWeek = (debits.length / historyDays) * 7;

  // Known recipients: group debits by normalized identity.
  const byKey = new Map<string, KnownRecipientStat>();
  for (const t of debits) {
    const key = recipientKey(t.recipientName, t.recipientAccount);
    if (!key) continue;
    const existing = byKey.get(key);
    if (existing) {
      existing.txCount += 1;
      existing.totalAmount += t.amount;
      if (t.occurredAt > existing.lastPaidAt) existing.lastPaidAt = t.occurredAt;
    } else {
      byKey.set(key, {
        key,
        name: t.recipientName?.trim() || key,
        txCount: 1,
        totalAmount: t.amount,
        lastPaidAt: t.occurredAt,
      });
    }
  }

  return {
    amountMean,
    amountStd,
    amountMin: amounts.length ? Math.min(...amounts) : 0,
    amountMax: amounts.length ? Math.max(...amounts) : 0,
    amountMedian: median(amounts),
    hourHistogram,
    txPerWeek,
    knownRecipients: [...byKey.values()].sort((a, b) => b.txCount - a.txCount),
    sampleSize: debits.length,
    historyDays,
  };
}
