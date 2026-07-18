import { cn } from "@/lib/utils";
import type { RiskTier } from "@/lib/scoring";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className
      )}
      {...props}
    />
  );
}

/**
 * Risk badge with the three states from the design spec:
 * green "Normal" (PASS) / amber "Reviewed" (SOFT_CHALLENGE) / red "Blocked" (HOLD).
 */
export function RiskBadge({ tier }: { tier: RiskTier | "UNPROTECTED" }) {
  const map: Record<string, { label: string; cls: string }> = {
    PASS: {
      label: "Normal",
      cls: "border-safe/30 bg-safe/10 text-safe",
    },
    SOFT_CHALLENGE: {
      label: "Reviewed",
      cls: "border-risk-reviewed/30 bg-risk-reviewed/10 text-risk-reviewed",
    },
    HOLD: {
      label: "Blocked",
      cls: "border-risk-blocked/30 bg-risk-blocked/10 text-risk-blocked",
    },
    UNPROTECTED: {
      label: "Unprotected",
      cls: "border-muted-foreground/30 bg-muted-foreground/10 text-muted-foreground",
    },
  };
  const { label, cls } = map[tier] ?? map.PASS;
  return <Badge className={cls}>{label}</Badge>;
}
