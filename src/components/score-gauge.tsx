"use client";

import { useEffect, useState } from "react";
import type { RiskTier } from "@/lib/scoring";

const TIER_COLOR: Record<string, string> = {
  PASS: "var(--risk-normal)",
  SOFT_CHALLENGE: "var(--risk-reviewed)",
  HOLD: "var(--risk-blocked)",
};

/**
 * Animated circular risk gauge. Sweeps from 0 to the score on mount and colors
 * itself by tier (teal / amber / red). Purely presentational — the number comes
 * from the deterministic engine.
 */
export function ScoreGauge({
  score,
  tier,
}: {
  score: number;
  tier: RiskTier;
}) {
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setProgress(score / 100));
    return () => cancelAnimationFrame(id);
  }, [score]);

  const color = TIER_COLOR[tier] ?? TIER_COLOR.PASS;

  return (
    <div className="relative h-36 w-36">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 128 128">
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth="10"
        />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          style={{ transition: "stroke-dashoffset 900ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold" style={{ color }}>
          {Math.round(score)}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          risk score
        </span>
      </div>
    </div>
  );
}
