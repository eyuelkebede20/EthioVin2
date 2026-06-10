const API_URL = import.meta.env.VITE_BACKEND_URL ?? "";

/** Error carrying the HTTP status and the server's `{ error }` message. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Single entry point for backend calls. Always sends the session cookie,
 * JSON-encodes the body, and throws ApiError (with the server message) on non-2xx.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      credentials: "include",
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch {
    throw new ApiError(0, "Network error — is the server running?");
  }

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : {};

  if (!res.ok) {
    const message = (data as { error?: string })?.error ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }

  return data as T;
}
