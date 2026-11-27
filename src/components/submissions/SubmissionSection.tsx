import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export default function Section({ title, description, children, id }: {
  step?: number; title: string; description?: string; children: ReactNode; id?: string;
}) {
  return (
    <Card id={id} className="py-0 gap-0 rounded-2xl border-border/70 shadow-xs scroll-mt-4">
      <div className="px-5 sm:px-6 pt-5 pb-3">
        <h2 className="text-lg font-bold tracking-tight text-foreground leading-tight">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      <div className="px-5 sm:px-6 pb-6">{children}</div>
    </Card>
  );
}
