import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cancel an active 24-hour cooling-off hold from the Activity screen. Marks the
 * hold's log entry cancelled and records the cancellation. The held transfer was
 * never executed, so there is no money to reverse — cancelling simply closes it.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const eventId: string = body.eventId ?? "";

    const ev = await prisma.protectionEvent.findUnique({
      where: { id: eventId },
    });
    if (!ev || ev.type !== "COOLING_OFF") {
      return NextResponse.json({ error: "Hold not found." }, { status: 404 });
    }

    const detail = (ev.detail as Record<string, unknown> | null) ?? {};
    if (detail.status !== "active") {
      return NextResponse.json({ ok: true, alreadyResolved: true });
    }

    await prisma.protectionEvent.update({
      where: { id: ev.id },
      data: { detail: { ...detail, status: "cancelled" } },
    });

    await logEvent({
      type: "COOLING_OFF_CANCELLED",
      summary: `You cancelled the 24-hour hold on ${
        (detail.recipientName as string) ?? "a transfer"
      }. It will not be sent.`,
      tier: (ev.tier as string) ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Cooloff cancel failed:", err);
    return NextResponse.json({ error: "Could not cancel." }, { status: 500 });
  }
}
