const _TextEncoder = globalThis.TextEncoder;
const _TextDecoder = globalThis.TextDecoder;
export { _TextEncoder as TextEncoder, _TextDecoder as TextDecoder };

export function promisify<T>(
  fn: (...args: [...any[], (err: Error | null, result?: T) => void]) => void
): (...args: any[]) => Promise<T> {
  return (...args: any[]) =>
    new Promise<T>((resolve, reject) => {
      fn(...args, (err: Error | null, result?: T) => {
        if (err) reject(err);
        else resolve(result as T);
      });
    });
}

export function callbackify<T>(
  fn: (...args: any[]) => Promise<T>
): (...args: [...any[], (err: Error | null, result?: T) => void]) => void {
  return (...args: any[]) => {
    const cb = args.pop() as (err: Error | null, result?: T) => void;
    fn(...args).then((result) => cb(null, result)).catch((err) => cb(err));
  };
}

export function inherits(
  ctor: Function,
  superCtor: Function
): void {
  Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
  Object.setPrototypeOf(ctor, superCtor);
}

export function deprecate<T extends Function>(fn: T, msg: string, _code?: string): T {
  let warned = false;
  const wrapper = function (this: any, ...args: any[]) {
    if (!warned) {
      console.warn(`DeprecationWarning: ${msg}`);
      warned = true;
    }
    return fn.apply(this, args);
  };
  return wrapper as unknown as T;
}

export function inspect(obj: unknown, options?: { depth?: number | null; colors?: boolean; showHidden?: boolean }): string {
  const depth = options?.depth ?? 2;
  return formatValue(obj, depth);
}

function formatValue(value: unknown, depth: number, seen = new Set<unknown>()): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return `'${value}'`;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "function") return `[Function: ${value.name || "anonymous"}]`;

  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (value instanceof Date) return value.toISOString();
  if (value instanceof RegExp) return value.toString();
  if (value instanceof Error) return `${value.name}: ${value.message}`;

  if (Array.isArray(value)) {
    if (depth < 0) return "[Array]";
    const items = value.map((v) => formatValue(v, depth - 1, seen));
    return `[ ${items.join(", ")} ]`;
  }

  if (value instanceof Map) {
    if (depth < 0) return "Map(...)";
    const entries = [...value.entries()].map(([k, v]) => `${formatValue(k, depth - 1, seen)} => ${formatValue(v, depth - 1, seen)}`);
    return `Map(${value.size}) { ${entries.join(", ")} }`;
  }

  if (value instanceof Set) {
    if (depth < 0) return "Set(...)";
    const items = [...value].map((v) => formatValue(v, depth - 1, seen));
    return `Set(${value.size}) { ${items.join(", ")} }`;
  }

  if (typeof value === "object") {
    if (depth < 0) return "[Object]";
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return "{}";
    const entries = keys.map((k) => `${k}: ${formatValue(obj[k], depth - 1, seen)}`);
    return `{ ${entries.join(", ")} }`;
  }

  return String(value);
}

export function format(fmt: string, ...args: any[]): string {
  let i = 0;
  return fmt.replace(/%[sdjifoO%]/g, (match) => {
    if (match === "%%") return "%";
    if (i >= args.length) return match;
    const arg = args[i++];
    switch (match) {
      case "%s": return String(arg);
      case "%d": case "%i": return Number(arg).toString();
      case "%f": return parseFloat(arg).toString();
      case "%j": return JSON.stringify(arg);
      case "%o": case "%O": return inspect(arg);
      default: return match;
    }
  });
}

export function isDeepStrictEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== "object") return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => isDeepStrictEqual(v, b[i]));
  }

  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp) return a.toString() === b.toString();

  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => isDeepStrictEqual((a as any)[key], (b as any)[key]));
}

const util = {
  TextEncoder: _TextEncoder, TextDecoder: _TextDecoder,
  promisify, callbackify, inherits, deprecate, inspect, format, isDeepStrictEqual,
};

export default util;
