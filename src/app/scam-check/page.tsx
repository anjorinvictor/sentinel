import { ShieldCheck } from "lucide-react";
import { ScreenPlaceholder } from "@/components/screen-placeholder";

export default function ScamCheckPage() {
  return (
    <ScreenPlaceholder
      title="Scam Check"
      description="Paste a suspicious message; Sentinel reads it for scam intent."
      icon={ShieldCheck}
    />
  );
}
