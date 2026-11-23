export default function StaleComplianceNotice() {
  return (
    <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
      <strong>This score is from the previous check.</strong> The post, sources or rules have changed. Use Check again to update the score.
    </p>
  );
}
