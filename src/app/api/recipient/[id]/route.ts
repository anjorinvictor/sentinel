import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Forget a known recipient. Deleting the row genuinely removes them from the
 * fingerprint's trusted set — a future transfer to that payee will now score as
 * new. This is real edit/delete control, not a cosmetic toggle.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await prisma.knownRecipient.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Recipient not found." }, { status: 404 });
  }
  await prisma.knownRecipient.delete({ where: { id } });
  await logEvent({
    type: "PROFILE_EDIT",
    summary: `You removed ${existing.name} from your known recipients.`,
    tier: "PASS",
    detail: { recipient: existing.name },
  });
  return NextResponse.json({ ok: true });
}
