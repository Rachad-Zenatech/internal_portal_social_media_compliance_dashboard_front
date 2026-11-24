/** Recover an open tab whose lazy-loaded page belongs to an older deployment. */
interface ReloadRuntime {
  sessionStorage: Pick<Storage, "getItem" | "setItem">;
  location: Pick<Location, "reload">;
}

export function recoverChunkLoad(error: unknown, runtime: ReloadRuntime = window, now = Date.now()): boolean {
  const message = typeof error === "string" ? error
    : error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (!/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .* failed/i.test(message)) return false;
  try {
    const key = "chunk-reload-at";
    const last = Number(runtime.sessionStorage.getItem(key) || "0");
    if (last && now - last < 60_000) return false;
    runtime.sessionStorage.setItem(key, String(now));
    runtime.location.reload();
    return true;
  } catch {
    // A browser blocking storage must not cause another error or a reload loop.
    return false;
  }
}

export function installChunkRecovery() {
  window.addEventListener("vite:preloadError", (event) => {
    const error = (event as Event & { payload: unknown }).payload;
    if (recoverChunkLoad(error)) event.preventDefault();
  });
}
