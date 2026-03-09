import { createVFS, MemoryBackend, type VFS, type VFSStat } from "@lifo-sh/vfs";

type Encoding = "utf-8" | "utf8" | "ascii" | "base64" | "hex" | "latin1" | "binary" | "ucs2" | "ucs-2" | "utf16le" | null;

interface ReadFileOptions { encoding?: Encoding; flag?: string; }
interface WriteFileOptions { encoding?: Encoding; flag?: string; mode?: number; }
interface MkdirOptions { recursive?: boolean; mode?: number; }
interface RmdirOptions { recursive?: boolean; }
interface RmOptions { recursive?: boolean; force?: boolean; }
interface CpOptions { recursive?: boolean; force?: boolean; }

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let vfsRef: VFS | null = null;

function getVFS(): VFS {
  if (vfsRef) return vfsRef;
  vfsRef = createVFS({ backend: new MemoryBackend() });
  return vfsRef;
}

/** @internal Used by fs.ts to sync the VFS instance */
export function _setVFS(v: VFS): void {
  vfsRef = v;
}

function toBuffer(data: string | Uint8Array, encoding?: Encoding): Uint8Array {
  if (typeof data === "string") return encoder.encode(data);
  return data;
}

function decodeResult(data: Uint8Array, encoding?: Encoding): string | Uint8Array {
  if (encoding) return decoder.decode(data);
  return data;
}

function wrapStat(s: VFSStat) {
  return {
    ...s,
    isSymbolicLink: s.isSymbolicLink ?? (() => false),
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
  };
}

function makeDirent(name: string, stat: VFSStat) {
  return {
    name,
    isFile: () => stat.isFile(),
    isDirectory: () => stat.isDirectory(),
    isSymbolicLink: () => stat.isSymbolicLink(),
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
  };
}

function toTime(t: number | string | Date): number {
  if (typeof t === "number") return t * 1000;
  if (typeof t === "string") return new Date(t).getTime();
  return t.getTime();
}

function normalizeFsPath(p: string): string {
  if (!p.startsWith("/")) p = "/" + p;
  const parts = p.split("/");
  const result: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") { result.pop(); }
    else result.push(part);
  }
  return "/" + result.join("/");
}

function globToRegex(pattern: string): RegExp {
  let regex = "";
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === "*" && pattern[i + 1] === "*") {
      regex += ".*"; i += pattern[i + 2] === "/" ? 3 : 2;
    } else if (c === "*") { regex += "[^/]*"; i++; }
    else if (c === "?") { regex += "[^/]"; i++; }
    else if (".+^${}()|[]\\".includes(c)) { regex += "\\" + c; i++; }
    else { regex += c; i++; }
  }
  return new RegExp("^" + regex + "$");
}

export async function readFile(path: string, options?: ReadFileOptions | Encoding): Promise<string | Uint8Array> {
  const opts: ReadFileOptions = typeof options === "string" ? { encoding: options } : options || {};
  return decodeResult(await getVFS().readFile(path), opts.encoding);
}

export async function writeFile(path: string, data: string | Uint8Array, options?: WriteFileOptions | Encoding): Promise<void> {
  const opts: WriteFileOptions = typeof options === "string" ? { encoding: options } : options || {};
  await getVFS().writeFile(path, toBuffer(data, opts.encoding));
}

export async function appendFile(path: string, data: string | Uint8Array, options?: WriteFileOptions | Encoding): Promise<void> {
  await getVFS().appendFile(path, toBuffer(data));
}

export async function copyFile(src: string, dest: string, _mode?: number): Promise<void> {
  await getVFS().copyFile(src, dest);
}

export async function readdir(path: string): Promise<string[]> {
  return getVFS().readdir(path);
}

export async function mkdir(path: string, options?: MkdirOptions | number): Promise<void> {
  const opts: MkdirOptions = typeof options === "number" ? { mode: options } : options || {};
  await getVFS().mkdir(path, opts);
}

export async function stat(path: string) {
  return wrapStat(await getVFS().stat(path));
}

export async function lstat(path: string) {
  return wrapStat(await getVFS().lstat(path));
}

export async function unlink(path: string): Promise<void> {
  await getVFS().unlink(path);
}

export async function rmdir(path: string, options?: RmdirOptions): Promise<void> {
  await getVFS().rmdir(path, options);
}

