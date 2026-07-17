import { describe, it, expect } from "vitest";
import { computeProfile } from "./profile";
import { scoreFromHistory, scoreTransaction, MIN_HISTORY } from "./score";
import type { EngineTransaction } from "./types";

/**
 * Deterministic Amina-like history: daytime transfers of roughly ₦10k to a
 * small set of known vendors, over 60 days, plus monthly salary credits.
 * Coherent by construction so we can assert the fingerprint matches the data.
 */
function buildHistory(): EngineTransaction[] {
  const txs: EngineTransaction[] = [];
  const base = new Date("2026-05-01T00:00:00");
  const vendors = [
    { name: "Chicken Republic", acct: "1000000001", amount: 5000 },
    { name: "MTN Data", acct: "1000000002", amount: 3000 },
    { name: "Bolt Transport", acct: "1000000003", amount: 4500 },
    { name: "Mama Okafor", acct: "1000000004", amount: 20000 },
    { name: "PiggyVest", acct: "1000000005", amount: 25000 },
  ];

  // 60 days; ~1 transfer/day cycling through vendors, at daytime hours 8..20.
  for (let day = 0; day < 60; day++) {
    const vendor = vendors[day % vendors.length];
    const d = new Date(base.getTime());
    d.setDate(base.getDate() + day);
    d.setHours(8 + (day % 12), 15, 0, 0); // hours spread across 8..19
    txs.push({
      amount: vendor.amount,
      direction: "DEBIT",
      occurredAt: d,
      recipientName: vendor.name,
      recipientAccount: vendor.acct,
    });
  }

  // Two monthly salary credits (should NOT influence the debit fingerprint).
  for (const day of [1, 31]) {
    const d = new Date(base.getTime());
    d.setDate(base.getDate() + day);
    d.setHours(9, 0, 0, 0);
    txs.push({
      amount: 850000,
      direction: "CREDIT",
      occurredAt: d,
      recipientName: "Union Bank Salary",
      recipientAccount: null,
    });
  }

  return txs;
}

describe("computeProfile", () => {
  const history = buildHistory();
  const fp = computeProfile(history);

  it("uses only debits for the amount statistics (ignores salary credits)", () => {
    // 60 debits; salary credits (₦850k) must not appear in the range.
    expect(fp.sampleSize).toBe(60);
    expect(fp.amountMax).toBe(25000);
    expect(fp.amountMin).toBe(3000);
    // Mean of the 5 cycling amounts = (5000+3000+4500+20000+25000)/5 = 11500.
    expect(Math.round(fp.amountMean)).toBe(11500);
  });

  it("builds a 24-bucket hour histogram that only covers daytime hours", () => {
    expect(fp.hourHistogram).toHaveLength(24);
    const total = fp.hourHistogram.reduce((a, b) => a + b, 0);
    expect(total).toBe(60); // one bucket increment per debit
    // No activity in the dead of night (0..6).
    for (let h = 0; h < 7; h++) expect(fp.hourHistogram[h]).toBe(0);
  });

  it("learns the known-recipient set with correct counts", () => {
    expect(fp.knownRecipients).toHaveLength(5);
    const piggy = fp.knownRecipients.find((r) => r.name === "PiggyVest");
    expect(piggy?.txCount).toBe(12); // 60 / 5 vendors
  });

  it("computes a positive weekly velocity baseline", () => {
    expect(fp.txPerWeek).toBeGreaterThan(0);
    // ~1 tx/day => ~7/week.
    expect(fp.txPerWeek).toBeGreaterThan(5);
    expect(fp.txPerWeek).toBeLessThan(9);
  });
});

describe("scoreTransaction — normal behaviour passes with no friction", () => {
  const history = buildHistory();

  it("a typical ₦5,000 payment to a known vendor at 2 PM scores low (PASS)", () => {
    const result = scoreFromHistory(
      {
        amount: 5000,
        occurredAt: new Date("2026-07-01T14:00:00"),
        recipientName: "Chicken Republic",
        recipientAccount: "1000000001",
      },
      history
    );
    expect(result.tier).toBe("PASS");
    expect(result.score).toBeLessThan(20);
    expect(result.unprotected).toBe(false);
  });
});

