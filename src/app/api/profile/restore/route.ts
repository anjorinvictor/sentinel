import { NextResponse } from "next/server";
import { getDemoUser, logEvent } from "@/lib/data";
import { rebuildFingerprintForUser } from "@/lib/profile-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rebuild the fingerprint from the user's real transaction history and turn
 * protection back on. The restored profile is computed by the same engine that
 * scores transfers — nothing is faked.
 */
export async function POST() {
  const user = await getDemoUser();
  const fp = await rebuildFingerprintForUser(user.id);
  await logEvent({
    type: "PROFILE_RESTORE",
    summary: `You restored your Sentinel profile from ${fp.sampleSize} transactions. Protection is back on.`,
    tier: "PASS",
  });
  return NextResponse.json({ ok: true, hasProfile: true, sampleSize: fp.sampleSize });
}
