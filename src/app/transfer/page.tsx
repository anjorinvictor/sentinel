import { Send } from "lucide-react";
import { ScreenPlaceholder } from "@/components/screen-placeholder";

export default function TransferPage() {
  return (
    <ScreenPlaceholder
      title="Transfer"
      description="Real-time scoring against your fingerprint on every transfer."
      icon={Send}
    />
  );
}
