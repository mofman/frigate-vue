declare global {
  interface Window {
    baseUrl?: string;
  }
}

// nginx injects window.baseUrl for ingress paths, so this must stay a plain
// expression the server can rely on
export const baseUrl = `${window.location.protocol}//${window.location.host}${window.baseUrl || "/"}`;

export const wsBaseUrl = baseUrl.replace(/^http/, "ws");

/** Absolute url for a server-relative media path such as "/clips/x.mp4". */
export function mediaUrl(path: string): string {
  return `${baseUrl}${path.replace(/^\//, "")}`;
}
