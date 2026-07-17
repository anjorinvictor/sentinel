import { Activity } from "lucide-react";
import { ScreenPlaceholder } from "@/components/screen-placeholder";

export default function ActivityPage() {
  return (
    <ScreenPlaceholder
      title="Activity"
      description="A filterable timeline of every action Sentinel has taken."
      icon={Activity}
    />
  );
}