describe("scoreTransaction — the fraud scenario is held", () => {
  const history = buildHistory();
  const result = scoreFromHistory(
    {
      amount: 350000,
      occurredAt: new Date("2026-07-01T01:47:00"), // 1:47 AM
      recipientName: "Unknown Payee",
      recipientAccount: "9999999999",
    },
    history
  );

  it("scores high and is tiered HOLD", () => {
    expect(result.score).toBeGreaterThan(65);
    expect(result.tier).toBe("HOLD");
  });

  it("fires the amount, recipient, and time signals", () => {
    const codes = result.reasons.map((r) => r.code);
    expect(codes).toContain("AMOUNT_VERY_HIGH");
    expect(codes).toContain("RECIPIENT_NEW");
    expect(codes.some((c) => c.startsWith("TIME_"))).toBe(true);
  });

  it("returns reasons ordered by contribution (most important first)", () => {
    for (let i = 1; i < result.reasons.length; i++) {
      expect(result.reasons[i - 1].points).toBeGreaterThanOrEqual(
        result.reasons[i].points
      );
    }
  });

  it("every reason carries a human-readable message and points", () => {
    for (const r of result.reasons) {
      expect(r.message.length).toBeGreaterThan(0);
      expect(typeof r.points).toBe("number");
    }
  });
});

describe("scoreTransaction — individual signal behaviour", () => {
  const history = buildHistory();

  it("a large amount to a KNOWN recipient at a normal hour is only a soft challenge, not a hold", () => {
    const result = scoreFromHistory(
      {
        amount: 120000, // ~10x typical but to a trusted payee
        occurredAt: new Date("2026-07-01T14:00:00"),
        recipientName: "PiggyVest",
        recipientAccount: "1000000005",
      },
      history
    );
    // Amount fires, but recipient is trusted and time/velocity are normal.
    expect(result.tier).not.toBe("HOLD");
    const recipient = result.reasons.find((r) => r.signal === "recipient");
    expect(recipient?.code).toBe("RECIPIENT_KNOWN");
    expect(recipient?.severity).toBe(0);
  });

  it("detects a velocity spike: many transfers in one hour", () => {
    const spikeTime = new Date("2026-07-01T14:00:00");
    // Inject 4 recent transfers within the hour before the proposed one.
    const recentTimes = [10, 20, 30, 40].map(
      (m) => new Date(spikeTime.getTime() - m * 60 * 1000)
    );
    const fp = computeProfile(history);
    const result = scoreTransaction(
      {
        amount: 5000,
        occurredAt: spikeTime,
        recipientName: "Chicken Republic",
        recipientAccount: "1000000001",
      },
      fp,
      recentTimes
    );
    const velocity = result.reasons.find((r) => r.signal === "velocity");
    expect(velocity?.severity).toBeGreaterThan(0.5);
    expect(velocity?.code).toMatch(/VELOCITY_(ELEVATED|SPIKE)/);
  });

  it("a brand-new recipient always fires RECIPIENT_NEW at full severity", () => {
    const fp = computeProfile(history);
    const result = scoreTransaction(
      {
        amount: 5000,
        occurredAt: new Date("2026-07-01T14:00:00"),
        recipientName: "Somebody New",
        recipientAccount: "8888888888",
      },
      fp,
      []
    );
    const recipient = result.reasons.find((r) => r.signal === "recipient");
    expect(recipient?.code).toBe("RECIPIENT_NEW");
    expect(recipient?.severity).toBe(1);
  });
});

describe("scoreTransaction — no protection without enough history", () => {
  it("returns unprotected when history is below the minimum", () => {
    const tinyHistory: EngineTransaction[] = Array.from(
      { length: MIN_HISTORY - 1 },
      (_, i) => ({
        amount: 5000,
        direction: "DEBIT" as const,
        occurredAt: new Date(`2026-06-0${i + 1}T12:00:00`),
        recipientName: "Chicken Republic",
        recipientAccount: "1000000001",
      })
    );
    const result = scoreFromHistory(
      {
        amount: 350000,
        occurredAt: new Date("2026-07-01T01:47:00"),
        recipientName: "Unknown Payee",
        recipientAccount: "9999999999",
      },
      tinyHistory
    );
    expect(result.unprotected).toBe(true);
    expect(result.reasons[0].code).toBe("NO_PROFILE");
  });
});
