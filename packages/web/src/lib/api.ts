export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export type GetToken = () => Promise<string | null>;

export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

export interface Api {
  apiFetch: <T = unknown>(path: string, options?: ApiFetchOptions) => Promise<T>;
}

function buildUrl(baseUrl: string, path: string, query?: ApiFetchOptions["query"]): string {
  const url = new URL(path.replace(/^\//, ""), baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export function createApi(getToken: GetToken): Api {
  const baseUrl = import.meta.env.VITE_API_URL;
  if (!baseUrl) {
    throw new Error(
      "VITE_API_URL is not set. Configure it in packages/web/.env (see .env.example)."
    );
  }

  async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
    const { method = "GET", body, query } = options;

    const headers: Record<string, string> = {};

    // Only declare a JSON body when we actually send one. Setting
    // Content-Type: application/json on a bodyless request makes Fastify's JSON
    // parser reject it (empty body), which 500s POSTs like approve/cancel.
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const token = await getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(buildUrl(baseUrl, path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let message = `Request failed with status ${response.status}`;
      let code = "unknown_error";
      try {
        const errorBody = await response.json();
        if (errorBody && typeof errorBody === "object") {
          if (typeof errorBody.error === "string") message = errorBody.error;
          if (typeof errorBody.code === "string") code = errorBody.code;
        }
      } catch {
        // response body wasn't valid JSON; fall back to defaults above
      }
      throw new ApiError(message, code, response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    try {
      return (await response.json()) as T;
    } catch {
      // Empty or non-JSON success body (e.g. 200/201 with no content) - treat as no data.
      return undefined as T;
    }
  }

  return { apiFetch };
}
