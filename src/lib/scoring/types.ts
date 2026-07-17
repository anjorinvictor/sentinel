/**
 * Sentinel scoring engine — shared types.
 *
 * The engine is pure TypeScript over the user's real transaction history. It has
 * two halves:
 *   1. computeProfile(history)  -> Fingerprint   (what "normal" looks like for this user)
 *   2. scoreTransaction(tx, fp) -> ScoreResult   (how far this transfer departs from normal)
 *
 * Nothing here hardcodes a naira threshold. Every number is derived from the
 * user's own data, and every score carries the itemized reasons that produced it.
 */

/** A single historical transaction, trimmed to what the engine needs. */
export interface EngineTransaction {
  /** Positive naira amount. */
  amount: number;
  /** Debit (money out) or credit (money in). Only debits shape the fingerprint. */
  direction: "DEBIT" | "CREDIT";
  /** When it happened. */
  occurredAt: Date;
  /** Counterparty identity; used to build the known-recipient set. */
  recipientName?: string | null;
  recipientAccount?: string | null;
}

/** A proposed (not-yet-executed) transfer to be scored. */
export interface ProposedTransaction {
  amount: number;
  occurredAt: Date;
  recipientName?: string | null;
  recipientAccount?: string | null;
}

/** A recipient the user has paid before, with how often and how recently. */
export interface KnownRecipientStat {
  key: string; // normalized identity (account number if present, else lowered name)
  name: string;
  txCount: number;
  totalAmount: number;
  lastPaidAt: Date;
}

/**
 * The Financial Fingerprint: the learned model of one user's normal behaviour.
 * Produced by computeProfile() from real debit history.
 */
export interface Fingerprint {
  /** Amount signal inputs — statistics over past debit amounts. */
  amountMean: number;
  amountStd: number;
  amountMin: number;
  amountMax: number;
  amountMedian: number;

  /** Time signal input — counts of debits per hour-of-day (index 0..23). */
  hourHistogram: number[];

  /** Velocity signal input — baseline transfers per week over the observed span. */
  txPerWeek: number;

  /** The set of recipients the user has paid, keyed for O(1) lookup. */
  knownRecipients: KnownRecipientStat[];

  /** Provenance. */
  sampleSize: number; // number of debit transfers used
  historyDays: number; // span of observed history in days
}

/** Which of the four signals a reason came from. */
export type SignalKind = "amount" | "time" | "recipient" | "velocity";

/**
 * One itemized reason: a single signal's contribution to the score, in plain
 * data form so the UI can render "Amount is 8× your typical transfer" and the
 * audit log can trace every point. `points` is this signal's already-weighted
 * contribution to the composite 0..100 score.
 */
export interface ScoreReason {
  signal: SignalKind;
  /** Normalized severity of this signal, 0..1 (before weighting). */
  severity: number;
  /** Weighted contribution to the composite score, 0..100. */
  points: number;
  /** Short machine-readable code, e.g. "AMOUNT_HIGH", "RECIPIENT_NEW". */
  code: string;
  /** Human-readable, warm explanation for the UI. */
  message: string;
  /** Supporting numbers for the UI / audit (e.g. { zScore, ratio }). */
  detail?: Record<string, number | string | boolean>;
}

/** Risk tiers with escalating friction. */
export type RiskTier = "PASS" | "SOFT_CHALLENGE" | "HOLD";

/** The full result of scoring one proposed transaction. */
export interface ScoreResult {
  /** Composite risk score, 0 (perfectly normal) .. 100 (maximally anomalous). */
  score: number;
  tier: RiskTier;
  reasons: ScoreReason[];
  /** True when there is no usable fingerprint (profile deleted / too little history). */
  unprotected: boolean;
}
