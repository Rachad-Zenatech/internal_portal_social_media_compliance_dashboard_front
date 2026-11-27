/** One status request at a time; late responses cannot update a closed or superseded check. */
export function pollPendingCheck<T>({ load, onResult, onError, intervalMs = 5000, timeoutMs = 15000 }: {
  load: (signal: AbortSignal) => Promise<T>; onResult: (result: T) => boolean;
  onError: () => void; intervalMs?: number; timeoutMs?: number;
}) {
  let stopped = false;
  let busy = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  const stop = () => { stopped = true; clearTimeout(timer); controller?.abort(); };
  const run = async () => {
    if (stopped || busy) return;
    busy = true;
    const request = new AbortController();
    controller = request;
    const timeout = setTimeout(() => request.abort(), timeoutMs);
    try {
      const result = await load(request.signal);
      if (!stopped && !request.signal.aborted && !onResult(result)) stop();
    } catch {
      if (!stopped) onError();
    } finally {
      clearTimeout(timeout);
      busy = false;
      controller = undefined;
      if (!stopped) timer = setTimeout(() => void run(), intervalMs);
    }
  };
  const retry = () => { if (!stopped && !busy) { clearTimeout(timer); void run(); } };
  void run();
  return { stop, retry };
}