export async function rm(path: string, options?: RmOptions): Promise<void> {
  try {
    const s = await getVFS().stat(path);
    if (s.isDirectory()) {
      await getVFS().rmdir(path, { recursive: options?.recursive });
    } else {
      await getVFS().unlink(path);
    }
  } catch (err: any) {
    if (options?.force && err?.code === "ENOENT") return;
    throw err;
  }
}

export async function rename(oldPath: string, newPath: string): Promise<void> {
  await getVFS().rename(oldPath, newPath);
}

export async function access(path: string): Promise<void> {
  const exists = await getVFS().exists(path);
  if (!exists) throw new Error(`ENOENT: no such file or directory, '${path}'`);
}

export async function link(existingPath: string, newPath: string): Promise<void> {
  await getVFS().copyFile(existingPath, newPath);
}

export async function symlink(target: string, path: string, _type?: string): Promise<void> {
  await getVFS().symlink(target, path);
}

export async function readlink(path: string, _options?: object): Promise<string> {
  return getVFS().readlink(path);
}

export async function realpath(path: string, _options?: object): Promise<string> {
  const normalized = normalizeFsPath(path);
  const exists = await getVFS().exists(normalized);
  if (!exists) throw new Error(`ENOENT: no such file or directory, '${path}'`);
  return normalized;
}

export async function mkdtemp(prefix: string, _options?: object | Encoding): Promise<string> {
  const suffix = Math.random().toString(36).slice(2, 8);
  const dir = prefix + suffix;
  await getVFS().mkdir(dir);
  return dir;
}

export async function truncate(path: string, len = 0): Promise<void> {
  await getVFS().truncate(path, len);
}

export async function chmod(path: string, _mode: number): Promise<void> {
  const exists = await getVFS().exists(path);
  if (!exists) throw new Error(`ENOENT: no such file or directory, '${path}'`);
}

export async function chown(path: string, _uid: number, _gid: number): Promise<void> {
  const exists = await getVFS().exists(path);
  if (!exists) throw new Error(`ENOENT: no such file or directory, '${path}'`);
}

export async function utimes(path: string, atime: number | string | Date, mtime: number | string | Date): Promise<void> {
  await getVFS().utimes(path, toTime(atime), toTime(mtime));
}

export async function lutimes(path: string, atime: number | string | Date, mtime: number | string | Date): Promise<void> {
  await getVFS().utimes(path, toTime(atime), toTime(mtime));
}

export async function cp(src: string, dest: string, options?: CpOptions): Promise<void> {
  const s = await getVFS().stat(src);
  if (s.isDirectory()) {
    if (!options?.recursive) throw new Error(`EISDIR: illegal operation on a directory, '${src}'`);
    try { await getVFS().mkdir(dest); } catch {}
    const entries = await getVFS().readdir(src);
    for (const entry of entries) {
      await cp(src + "/" + entry, dest + "/" + entry, options);
    }
  } else {
    await getVFS().copyFile(src, dest);
  }
}

export async function opendir(path: string, _options?: object) {
  const entries = await getVFS().readdir(path);
  let index = 0;
  const dirPath = path;
  return {
    path: dirPath,
    async read() {
      if (index >= entries.length) return null;
      const name = entries[index++];
      const st = await getVFS().stat(dirPath + "/" + name);
      return makeDirent(name, st);
    },
    async close() {},
    async *[Symbol.asyncIterator]() {
      let entry;
      while ((entry = await this.read()) !== null) yield entry;
    },
  };
}

export async function glob(pattern: string, _options?: object): Promise<string[]> {
  const regex = globToRegex(pattern);
  const results: string[] = [];
  async function walk(dir: string) {
    const entries = await getVFS().readdir(dir);
    for (const entry of entries) {
      const fullPath = dir === "/" ? "/" + entry : dir + "/" + entry;
      if (regex.test(fullPath)) results.push(fullPath);
      const st = await getVFS().stat(fullPath);
      if (st.isDirectory()) await walk(fullPath);
    }
  }
  await walk("/");
  return results;
}

export async function statfs(path: string, _options?: object) {
  const exists = await getVFS().exists(path);
  if (!exists) throw new Error(`ENOENT: no such file or directory, '${path}'`);
  return { type: 0x4d44, bsize: 4096, blocks: 1000000, bfree: 500000, bavail: 500000, files: 100000, ffree: 50000 };
}

const fsPromises = {
  readFile, writeFile, appendFile, copyFile,
  readdir, mkdir, stat, lstat, unlink, rmdir, rm, rename, access,
  link, symlink, readlink, realpath, mkdtemp, truncate,
  chmod, chown, utimes, lutimes, cp, opendir, glob, statfs,
};

export default fsPromises;
