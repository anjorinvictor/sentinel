import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDemoUser, logEvent } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Delete the entire fingerprint. This is the centerpiece demo: with the profile
 * gone, the Guardian can no longer score transfers (protection degrades), which
 * proves the personalization data IS the protection.
 */
export async function DELETE() {
  const user = await getDemoUser();
  await prisma.fingerprint.deleteMany({ where: { userId: user.id } });
  await logEvent({
    type: "PROFILE_DELETE",
    summary:
      "You deleted your entire Sentinel profile. Protection is now off until you restore it.",
    tier: "UNPROTECTED",
  });
  return NextResponse.json({ ok: true, hasProfile: false });
}
