export type SortOrder = "deadline" | "newest" | "oldest";

interface QueueDates {
  due_at?: string | null;
  submitted_at?: string | null;
}

function dateValue(value?: string | null): number | null {
  const timestamp = value ? Date.parse(value) : NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

/** Earliest deadlines first by default; missing dates always follow dated posts. */
export function orderScreenerQueue<T extends QueueDates>(items: readonly T[], order: SortOrder = "deadline"): T[] {
  const field = order === "deadline" ? "due_at" : "submitted_at";
  const direction = order === "newest" ? -1 : 1;
  return items.map(item => ({ item, at: dateValue(item[field]) }))
    .sort((a, b) => Number(a.at === null) - Number(b.at === null)
      || (a.at === null || b.at === null ? 0 : direction * (a.at - b.at)))
    .map(({ item }) => item);
}
