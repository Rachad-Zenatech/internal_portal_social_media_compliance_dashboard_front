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

export async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = (err as { detail?: unknown }).detail;
    throw new ApiError(detailMessage(detail) || "Request failed", res.status, detail);
  }
  if (res.status === 204) return null as unknown as T;
  return res.json() as Promise<T>;
}