/* eslint-disable no-console */
// Verifies every t("ns:key") / t("key") used in src exists in the English
// locale files. Keys are resolved against the namespaces passed to useT().
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const srcDir = join(root, "src");
const localeDir = join(root, "public/locales/en");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(vue|ts)$/.test(entry) && !entry.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

const cache = new Map();
function loadNamespace(ns) {
  if (!cache.has(ns)) {
    try {
      cache.set(
        ns,
        JSON.parse(readFileSync(join(localeDir, `${ns}.json`), "utf-8")),
      );
    } catch {
      cache.set(ns, null);
    }
  }
  return cache.get(ns);
}

function hasKey(ns, key) {
  const data = loadNamespace(ns);
  if (!data) return false;
  let node = data;
  const parts = key.split(".");
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (node && typeof node === "object" && part in node) {
      node = node[part];
      continue;
    }
    // plural keys are stored with suffixes
    if (i === parts.length - 1 && node && typeof node === "object") {
      return `${part}_one` in node || `${part}_other` in node;
    }
    return false;
  }
  return true;
}

const missing = [];
for (const file of walk(srcDir)) {
  const text = readFileSync(file, "utf-8");
  const nsMatch = text.match(/useT\(\s*\[([^\]]*)\]/);
  const namespaces = nsMatch
    ? [...nsMatch[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1])
    : ["common"];
  for (const match of text.matchAll(/\bt\(\s*(["'])([^"'`$]+)\1/g)) {
    const raw = match[2];
    const [ns, key] = raw.includes(":") ? raw.split(":") : [namespaces[0], raw];
    if (!hasKey(ns, key)) {
      missing.push(`${relative(root, file)}: ${ns}:${key}`);
    }
  }
}

if (missing.length) {
  console.error(`Missing i18n keys:\n  ${missing.join("\n  ")}`);
  process.exit(1);
}
console.log("i18n keys OK");
