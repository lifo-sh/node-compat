const _URL = globalThis.URL;
const _URLSearchParams = globalThis.URLSearchParams;

export { _URL as URL, _URLSearchParams as URLSearchParams };

export interface UrlObject {
  protocol?: string | null;
  slashes?: boolean | null;
  auth?: string | null;
  host?: string | null;
  hostname?: string | null;
  port?: string | number | null;
  pathname?: string | null;
  search?: string | null;
  query?: string | Record<string, string> | null;
  hash?: string | null;
  path?: string | null;
  href?: string;
}

export function parse(urlString: string, parseQueryString = false): UrlObject {
  try {
    const u = new _URL(urlString);
    const result: UrlObject = {
      protocol: u.protocol,
      slashes: u.protocol.endsWith(":") && urlString.includes("//"),
      auth: u.username ? (u.password ? `${u.username}:${u.password}` : u.username) : null,
      host: u.host,
      hostname: u.hostname,
      port: u.port || null,
      pathname: u.pathname,
      search: u.search || null,
      hash: u.hash || null,
      path: u.pathname + (u.search || ""),
      href: u.href,
    };
    if (parseQueryString) {
      const q: Record<string, string> = {};
      u.searchParams.forEach((v, k) => { q[k] = v; });
      result.query = q;
    } else {
      result.query = u.search ? u.search.slice(1) : null;
    }
    return result;
  } catch {
    // Fallback for non-standard URLs
    return { href: urlString, pathname: urlString, protocol: null, host: null, hostname: null, port: null, search: null, query: null, hash: null, path: urlString, slashes: false, auth: null };
  }
}

export function format(urlObj: UrlObject | string): string {
  if (typeof urlObj === "string") return urlObj;

  let result = "";
  if (urlObj.protocol) {
    result += urlObj.protocol;
    if (!urlObj.protocol.endsWith(":")) result += ":";
  }
  if (urlObj.slashes || (urlObj.protocol && urlObj.host)) {
    result += "//";
  }
  if (urlObj.auth) {
    result += urlObj.auth + "@";
  }
  if (urlObj.hostname) {
    result += urlObj.hostname;
  } else if (urlObj.host) {
    result += urlObj.host;
  }
  if (urlObj.port && urlObj.hostname) {
    result += ":" + urlObj.port;
  }
  if (urlObj.pathname) {
    result += urlObj.pathname;
  }
  if (urlObj.search) {
    result += urlObj.search.startsWith("?") ? urlObj.search : "?" + urlObj.search;
  } else if (urlObj.query) {
    if (typeof urlObj.query === "string") {
      result += "?" + urlObj.query;
    } else {
      const params = new _URLSearchParams(urlObj.query);
      const qs = params.toString();
      if (qs) result += "?" + qs;
    }
  }
  if (urlObj.hash) {
    result += urlObj.hash.startsWith("#") ? urlObj.hash : "#" + urlObj.hash;
  }
  return result;
}

export function resolve(from: string, to: string): string {
  try {
    return new _URL(to, from).href;
  } catch {
    return to;
  }
}

export function domainToASCII(domain: string): string {
  try {
    const u = new _URL(`http://${domain}`);
    return u.hostname;
  } catch {
    return "";
  }
}

export function domainToUnicode(domain: string): string {
  // In browsers, URL already handles unicode domains
  return domainToASCII(domain);
}

export function fileURLToPath(url: string | URL): string {
  const u = typeof url === "string" ? new _URL(url) : url;
  if (u.protocol !== "file:") throw new TypeError("The URL must be of scheme file");
  return decodeURIComponent(u.pathname);
}

export function pathToFileURL(path: string): URL {
  const encoded = encodeURIComponent(path).replace(/%2F/g, "/");
  return new _URL(`file://${encoded.startsWith("/") ? "" : "/"}${encoded}`);
}

const url = {
  URL: _URL, URLSearchParams: _URLSearchParams,
  parse, format, resolve, domainToASCII, domainToUnicode, fileURLToPath, pathToFileURL,
};

export default url;
