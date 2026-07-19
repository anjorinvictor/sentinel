import { getStoredFingerprint, getSpendingByCategory, getProtectionEvents } from "@/lib/data";
import { TrustPanelView, type TrustData } from "./trust-panel-view";

export const dynamic = "force-dynamic";

export default async function TrustPanelPage() {
  const [fp, categories, events] = await Promise.all([
    getStoredFingerprint(),
    getSpendingByCategory(),
    getProtectionEvents(6),
  ]);

  const auditLog = events
    .filter((e) =>
      [
        "SCORED",
        "CONFIRMED_AFTER_CHALLENGE",
        "VERIFIED",
        "FAILED_VERIFICATION",
        "COOLING_OFF",
        "SCAM_CHECK",
      ].includes(e.type)
    )
    .map((e) => ({
      id: e.id,
      type: e.type,
      summary: e.summary,
      tier: e.tier,
      createdAt: e.createdAt.toISOString(),
    }));

  const data: TrustData = fp
    ? {
        hasProfile: true,
        amountMean: Math.round(fp.amountMean),
        amountMedian: Math.round(fp.amountMedian),
        amountMin: Math.round(fp.amountMin),
        amountMax: Math.round(fp.amountMax),
        txPerWeek: fp.txPerWeek,
        sampleSize: fp.sampleSize,
        historyDays: fp.historyDays,
        hourHistogram: (fp.hourHistogram as number[]) ?? new Array(24).fill(0),
        recipients: fp.knownRecipients.map((r) => ({
          id: r.id,
          name: r.name,
          bank: r.bank,
          accountNumber: r.accountNumber,
          txCount: r.txCount,
          totalAmount: Number(r.totalAmount),
        })),
        categories: categories.map((c) => ({ category: c.category, total: c.total })),
        auditLog,
      }
    : {
        hasProfile: false,
        amountMean: 0,
        amountMedian: 0,
        amountMin: 0,
        amountMax: 0,
        txPerWeek: 0,
        sampleSize: 0,
        historyDays: 0,
        hourHistogram: new Array(24).fill(0),
        recipients: [],
        categories: [],
        auditLog,
      };

  return <TrustPanelView data={data} />;
}
