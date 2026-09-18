"use client";

/**
 * Typed fetch wrapper for our own API.
 *
 * Route Handlers always answer `{ error, code }` on failure, so this is the one
 * place that turns a non-2xx response into a thrown Error carrying a message
 * that is already safe and readable for the user.
 */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiPost<TResponse = unknown>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<TResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    signal,
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // A body-less response is fine for 204s and unexpected gateway errors.
  }

  if (!response.ok) {
    const err = payload as { error?: string; code?: string } | null;
    throw new ApiError(
      err?.error ?? "Something went wrong. Please try again.",
      response.status,
      err?.code ?? "UNKNOWN",
    );
  }

  return payload as TResponse;
}
