"use client";

// Browser-side client for the Django admin API (/api/admin/*). Uses the Django
// session cookie; unsafe requests carry the CSRF token Django expects.

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

let csrfReady: Promise<void> | null = null;

async function ensureCsrf(): Promise<string> {
  if (!readCookie("csrftoken")) {
    csrfReady ??= fetch("/api/admin/auth/csrf/", { credentials: "same-origin" }).then(() => undefined);
    await csrfReady;
    csrfReady = null;
  }
  return readCookie("csrftoken") ?? "";
}

/** Turn a DRF error body into a readable message plus per-field messages. */
function parseError(body: unknown, status: number): ApiError {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const fields: Record<string, string> = {};
    let detail = "";
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      const text = Array.isArray(value)
        ? value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(" ")
        : typeof value === "string"
          ? value
          : JSON.stringify(value);
      if (key === "detail" || key === "non_field_errors") detail = text;
      else fields[key] = text;
    }
    const message = detail || Object.values(fields)[0] || "Something went wrong.";
    return new ApiError(message, status, fields);
  }
  if (status === 429) return new ApiError("Too many attempts. Please wait a minute and try again.", status);
  return new ApiError(`Request failed (${status}).`, status);
}

export async function api<T = unknown>(
  path: string,
  options: {
    method?: string;
    /** JSON-serialisable data, or FormData for file uploads. */
    body?: unknown;
    query?: Record<string, string | number | boolean | undefined>;
  } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  const isForm = options.body instanceof FormData;
  if (method !== "GET") {
    headers["X-CSRFToken"] = await ensureCsrf();
    if (!isForm) headers["Content-Type"] = "application/json";
  }

  let url = `/api/admin/${path.replace(/^\//, "")}`;
  if (options.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined && v !== "" && v !== false) qs.set(k, String(v));
    }
    if (qs.size) url += `?${qs}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    credentials: "same-origin",
    body: options.body === undefined ? undefined : isForm ? (options.body as FormData) : JSON.stringify(options.body),
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw parseError(body, res.status);
  return body as T;
}

export const isAuthError = (err: unknown) => err instanceof ApiError && (err.status === 401 || err.status === 403);
