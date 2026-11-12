import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

/** Narrows the facts (one per newsroom article, so hundreds) by a word in the title or text. */
export default function FactSearchBar({ total, value, onChange }: { total: number; value: string; onChange: (v: string) => void }) {
  if (total === 0) return null;
  return (
    <div className="relative border-b border-border/60 px-4 py-2.5">
      <Search className="pointer-events-none absolute left-6.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Search ${total} facts (a product, partner, place...)`}
        aria-label="Search facts"
        className="h-8 pl-8 text-xs"
      />
    </div>
  );
}
