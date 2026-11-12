import { useEffect, useMemo, useState } from "react";

/**
 * One page of a list shown in the browser. Goes back to the first page when `resetKey` changes (a new filter, search
 * or tab), and back inside the list when it shrinks under the page you're on.
 */
export function usePaged<T>(items: T[], pageSize = 25, resetKey: unknown = null) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  const key = JSON.stringify(resetKey);
  useEffect(() => setPage(0), [key]);
  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [page, pageCount]);

  const current = Math.min(page, pageCount - 1);
  const pageItems = useMemo(() => items.slice(current * pageSize, (current + 1) * pageSize), [items, current, pageSize]);

  /** Opens the page an item is on (e.g. one opened from a link). */
  const showItem = (match: (item: T) => boolean) => {
    const at = items.findIndex(match);
    if (at >= 0) setPage(Math.floor(at / pageSize));
  };

  return { pageItems, page: current, pageCount, setPage, pageSize, total: items.length, showItem };
}
