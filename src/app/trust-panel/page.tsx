import { Eye } from "lucide-react";
import { ScreenPlaceholder } from "@/components/screen-placeholder";

export default function TrustPanelPage() {
  return (
    <ScreenPlaceholder
      title="Trust Panel"
      description="Everything Sentinel knows about you — editable and deletable."
      icon={Eye}
    />
  );
}
