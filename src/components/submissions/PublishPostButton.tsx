import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PublishPostButton({ onClick, disabled = false, busy = false, label = "Publish post" }: {
  onClick: () => void; disabled?: boolean; busy?: boolean; label?: string;
}) {
  return (
    <Button type="button" size="lg" onClick={onClick} disabled={disabled || busy} className="h-12 min-w-44 gap-2 rounded-xl bg-emerald-600 px-6 text-base font-bold text-white shadow-md hover:bg-emerald-700">
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}{busy ? "Working?" : label}
    </Button>
  );
}
