import { getProtectionEvents } from "@/lib/data";
import { ActivityView, type ActivityEvent } from "./activity-view";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const events = await getProtectionEvents(100);
  const mapped: ActivityEvent[] = events.map((e) => ({
    id: e.id,
    type: e.type,
    summary: e.summary,
    score: e.score,
    tier: e.tier,
    createdAt: e.createdAt.toISOString(),
  }));
  return <ActivityView events={mapped} />;
}
