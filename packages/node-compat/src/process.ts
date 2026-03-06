interface ProcessLike {
  env: Record<string, string | undefined>;
  argv: string[];
  argv0: string;
  platform: string;
  arch: string;
  version: string;
  versions: Record<string, string>;
  pid: number;
  ppid: number;
  title: string;
  execPath: string;
  stdout: { write(s: string): boolean };
  stderr: { write(s: string): boolean };
  cwd(): string;
  chdir(dir: string): void;
  nextTick(callback: (...args: any[]) => void, ...args: any[]): void;
  exit(code?: number): void;
  hrtime(time?: [number, number]): [number, number];
  memoryUsage(): { rss: number; heapTotal: number; heapUsed: number; external: number; arrayBuffers: number };
  uptime(): number;
  emitWarning(warning: string | Error, type?: string): void;
  on(event: string, listener: Function): ProcessLike;
  off(event: string, listener: Function): ProcessLike;
  once(event: string, listener: Function): ProcessLike;
  removeListener(event: string, listener: Function): ProcessLike;
  emit(event: string, ...args: any[]): boolean;
}

const process: ProcessLike = {
  env: {} as Record<string, string | undefined>,
  argv: ["node", "script.js"],
  argv0: "node",
  platform: "browser" as string,
  arch: "wasm" as string,
  version: "v20.0.0",
  versions: {} as Record<string, string>,
  pid: 1,
  ppid: 0,
  title: "browser",
  execPath: "/usr/bin/node",
  stdout: { write(s: string) { console.log(s); return true; } },
  stderr: { write(s: string) { console.error(s); return true; } },

  cwd(): string {
    return "/";
  },

  chdir(_dir: string): void {
    // no-op in browser
  },

  nextTick(callback: (...args: any[]) => void, ...args: any[]): void {
    queueMicrotask(() => callback(...args));
  },

  exit(_code?: number): void {
    throw new Error(`process.exit(${_code ?? 0}) called`);
  },

  hrtime(time?: [number, number]): [number, number] {
    const now = performance.now();
    const seconds = Math.floor(now / 1000);
    const nanoseconds = Math.floor((now % 1000) * 1e6);
    if (time) {
      let diffSec = seconds - time[0];
      let diffNs = nanoseconds - time[1];
      if (diffNs < 0) { diffSec--; diffNs += 1e9; }
      return [diffSec, diffNs];
    }
    return [seconds, nanoseconds];
  },

  memoryUsage() {
    return { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 };
  },

  uptime(): number {
    return performance.now() / 1000;
  },

  emitWarning(warning: string | Error, _type?: string): void {
    console.warn(typeof warning === "string" ? warning : warning.message);
  },

  on(_event: string, _listener: Function): typeof process {
    return process;
  },

  off(_event: string, _listener: Function): typeof process {
    return process;
  },

  once(_event: string, _listener: Function): typeof process {
    return process;
  },

  removeListener(_event: string, _listener: Function): typeof process {
    return process;
  },

  emit(_event: string, ..._args: any[]): boolean {
    return false;
  },
};

export const env = process.env;
export const argv = process.argv;
export const platform = process.platform;
export const arch = process.arch;
export const version = process.version;
export const pid = process.pid;

export function cwd() { return process.cwd(); }
export function chdir(dir: string) { process.chdir(dir); }
export function nextTick(callback: (...args: any[]) => void, ...args: any[]) { process.nextTick(callback, ...args); }
export function exit(code?: number) { process.exit(code); }
export function hrtime(time?: [number, number]) { return process.hrtime(time); }
export function uptime() { return process.uptime(); }

export default process;
