/**
 * Stand-in for codemirror-json-schema's markdown renderer, swapped in by the
 * Vite config. The original bundles markdown-it and the shiki highlighter
 * (hundreds of kB) to render schema descriptions, which in Frigate are plain
 * sentences. This keeps what the tooltips use: escaping, `code` and **bold**.
 */
const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function renderMarkdown(markdown: string, inline = true): string {
  const html = String(markdown ?? "")
    .replace(/[&<>"']/g, (char) => ESCAPES[char])
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return inline
    ? html
    : html.replace(/\n{2,}/g, "<br><br>").replace(/\n/g, " ");
}
