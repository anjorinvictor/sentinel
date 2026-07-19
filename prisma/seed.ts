/**
 * Sentinel seed — a coherent 90-day transaction history for Amina Okafor.
 *
 * Design principle: the fingerprint is COMPUTED from this data, not asserted
 * alongside it. After inserting the transactions we run the real engine
 * (computeProfile) on those exact rows and store the result. So the "typical
 * amount", "active hours" and "known recipients" the app later shows are
 * literally the engine's output on the seeded rows — coherent by construction.
 *
 * Run with: npm run db:seed   (tsx prisma/seed.ts)
 */
import { PrismaClient } from "@prisma/client";
import { computeProfile, recipientKey } from "../src/lib/scoring";
import type { EngineTransaction } from "../src/lib/scoring";
import { VENDORS, generateTransactions } from "./history";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  console.log("Seeding Sentinel demo data for Amina Okafor…");

  // Clean slate (FK-safe order).
  await prisma.pendingChallenge.deleteMany();
  await prisma.protectionEvent.deleteMany();
  await prisma.knownRecipient.deleteMany();
  await prisma.fingerprint.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  // Persona + account.
  const user = await prisma.user.create({
    data: {
      name: "Amina Okafor",
      email: "amina.okafor@example.com",
      accounts: {
        create: {
          bankName: "Union Bank",
          accountNumber: "0123456789",
          balance: 847320.5,
        },
      },
    },
    include: { accounts: true },
  });
  const account = user.accounts[0];

  // Generate + insert transactions.
  const gen = generateTransactions(now);
  await prisma.transaction.createMany({
    data: gen.map((t) => ({
      accountId: account.id,
      direction: t.direction,
      amount: t.amount,
      recipientName: t.recipientName ?? null,
      recipientBank: t.recipientBank,
      recipientAccount: t.recipientAccount ?? null,
      category: t.category,
      channel: t.channel,
      narration: t.narration,
      occurredAt: t.occurredAt,
    })),
  });

  // Compute the fingerprint from the ACTUAL inserted rows using the real engine.
  const engineTxs: EngineTransaction[] = gen.map((t) => ({
    amount: t.amount,
    direction: t.direction,
    occurredAt: t.occurredAt,
    recipientName: t.recipientName,
    recipientAccount: t.recipientAccount,
  }));
  const fp = computeProfile(engineTxs);

  // Map recipient identity -> bank/account for storage on KnownRecipient.
  const bankByKey = new Map<string, { bank: string; account: string }>();
  for (const v of VENDORS) {
    const key = recipientKey(v.name, v.account);
    if (key) bankByKey.set(key, { bank: v.bank, account: v.account });
  }

  await prisma.fingerprint.create({
    data: {
      userId: user.id,
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
          const meta = bankByKey.get(r.key);
          return {
            name: r.name,
            bank: meta?.bank ?? null,
            accountNumber: meta?.account ?? null,
            txCount: r.txCount,
            totalAmount: r.totalAmount,
            lastPaidAt: r.lastPaidAt,
          };
        }),
      },
    },
  });

  // Report what was learned (this is what the Trust Panel will display).
  const debitCount = gen.filter((t) => t.direction === "DEBIT").length;
  console.log(`  User:            ${user.name} (${account.accountNumber})`);
  console.log(`  Transactions:    ${gen.length} (${debitCount} debits, ${gen.length - debitCount} credits)`);
  console.log(`  Typical amount:  ₦${Math.round(fp.amountMean).toLocaleString()} (median ₦${Math.round(fp.amountMedian).toLocaleString()})`);
  console.log(`  Amount range:    ₦${Math.round(fp.amountMin).toLocaleString()} – ₦${Math.round(fp.amountMax).toLocaleString()}`);
  console.log(`  Transfer rhythm: ${fp.txPerWeek.toFixed(1)} / week over ${Math.round(fp.historyDays)} days`);
  console.log(`  Known payees:    ${fp.knownRecipients.length}`);
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
