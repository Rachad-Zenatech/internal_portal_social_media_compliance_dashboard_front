import { useRef } from "react";
import { Button } from "@/components/ui/button";

export default function RevisionMediaReplace({ accept, busy, onReplace }: { accept: string; busy: boolean; onReplace: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const change = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onReplace(file);
    event.target.value = "";
  };
  return <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
    <input ref={input} type="file" accept={accept} hidden onChange={change} disabled={busy} />
    <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Replacing media..." : "Replace main image or video"}</Button>
    <p className="text-xs text-muted-foreground">You can also add or remove images in the media section below.</p>
  </div>;
}
