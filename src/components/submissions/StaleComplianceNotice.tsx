export default function StaleComplianceNotice() {
  return (
    <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
      <strong>This score is from the previous check.</strong> The saved check no longer matches the current post inputs or checking system. This can happen after an update to the automated checks, even if you have not edited the post. Use Check again to update the score. If only the checking system changed, you can still send for review using this saved score.
    </p>
  );
}
