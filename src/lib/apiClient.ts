// Typed fetch wrapper used by client-side mutation hooks. Centralises JSON
// encoding, error-shape parsing, and the ApiError class so every hook surfaces
// the same shape to react-query.

export type ApiErrorPayload = {
  error?: string;
  issues?: unknown;
};

export class ApiError extends Error {
  status: number;
  issues: unknown;

  constructor(message: string, status: number, issues?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
  }
}

type ApiFetchInit = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export async function apiFetch<T = unknown>(
  url: string,
  init: ApiFetchInit = {},
): Promise<T> {
  const { body, headers, ...rest } = init;
  const hasBody = body !== undefined && body !== null;

  const res = await fetch(url, {
    ...rest,
    headers: hasBody
      ? { "content-type": "application/json", ...headers }
      : headers,
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  let payload: ApiErrorPayload & Record<string, unknown> = {};
  try {
    payload = (await res.json()) as typeof payload;
  } catch {
    // Non-JSON response (e.g. HTML error page from a proxy). Fall through.
  }

  if (!res.ok) {
    throw new ApiError(
      payload.error ?? `Request failed (${res.status})`,
      res.status,
      payload.issues,
    );
  }

  return payload as T;
}
