/** Thin fetch wrapper for the Frigate REST API. */
import { baseUrl } from "./baseUrl";

export const apiBase = `${baseUrl}api/`;

export class HttpError extends Error {
  constructor(
    public status: number,
    public url: string,
  ) {
    super(`Request failed with ${status}`);
  }
}

const REDIRECT_PARAM = "redirect";
let redirectingToLogin = false;

export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined
>;

export function buildUrl(path: string, params?: QueryParams): string {
  const url = new URL(path.replace(/^\//, ""), apiBase);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.href;
}

/** Login page url carrying the current location so we can return to it. */
export function loginUrl(loginPage = `${baseUrl}login`): string {
  const url = new URL(loginPage, window.location.href);
  if (url.origin !== window.location.origin) {
    return loginPage;
  }
  const { pathname, search, hash } = window.location;
  const current = `${pathname}${search}${hash}`;
  if (current !== new URL(baseUrl).pathname && !pathname.endsWith("/login")) {
    url.searchParams.set(REDIRECT_PARAM, current);
  }
  return url.href;
}

/** Where to go after logging in, restricted to this origin. */
export function postLoginUrl(): string {
  const target = new URLSearchParams(window.location.search).get(
    REDIRECT_PARAM,
  );
  if (!target) return baseUrl;
  try {
    const url = new URL(target, window.location.origin);
    return url.origin === window.location.origin ? url.href : baseUrl;
  } catch {
    return baseUrl;
  }
}

function handleAuthFailure(response: Response) {
  if (redirectingToLogin || window.location.pathname.endsWith("/login")) {
    return;
  }
  redirectingToLogin = true;
  const location = response.headers.get("location");
  window.location.href = loginUrl(location ?? undefined);
}

type RequestOptions = {
  params?: QueryParams;
  body?: unknown;
  signal?: AbortSignal;
  /** skip the login redirect, used by the auth bootstrap itself */
  allowUnauthorized?: boolean;
};

async function request<T>(
  method: string,
  path: string,
  { params, body, signal, allowUnauthorized }: RequestOptions = {},
): Promise<T> {
  const url = buildUrl(path, params);
  const response = await fetch(url, {
    method,
    signal,
    credentials: "include",
    headers: {
      "X-CSRF-TOKEN": "1",
      "X-CACHE-BYPASS": "1",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if ([401, 302, 307].includes(response.status)) {
    if (!allowUnauthorized) handleAuthFailure(response);
    throw new HttpError(response.status, url);
  }

  if (!response.ok) {
    throw new HttpError(response.status, url);
  }

  const type = response.headers.get("content-type") ?? "";
  return (type.includes("json") ? response.json() : response.text()) as T;
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, options),
};
