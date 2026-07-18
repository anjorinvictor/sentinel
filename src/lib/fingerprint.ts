import type { Fingerprint as PrismaFingerprint, KnownRecipient } from "@prisma/client";
import type { Fingerprint } from "@/lib/scoring";
import { recipientKey } from "@/lib/scoring";

type StoredFingerprint = PrismaFingerprint & {
  knownRecipients: KnownRecipient[];
};

/**
 * Convert a persisted Fingerprint row (Prisma) into the engine's Fingerprint
 * shape used by the scoring functions. The known-recipient `key` is not stored,
 * so we reconstruct it deterministically from name + account with the same
 * recipientKey() the engine uses — keeping storage and scoring in lockstep.
 */
export function storedToEngineFingerprint(
  stored: StoredFingerprint
): Fingerprint {
  return {
    amountMean: stored.amountMean,
    amountStd: stored.amountStd,
    amountMin: stored.amountMin,
    amountMax: stored.amountMax,
    amountMedian: stored.amountMedian,
    hourHistogram: (stored.hourHistogram as number[]) ?? new Array(24).fill(0),
    txPerWeek: stored.txPerWeek,
    sampleSize: stored.sampleSize,
    historyDays: stored.historyDays,
    knownRecipients: stored.knownRecipients.map((r) => ({
      key: recipientKey(r.name, r.accountNumber) ?? `name:${r.name.toLowerCase()}`,
      name: r.name,
      txCount: r.txCount,
      totalAmount: Number(r.totalAmount),
      lastPaidAt: r.lastPaidAt,
    })),
  };
}
