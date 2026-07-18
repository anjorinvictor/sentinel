import { prisma } from "@/lib/db";
import { computeProfile, recipientKey } from "@/lib/scoring";
import type { EngineTransaction } from "@/lib/scoring";

/**
 * Recompute the fingerprint for a user from their real transaction history and
 * persist it (replacing any existing one). This is exactly what the Trust
 * Panel's "restore profile" does — it rebuilds protection from the same data it
 * was learned from, proving the personalization data *is* the protection.
 */
export async function rebuildFingerprintForUser(userId: string) {
  const account = await prisma.account.findFirst({ where: { userId } });
  if (!account) throw new Error("No account for user.");

  const txs = await prisma.transaction.findMany({
    where: { accountId: account.id },
  });

  const engineTxs: EngineTransaction[] = txs.map((t) => ({
    amount: Number(t.amount),
    direction: t.direction,
    occurredAt: t.occurredAt,
    recipientName: t.recipientName,
    recipientAccount: t.recipientAccount,
  }));

  const fp = computeProfile(engineTxs);

  // Map recipient identity -> bank/account from the real transactions.
  const meta = new Map<string, { bank: string | null; account: string | null }>();
  for (const t of txs) {
    if (t.direction !== "DEBIT") continue;
    const key = recipientKey(t.recipientName, t.recipientAccount);
    if (key && !meta.has(key)) {
      meta.set(key, { bank: t.recipientBank, account: t.recipientAccount });
    }
  }

  // Replace any existing fingerprint (cascade removes old recipients).
  await prisma.fingerprint.deleteMany({ where: { userId } });

  return prisma.fingerprint.create({
    data: {
      userId,
      amountMean: fp.amountMean,
      amountStd: fp.amountStd,
      amountMin: fp.amountMin,
      amountMax: fp.amountMax,
      amountMedian: fp.amountMedian,
      hourHistogram: fp.hourHistogram,
      txPerWeek: fp.txPerWeek,
      sampleSize: fp.sampleSize,
      historyDays: Math.round(fp.historyDays),
      knownRecipients: {
        create: fp.knownRecipients.map((r) => {
          const m = meta.get(r.key);
          return {
            name: r.name,
            bank: m?.bank ?? null,
            accountNumber: m?.account ?? null,
            txCount: r.txCount,
            totalAmount: r.totalAmount,
            lastPaidAt: r.lastPaidAt,
          };
        }),
      },
    },
    include: { knownRecipients: true },
  });
}
