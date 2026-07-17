/**
 * Deterministic generator for Amina's 90-day transaction history.
 *
 * Kept separate from seed.ts so it can be probed/tested without a database. The
 * fingerprint is never hardcoded here — it is computed from whatever this
 * produces (see seed.ts), so this file only has to be realistic, not "correct".
 */
import type { TxCategory, TxChannel } from "@prisma/client";
import type { EngineTransaction } from "../src/lib/scoring";

// --- deterministic PRNG (mulberry32) so the seed is reproducible ------------
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const HISTORY_DAYS = 90;

export interface VendorTemplate {
  name: string;
  bank: string;
  account: string;
  category: TxCategory;
  channel: TxChannel;
  baseAmount: number;
  spread: number;
  count: number; // occurrences across the 90-day window
  hours: number[]; // realistic active hours for this kind of spend
  narration: string;
}

/**
 * Regular payees. Frequencies sum to ~55 debits over ~13 weeks (~4.3/week),
 * matching a realistic personal-banking rhythm. Amounts are chosen so the blended
 * typical transfer lands around ₦8–12k with a long tail up to ~₦30k.
 */
export const VENDORS: VendorTemplate[] = [
  { name: "Chicken Republic", bank: "GTBank", account: "0221145098", category: "FOOD", channel: "CARD", baseAmount: 4200, spread: 1500, count: 13, hours: [12, 13, 14, 19, 20], narration: "Chicken Republic purchase" },
  { name: "Bolt Nigeria", bank: "Access Bank", account: "0691200455", category: "TRANSPORT", channel: "CARD", baseAmount: 2600, spread: 1000, count: 13, hours: [7, 8, 9, 18, 19, 21], narration: "Bolt ride" },
  { name: "MTN VTU", bank: "Zenith Bank", account: "1013380022", category: "DATA_AIRTIME", channel: "BILL", baseAmount: 2000, spread: 800, count: 10, hours: [8, 10, 13, 17, 20, 22], narration: "MTN data bundle" },
  { name: "Shoprite", bank: "UBA", account: "2044550781", category: "SHOPPING", channel: "CARD", baseAmount: 16000, spread: 5500, count: 6, hours: [12, 14, 16, 18, 19], narration: "Shoprite groceries" },
  { name: "Mama Okafor", bank: "Access Bank", account: "0044119827", category: "FAMILY", channel: "TRANSFER", baseAmount: 22000, spread: 5000, count: 4, hours: [18, 19, 20, 21], narration: "Transfer to Mum" },
  { name: "PiggyVest", bank: "Providus Bank", account: "9901234567", category: "SAVINGS", channel: "STANDING_ORDER", baseAmount: 22000, spread: 3000, count: 3, hours: [9, 10], narration: "PiggyVest savings" },
  { name: "EKEDC", bank: "Zenith Bank", account: "1099887766", category: "UTILITIES", channel: "BILL", baseAmount: 12000, spread: 3000, count: 3, hours: [8, 11, 15, 18], narration: "Electricity token" },
  { name: "DSTV", bank: "GTBank", account: "0330091234", category: "UTILITIES", channel: "BILL", baseAmount: 8500, spread: 1500, count: 3, hours: [9, 12, 17, 20], narration: "DSTV subscription" },
];

export interface GenTx extends EngineTransaction {
  category: TxCategory;
  channel: TxChannel;
  narration: string;
  recipientBank: string | null;
}

/**
 * Build the full 90-day ledger ending at `now`. `seed` controls the PRNG so the
 * same `now` + `seed` always produce the same history.
 */
export function generateTransactions(now: Date, seed = 20260719): GenTx[] {
  const rng = makeRng(seed);
  const randInt = (lo: number, hi: number) =>
    lo + Math.floor(rng() * (hi - lo + 1));
  const jitterAmount = (base: number, spread: number, min = 500) => {
    const raw = base + (rng() * 2 - 1) * spread;
    return Math.max(min, Math.round(raw / 50) * 50);
  };
  const pick = <T,>(xs: T[]): T => xs[Math.floor(rng() * xs.length)];

  const start = new Date(now);
  start.setDate(start.getDate() - HISTORY_DAYS);

  const txs: GenTx[] = [];

  // Debit transfers to regular payees, spread across the window.
  for (const v of VENDORS) {
    const spacing = HISTORY_DAYS / v.count;
    for (let i = 0; i < v.count; i++) {
      const jitterDays = (rng() * 2 - 1) * (spacing * 0.35);
      const dayOffset = Math.min(
        HISTORY_DAYS - 1,
        Math.max(0, Math.round(i * spacing + spacing / 2 + jitterDays))
      );
      const d = new Date(start);
      d.setDate(start.getDate() + dayOffset);
      d.setHours(pick(v.hours), randInt(0, 59), 0, 0);
      txs.push({
        amount: jitterAmount(v.baseAmount, v.spread),
        direction: "DEBIT",
        occurredAt: d,
        recipientName: v.name,
        recipientAccount: v.account,
        recipientBank: v.bank,
        category: v.category,
        channel: v.channel,
        narration: v.narration,
      });
    }
  }

  // Monthly salary credits (~26th of each month at 9 AM). These do NOT shape the
  // debit fingerprint but make the balance and dashboard realistic.
  for (let m = 3; m >= 1; m--) {
    const d = new Date(now);
    d.setDate(now.getDate() - m * 30);
    d.setDate(26);
    d.setHours(9, 5, 0, 0);
    if (d < start || d > now) continue;
    txs.push({
      amount: jitterAmount(850000, 12000, 800000),
      direction: "CREDIT",
      occurredAt: d,
      recipientName: "Union Bank Salary",
      recipientAccount: null,
      recipientBank: "Union Bank",
      category: "SALARY",
      channel: "TRANSFER",
      narration: "Salary — monthly",
    });
  }

  txs.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  return txs;
}
