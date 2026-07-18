import { prisma } from "@/lib/db";
import { storedToEngineFingerprint } from "@/lib/fingerprint";
import type { Fingerprint } from "@/lib/scoring";
import type { Prisma } from "@prisma/client";

/**
 * Server-side data access for the single demo persona (Amina). In a real
 * deployment this would be scoped to the authenticated user; here there is one
 * seeded user and one account.
 */

export async function getDemoUser() {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) throw new Error("No demo user seeded. Run `npm run db:seed`.");
  return user;
}

export async function getAccount() {
  const user = await getDemoUser();
  const account = await prisma.account.findFirst({
    where: { userId: user.id },
  });
  if (!account) throw new Error("No account for demo user.");
  return { user, account };
}

export async function getTransactions(limit?: number) {
  const { account } = await getAccount();
  const txs = await prisma.transaction.findMany({
    where: { accountId: account.id },
    orderBy: { occurredAt: "desc" },
    ...(limit ? { take: limit } : {}),
  });
  return txs.map((t) => ({ ...t, amount: Number(t.amount) }));
}

/** The persisted fingerprint row (or null if the profile has been deleted). */
export async function getStoredFingerprint() {
  const user = await getDemoUser();
  return prisma.fingerprint.findUnique({
    where: { userId: user.id },
    include: { knownRecipients: { orderBy: { txCount: "desc" } } },
  });
}

/** The fingerprint in engine shape, or null when protection is unavailable. */
export async function getEngineFingerprint(): Promise<Fingerprint | null> {
  const stored = await getStoredFingerprint();
  return stored ? storedToEngineFingerprint(stored) : null;
}

/** Occurrence times of past debit transfers, for the velocity signal. */
export async function getRecentDebitTimes(): Promise<Date[]> {
  const { account } = await getAccount();
  const rows = await prisma.transaction.findMany({
    where: { accountId: account.id, direction: "DEBIT" },
    select: { occurredAt: true },
    orderBy: { occurredAt: "desc" },
    take: 200,
  });
  return rows.map((r) => r.occurredAt);
}

export async function getProtectionEvents(limit = 100) {
  const user = await getDemoUser();
  return prisma.protectionEvent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/** Log one Sentinel action to the protection/activity log. */
export async function logEvent(input: {
  type: string;
  summary: string;
  score?: number;
  tier?: string;
  detail?: Prisma.InputJsonValue;
}) {
  const user = await getDemoUser();
  return prisma.protectionEvent.create({
    data: {
      userId: user.id,
      type: input.type,
      summary: input.summary,
      score: input.score,
      tier: input.tier,
      detail: input.detail,
    },
  });
}

/** Spend grouped by category over the debit history (for the donut chart). */
export async function getSpendingByCategory() {
  const { account } = await getAccount();
  const grouped = await prisma.transaction.groupBy({
    by: ["category"],
    where: { accountId: account.id, direction: "DEBIT" },
    _sum: { amount: true },
    _count: { _all: true },
  });
  return grouped
    .map((g) => ({
      category: g.category,
      total: Number(g._sum.amount ?? 0),
      count: g._count._all,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Three personalized insight cards, computed from real data. These are the
 * personalization face of the same fingerprint that powers protection.
 */
export async function getInsights() {
  const { account } = await getAccount();
  const debits = await prisma.transaction.findMany({
    where: { accountId: account.id, direction: "DEBIT" },
    select: { amount: true, category: true, recipientName: true },
  });

  const sumBy = (cat: string) =>
    debits
      .filter((d) => d.category === cat)
      .reduce((a, d) => a + Number(d.amount), 0);

  const data = sumBy("DATA_AIRTIME");
  const food = sumBy("FOOD");
  const savings = sumBy("SAVINGS");
  const savingsCount = debits.filter((d) => d.category === "SAVINGS").length;

  return [
    {
      icon: "trending",
      title: "Data spending",
      body: `You've spent ${nairaShort(data)} on data & airtime over the last 90 days — worth checking your bundle plan.`,
    },
    {
      icon: "piggy",
      title: "Savings rhythm",
      body:
        savingsCount > 0
          ? `You move about ${nairaShort(Math.round(savings / Math.max(savingsCount, 1)))} to savings after payday. Want to automate it?`
          : `No regular savings detected yet — a standing order after payday could help.`,
    },
    {
      icon: "food",
      title: "Food spending",
      body: `${nairaShort(food)} on food so far. Sentinel tracks this against your own baseline, not a generic budget.`,
    },
  ];
}

function nairaShort(n: number): string {
  return "₦" + Math.round(n).toLocaleString("en-NG");
}
