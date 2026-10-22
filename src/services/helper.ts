export class ApiError extends Error {
  status: number;
  /** Raw `detail` from the response: a string, an object such as `{ message, missing }`, or FastAPI's validation list. */
  detail: unknown;
  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

function detailMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => (d && typeof d === "object" && "msg" in d ? String(d.msg) : String(d))).join("; ");
  }
  if (detail && typeof detail === "object" && "message" in detail) return String((detail as { message: unknown }).message);
  return "";
}

/** Fired on window when the server says the sign-in is no longer valid (e.g. signed out after inactivity). */
export const SESSION_EXPIRED_EVENT = "auth:session-expired";

export async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = (err as { detail?: unknown }).detail;
    const message = detailMessage(detail) || "Request failed";
    // 401 means the session ended (403 is only a missing permission). AuthProvider signs out and opens the login page.
    if (res.status === 401 && !res.url.includes("/auth/logout")) {
      window.dispatchEvent(new CustomEvent<string>(SESSION_EXPIRED_EVENT, { detail: message }));
    }
    throw new ApiError(message, res.status, detail);
  }
  if (res.status === 204) return null as unknown as T;
  return res.json() as Promise<T>;
}