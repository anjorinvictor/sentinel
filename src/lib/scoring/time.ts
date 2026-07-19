/**
 * Timezone-stable hour-of-day.
 *
 * Sentinel is a Nigerian bank product, so "what hour is it for the customer" is
 * always West Africa Time (WAT / Africa/Lagos) — never the server's timezone.
 * If we used Date.getHours() the histogram (learned wherever the seed ran) and
 * the live score (computed on Vercel, which runs in UTC) would disagree by an
 * hour and wrongly flag normal daytime transfers. Anchoring both to Africa/Lagos
 * keeps them in lockstep and makes "active hours" mean the same thing everywhere.
 */
export const SENTINEL_TZ = "Africa/Lagos";

export function hourInZone(date: Date, tz: string = SENTINEL_TZ): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    timeZone: tz,
  }).formatToParts(date);
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
  const h = parseInt(hourStr, 10);
  return Number.isFinite(h) ? h % 24 : 0;
}
