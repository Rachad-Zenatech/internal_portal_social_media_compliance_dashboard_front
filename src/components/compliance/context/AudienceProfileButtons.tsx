import { Button } from "@/components/ui/button";
import type { ContextEntry } from "@/types/context";

/** One button per audience profile; the picked one is shown below. A profile that's turned off is faded. */
export default function AudienceProfileButtons({
  profiles,
  selectedId,
  onSelect,
}: {
  profiles: ContextEntry[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  if (profiles.length === 0) return null;
  return (
    <div role="tablist" aria-label="Audience profile" className="flex flex-wrap gap-1.5 border-b border-border/60 px-4 py-3">
      {profiles.map((e) => (
        <Button
          key={e.id}
          role="tab"
          aria-selected={e.id === selectedId}
          size="sm"
          variant={e.id === selectedId ? "default" : "outline"}
          className={`h-8 text-xs ${e.is_active ? "" : "opacity-60"}`}
          onClick={() => onSelect(e.id)}
        >
          {e.title}
        </Button>
      ))}
    </div>
  );
}
