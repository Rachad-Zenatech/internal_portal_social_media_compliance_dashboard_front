export default function ReviewChecksHeader() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-foreground">Review checks</h3>
      <p className="text-[11px] text-muted-foreground">Analysis does not approve or publish content.</p>
    </div>
  );
}
