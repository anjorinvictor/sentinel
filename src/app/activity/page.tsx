import { getProtectionEvents } from "@/lib/data";
import { ActivityView, type ActivityEvent } from "./activity-view";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const events = await getProtectionEvents(100);
  const mapped: ActivityEvent[] = events.map((e) => {
    const detail = (e.detail as Record<string, unknown> | null) ?? {};
    return {
      id: e.id,
      type: e.type,
      summary: e.summary,
      score: e.score,
      tier: e.tier,
      createdAt: e.createdAt.toISOString(),
      // An active cooling-off hold can be cancelled from the timeline.
      cancellable: e.type === "COOLING_OFF" && detail.status === "active",
    };
  });
  return <ActivityView events={mapped} />;
}
