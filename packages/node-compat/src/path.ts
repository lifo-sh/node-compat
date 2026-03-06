// Posix path implementation matching Node.js path API

export const sep = "/";
export const delimiter = ":";

export function normalize(p: string): string {
  if (p === "") return ".";

  const isAbsolutePath = p.charCodeAt(0) === 47; // '/'
  const trailingSlash = p.charCodeAt(p.length - 1) === 47;

  const segments = p.split("/");
  const result: string[] = [];

  for (const segment of segments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (result.length > 0 && result[result.length - 1] !== "..") {
        result.pop();
      } else if (!isAbsolutePath) {
        result.push("..");
      }
    } else {
      result.push(segment);
    }
  }

  let normalized = result.join("/");
  if (isAbsolutePath) normalized = "/" + normalized;
  if (trailingSlash && normalized !== "/") normalized += "/";
  return normalized || ".";
}

export function join(...paths: string[]): string {
  if (paths.length === 0) return ".";
  const joined = paths.filter((p) => p.length > 0).join("/");
  return normalize(joined);
}

export function resolve(...paths: string[]): string {
  let resolved = "";

  for (let i = paths.length - 1; i >= 0; i--) {
    const path = paths[i];
    if (path.length === 0) continue;
    resolved = path + (resolved ? "/" + resolved : "");
    if (path.charCodeAt(0) === 47) break; // absolute path found
  }

  // If still not absolute, prepend /
  if (resolved.charCodeAt(0) !== 47) {
    resolved = "/" + resolved;
  }

  return normalize(resolved);
}

export function isAbsolute(p: string): boolean {
  return p.length > 0 && p.charCodeAt(0) === 47;
}

export function dirname(p: string): string {
  if (p.length === 0) return ".";

  const hasRoot = p.charCodeAt(0) === 47;
  let end = -1;

  for (let i = p.length - 1; i >= 1; i--) {
    if (p.charCodeAt(i) === 47) {
      end = i;
      break;
    }
  }

  if (end === -1) return hasRoot ? "/" : ".";
  if (hasRoot && end === 0) return "/";
  return p.slice(0, end);
}

export function basename(p: string, ext?: string): string {
  if (p.length === 0) return "";

  // Remove trailing slashes
  let end = p.length;
  while (end > 0 && p.charCodeAt(end - 1) === 47) end--;

  let start = 0;
  for (let i = end - 1; i >= 0; i--) {
    if (p.charCodeAt(i) === 47) {
      start = i + 1;
      break;
    }
  }

  let base = p.slice(start, end);
  if (ext && base.endsWith(ext)) {
    base = base.slice(0, base.length - ext.length);
  }
  return base;
}

export function extname(p: string): string {
  const base = basename(p);
  const dotIndex = base.lastIndexOf(".");
  if (dotIndex <= 0) return "";
  return base.slice(dotIndex);
}

export interface ParsedPath {
  root: string;
  dir: string;
  base: string;
  ext: string;
  name: string;
}

export function parse(p: string): ParsedPath {
  const root = isAbsolute(p) ? "/" : "";
  const dir = dirname(p);
  const base = basename(p);
  const ext = extname(p);
  const name = base.slice(0, base.length - ext.length);
  return { root, dir, base, ext, name };
}

export function format(pathObject: Partial<ParsedPath>): string {
  const dir = pathObject.dir || pathObject.root || "";
  const base =
    pathObject.base ||
    (pathObject.name || "") + (pathObject.ext || "");
  if (!dir) return base;
  if (dir === pathObject.root) return dir + base;
  return dir + "/" + base;
}

export function relative(from: string, to: string): string {
  from = resolve(from);
  to = resolve(to);

  if (from === to) return "";

  const fromParts = from.split("/").filter(Boolean);
  const toParts = to.split("/").filter(Boolean);

  // Find common prefix length
  let commonLength = 0;
  const minLength = Math.min(fromParts.length, toParts.length);
  for (let i = 0; i < minLength; i++) {
    if (fromParts[i] === toParts[i]) {
      commonLength++;
    } else {
      break;
    }
  }

  const ups = fromParts.length - commonLength;
  const remainder = toParts.slice(commonLength);

  const parts: string[] = [];
  for (let i = 0; i < ups; i++) parts.push("..");
  parts.push(...remainder);

  return parts.join("/");
}

export function toNamespacedPath(p: string): string {
  // posix has no namespace concept, return as-is
  return p;
}

const path = {
  sep,
  delimiter,
  normalize,
  join,
  resolve,
  isAbsolute,
  dirname,
  basename,
  extname,
  parse,
  format,
  relative,
  toNamespacedPath,
  posix: null as any,
  win32: null as any,
};

// posix is just itself
path.posix = path;

// win32 is a stub that mirrors posix (since we're a browser polyfill)
path.win32 = path;

export default path;
