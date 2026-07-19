/** Format a number as Naira, e.g. 12345.6 -> "₦12,346". */
export function naira(n: number, opts?: { decimals?: boolean }): string {
  return (
    "₦" +
    n.toLocaleString("en-NG", {
      minimumFractionDigits: opts?.decimals ? 2 : 0,
      maximumFractionDigits: opts?.decimals ? 2 : 0,
    })
  );
}

const WAT = "Africa/Lagos";

/** Short date in WAT, e.g. "12 Jul, 2:15 PM". */
export function shortDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: WAT,
  });
}

/** Time-of-day greeting for the dashboard header (WAT). */
export function greeting(d = new Date()): string {
  const h = parseInt(
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hour12: false,
      timeZone: WAT,
    }).format(d),
    10
  );
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
