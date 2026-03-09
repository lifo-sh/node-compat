import { createVFS, MemoryBackend, type VFS, type VFSStat } from "@lifo-sh/vfs";

type Encoding = "utf-8" | "utf8" | "ascii" | "base64" | "hex" | "latin1" | "binary" | "ucs2" | "ucs-2" | "utf16le" | null;

interface ReadFileOptions {
  encoding?: Encoding;
  flag?: string;
}

interface WriteFileOptions {
  encoding?: Encoding;
  flag?: string;
  mode?: number;
}

interface MkdirOptions {
  recursive?: boolean;
  mode?: number;
}

interface RmdirOptions {
  recursive?: boolean;
}

interface RmOptions {
  recursive?: boolean;
  force?: boolean;
}

interface CpOptions {
  recursive?: boolean;
  force?: boolean;
}

interface StatResult {
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
  isBlockDevice(): boolean;
  isCharacterDevice(): boolean;
  isFIFO(): boolean;
  isSocket(): boolean;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
  birthtimeMs: number;
  mtime: Date;
  ctime: Date;
  birthtime: Date;
}

interface StatFsResult {
  type: number;
  bsize: number;
  blocks: number;
  bfree: number;
  bavail: number;
  files: number;
  ffree: number;
}

interface Dirent {
  name: string;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
  isBlockDevice(): boolean;
  isCharacterDevice(): boolean;
  isFIFO(): boolean;
  isSocket(): boolean;
}

interface Dir {
  path: string;
  read(): Promise<Dirent | null>;
  readSync(): Dirent | null;
  close(): Promise<void>;
  closeSync(): void;
  [Symbol.asyncIterator](): AsyncIterableIterator<Dirent>;
}

type Callback<T = void> = (err: Error | null, result?: T) => void;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Default VFS instance
let vfs: VFS = createVFS({ backend: new MemoryBackend() });

let syncPromisesVFS: ((v: VFS) => void) | null = null;

/** Replace the underlying VFS instance */
export function configure(newVfs: VFS): void {
  vfs = newVfs;
  syncPromisesVFS?.(newVfs);
}

/** Get the current VFS instance */
export function getVFS(): VFS {
  return vfs;
}

function toBuffer(data: string | Uint8Array, encoding?: Encoding): Uint8Array {
  if (typeof data === "string") return encoder.encode(data);
  return data;
}

function decodeResult(data: Uint8Array, encoding?: Encoding): string | Uint8Array {
  if (encoding) return decoder.decode(data);
  return data;
}

function wrapStat(s: VFSStat): StatResult {
  return {
    ...s,
    isSymbolicLink: s.isSymbolicLink ?? (() => false),
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
  };
}

function makeDirent(name: string, stat: VFSStat): Dirent {
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

// --- File descriptor table ---
interface FileDescriptor {
  path: string;
  flags: string;
  position: number;
}

let nextFd = 10;
const fdTable = new Map<number, FileDescriptor>();

function toTime(t: number | string | Date): number {
  if (typeof t === "number") return t * 1000;
  if (typeof t === "string") return new Date(t).getTime();
  return t.getTime();
}

// --- Callback-based API ---

export function readFile(
  path: string,
  optionsOrCallback: ReadFileOptions | Encoding | Callback<string | Uint8Array>,
  callback?: Callback<string | Uint8Array>
): void {
  let opts: ReadFileOptions = {};
  let cb: Callback<string | Uint8Array>;
  if (typeof optionsOrCallback === "function") {
    cb = optionsOrCallback;
  } else {
    if (typeof optionsOrCallback === "string") opts = { encoding: optionsOrCallback };
    else if (optionsOrCallback) opts = optionsOrCallback;
    cb = callback!;
  }
  vfs.readFile(path).then((data) => cb(null, decodeResult(data, opts.encoding))).catch((err) => cb(err));
}

export function writeFile(
  path: string,
  data: string | Uint8Array,
  optionsOrCallback: WriteFileOptions | Encoding | Callback,
  callback?: Callback
): void {
  let opts: WriteFileOptions = {};
  let cb: Callback;
  if (typeof optionsOrCallback === "function") {
    cb = optionsOrCallback;
  } else {
    if (typeof optionsOrCallback === "string") opts = { encoding: optionsOrCallback };
    else if (optionsOrCallback) opts = optionsOrCallback;
    cb = callback!;
  }
  vfs.writeFile(path, toBuffer(data, opts.encoding)).then(() => cb(null)).catch((err) => cb(err));
}

export function appendFile(
  path: string,
  data: string | Uint8Array,
  optionsOrCallback: WriteFileOptions | Encoding | Callback,
  callback?: Callback
): void {
  let cb: Callback;
  if (typeof optionsOrCallback === "function") {
    cb = optionsOrCallback;
  } else {
    cb = callback!;
  }
  vfs.appendFile(path, toBuffer(data)).then(() => cb(null)).catch((err) => cb(err));
}

export function copyFile(
  src: string,
  dest: string,
  flagsOrCallback: number | Callback,
  callback?: Callback
): void {
  const cb = typeof flagsOrCallback === "function" ? flagsOrCallback : callback!;
  vfs.copyFile(src, dest).then(() => cb(null)).catch((err) => cb(err));
}

export function readdir(
  path: string,
  optionsOrCallback: object | Callback<string[]>,
  callback?: Callback<string[]>
): void {
  const cb = typeof optionsOrCallback === "function" ? optionsOrCallback : callback!;
  vfs.readdir(path).then((entries) => cb(null, entries)).catch((err) => cb(err));
}

export function mkdir(
  path: string,
  optionsOrCallback: MkdirOptions | number | Callback,
  callback?: Callback
): void {
  let opts: MkdirOptions = {};
  let cb: Callback;
  if (typeof optionsOrCallback === "function") {
    cb = optionsOrCallback;
  } else {
    if (typeof optionsOrCallback === "number") opts = { mode: optionsOrCallback };
    else if (optionsOrCallback) opts = optionsOrCallback;
    cb = callback!;
  }
  vfs.mkdir(path, opts).then(() => cb(null)).catch((err) => cb(err));
}

export function stat(path: string, callback: Callback<StatResult>): void {
  vfs.stat(path).then((s) => callback(null, wrapStat(s))).catch((err) => callback(err));
}

export function lstat(path: string, callback: Callback<StatResult>): void {
  vfs.lstat(path).then((s) => callback(null, wrapStat(s))).catch((err) => callback(err));
}

export function fstat(fd: number, callback: Callback<StatResult>): void {
  const desc = fdTable.get(fd);
  if (!desc) { callback(new Error("EBADF: bad file descriptor")); return; }
  vfs.stat(desc.path).then((s) => callback(null, wrapStat(s))).catch((err) => callback(err));
}

export function unlink(path: string, callback: Callback): void {
  vfs.unlink(path).then(() => callback(null)).catch((err) => callback(err));
}

export function rmdir(
  path: string,
  optionsOrCallback: RmdirOptions | Callback,
  callback?: Callback
): void {
  let opts: RmdirOptions = {};
  let cb: Callback;
  if (typeof optionsOrCallback === "function") {
    cb = optionsOrCallback;
  } else {
    opts = optionsOrCallback;
    cb = callback!;
  }
  vfs.rmdir(path, opts).then(() => cb(null)).catch((err) => cb(err));
}

export function rm(
  path: string,
  optionsOrCallback: RmOptions | Callback,
  callback?: Callback
): void {
  let opts: RmOptions = {};
  let cb: Callback;
  if (typeof optionsOrCallback === "function") {
    cb = optionsOrCallback;
  } else {
    opts = optionsOrCallback;
    cb = callback!;
  }
  (async () => {
    try {
      const s = await vfs.stat(path);
      if (s.isDirectory()) {
        await vfs.rmdir(path, { recursive: opts.recursive });
      } else {
        await vfs.unlink(path);
      }
      cb(null);
    } catch (err: any) {
      if (opts.force && err?.code === "ENOENT") cb(null);
      else cb(err);
    }
  })();
}

export function rename(oldPath: string, newPath: string, callback: Callback): void {
  vfs.rename(oldPath, newPath).then(() => callback(null)).catch((err) => callback(err));
}

export function existsSync(path: string): boolean {
  return vfs.existsSync(path);
}

export function access(path: string, modeOrCallback: number | Callback, callback?: Callback): void {
  const cb = typeof modeOrCallback === "function" ? modeOrCallback : callback!;
  vfs.exists(path).then((exists) => {
    if (exists) cb(null);
    else cb(new Error(`ENOENT: no such file or directory, '${path}'`));
  }).catch((err) => cb(err));
}

export function link(existingPath: string, newPath: string, callback: Callback): void {
  vfs.copyFile(existingPath, newPath).then(() => callback(null)).catch((err) => callback(err));
}

export function symlink(
  target: string,
  path: string,
  typeOrCallback: string | Callback,
  callback?: Callback
): void {
  const cb = typeof typeOrCallback === "function" ? typeOrCallback : callback!;
  vfs.symlink(target, path).then(() => cb(null)).catch((err) => cb(err));
}

export function readlink(
  path: string,
  optionsOrCallback: object | Callback<string>,
  callback?: Callback<string>
): void {
  const cb = typeof optionsOrCallback === "function" ? optionsOrCallback : callback!;
  vfs.readlink(path).then((target) => cb(null, target)).catch((err) => cb(err));
}

export function realpath(
  path: string,
  optionsOrCallback: object | Callback<string>,
  callback?: Callback<string>
): void {
  const cb = typeof optionsOrCallback === "function" ? optionsOrCallback : callback!;
  // For our VFS, realpath is just normalize + exists check
  const normalized = normalizeFsPath(path);
  vfs.exists(normalized).then((exists) => {
    if (exists) cb(null, normalized);
    else cb(new Error(`ENOENT: no such file or directory, '${path}'`));
  }).catch((err) => cb(err));
}

export function mkdtemp(
  prefix: string,
  optionsOrCallback: object | Encoding | Callback<string>,
  callback?: Callback<string>
): void {
  const cb = typeof optionsOrCallback === "function" ? optionsOrCallback : callback!;
  const suffix = Math.random().toString(36).slice(2, 8);
  const dir = prefix + suffix;
  vfs.mkdir(dir).then(() => cb(null, dir)).catch((err) => cb(err));
}

export function truncate(
  path: string,
  lenOrCallback: number | Callback,
  callback?: Callback
): void {
  let len = 0;
  let cb: Callback;
  if (typeof lenOrCallback === "function") {
    cb = lenOrCallback;
  } else {
    len = lenOrCallback;
    cb = callback!;
  }
  vfs.truncate(path, len).then(() => cb(null)).catch((err) => cb(err));
}

export function chmod(path: string, mode: number, callback: Callback): void {
  // VFS does not enforce permissions - no-op
  vfs.exists(path).then((exists) => {
    if (exists) callback(null);
    else callback(new Error(`ENOENT: no such file or directory, '${path}'`));
  }).catch((err) => callback(err));
}

export function chown(path: string, uid: number, gid: number, callback: Callback): void {
  // VFS does not enforce ownership - no-op
  vfs.exists(path).then((exists) => {
    if (exists) callback(null);
    else callback(new Error(`ENOENT: no such file or directory, '${path}'`));
  }).catch((err) => callback(err));
}

export function utimes(path: string, atime: number | string | Date, mtime: number | string | Date, callback: Callback): void {
  vfs.utimes(path, toTime(atime), toTime(mtime)).then(() => callback(null)).catch((err) => callback(err));
}

export function lutimes(path: string, atime: number | string | Date, mtime: number | string | Date, callback: Callback): void {
  // Same as utimes for VFS
  vfs.utimes(path, toTime(atime), toTime(mtime)).then(() => callback(null)).catch((err) => callback(err));
}

export function open(
  path: string,
  flags: string | number,
  modeOrCallback: number | Callback<number>,
  callback?: Callback<number>
): void {
  const cb = typeof modeOrCallback === "function" ? modeOrCallback : callback!;
  const flagStr = typeof flags === "number" ? "r" : flags;
  (async () => {
    try {
      if (flagStr.includes("w") || flagStr.includes("a")) {
        const exists = await vfs.exists(path);
        if (!exists && (flagStr.includes("w") || flagStr.includes("a"))) {
          await vfs.writeFile(path, new Uint8Array(0));
        }
        if (flagStr.includes("w") && exists) {
          await vfs.truncate(path, 0);
        }
      } else {
        const exists = await vfs.exists(path);
        if (!exists) throw new Error(`ENOENT: no such file or directory, '${path}'`);
      }
      const fd = nextFd++;
      fdTable.set(fd, { path, flags: flagStr, position: flagStr.includes("a") ? -1 : 0 });
      cb(null, fd);
    } catch (err: any) {
      cb(err);
    }
  })();
}

export function close(fd: number, callback: Callback): void {
  if (!fdTable.has(fd)) { callback(new Error("EBADF: bad file descriptor")); return; }
  fdTable.delete(fd);
  callback(null);
}

export function read(
  fd: number,
  buffer: Uint8Array,
  offset: number,
  length: number,
  position: number | null,
  callback: Callback<number>
): void {
  const desc = fdTable.get(fd);
  if (!desc) { callback(new Error("EBADF: bad file descriptor")); return; }
  vfs.readFile(desc.path).then((data) => {
    const pos = position !== null ? position : desc.position;
    const bytesRead = Math.min(length, data.byteLength - pos);
    if (bytesRead > 0) {
      buffer.set(data.slice(pos, pos + bytesRead), offset);
      desc.position = pos + bytesRead;
    }
    callback(null, Math.max(0, bytesRead));
  }).catch((err) => callback(err));
}

export function write(
  fd: number,
  buffer: Uint8Array | string,
  offsetOrCallback: number | Callback<number>,
  lengthOrCallback?: number | Callback<number>,
  position?: number | null,
  callback?: Callback<number>
): void {
  const desc = fdTable.get(fd);
  if (!desc) {
    const cb = typeof offsetOrCallback === "function" ? offsetOrCallback : typeof lengthOrCallback === "function" ? lengthOrCallback : callback!;
    cb(new Error("EBADF: bad file descriptor"));
    return;
  }

  let data: Uint8Array;
  let cb: Callback<number>;
  let written: number;

  if (typeof buffer === "string") {
    data = encoder.encode(buffer);
    written = data.byteLength;
    cb = typeof offsetOrCallback === "function" ? offsetOrCallback : callback!;
  } else {
    const off = typeof offsetOrCallback === "number" ? offsetOrCallback : 0;
    const len = typeof lengthOrCallback === "number" ? lengthOrCallback : buffer.byteLength - off;
    data = buffer.slice(off, off + len);
    written = data.byteLength;
    cb = callback!;
  }

  vfs.readFile(desc.path).then((existing) => {
    const pos = position != null ? position : desc.position >= 0 ? desc.position : existing.byteLength;
    const newSize = Math.max(existing.byteLength, pos + data.byteLength);
    const result = new Uint8Array(newSize);
    result.set(existing);
    result.set(data, pos);
    desc.position = pos + data.byteLength;
    return vfs.writeFile(desc.path, result);
  }).then(() => cb(null, written)).catch((err) => cb(err));
}

export function cp(
  src: string,
  dest: string,
  optionsOrCallback: CpOptions | Callback,
  callback?: Callback
): void {
  let opts: CpOptions = {};
  let cb: Callback;
  if (typeof optionsOrCallback === "function") {
    cb = optionsOrCallback;
  } else {
    opts = optionsOrCallback;
    cb = callback!;
  }
  (async function copyRecursive(s: string, d: string) {
    const st = await vfs.stat(s);
    if (st.isDirectory()) {
      if (!opts.recursive) throw new Error(`EISDIR: illegal operation on a directory, '${s}'`);
      try { await vfs.mkdir(d); } catch {}
      const entries = await vfs.readdir(s);
      for (const entry of entries) {
        await copyRecursive(s + "/" + entry, d + "/" + entry);
      }
    } else {
      await vfs.copyFile(s, d);
    }
  })(src, dest).then(() => cb(null)).catch((err) => cb(err));
}

export function statfs(
  path: string,
  optionsOrCallback: object | Callback<StatFsResult>,
  callback?: Callback<StatFsResult>
): void {
  const cb = typeof optionsOrCallback === "function" ? optionsOrCallback : callback!;
  vfs.exists(path).then((exists) => {
    if (!exists) { cb(new Error(`ENOENT: no such file or directory, '${path}'`)); return; }
    cb(null, { type: 0x4d44, bsize: 4096, blocks: 1000000, bfree: 500000, bavail: 500000, files: 100000, ffree: 50000 });
  }).catch((err) => cb(err));
}

export function opendir(
  path: string,
  optionsOrCallback: object | Callback<Dir>,
  callback?: Callback<Dir>
): void {
  const cb = typeof optionsOrCallback === "function" ? optionsOrCallback : callback!;
  vfs.readdir(path).then((entries) => {
    let index = 0;
    const dirPath = path;
    const dir: Dir = {
      path: dirPath,
      async read() {
        if (index >= entries.length) return null;
        const name = entries[index++];
        const st = await vfs.stat(dirPath + "/" + name);
        return makeDirent(name, st);
      },
      readSync() {
        if (index >= entries.length) return null;
        const name = entries[index++];
        const st = vfs.statSync(dirPath + "/" + name);
        return makeDirent(name, st);
      },
      async close() {},
      closeSync() {},
      async *[Symbol.asyncIterator]() {
        let entry;
        while ((entry = await this.read()) !== null) {
          yield entry;
        }
      },
    };
    cb(null, dir);
  }).catch((err) => cb(err));
}

export function glob(
  pattern: string,
  optionsOrCallback: object | Callback<string[]>,
  callback?: Callback<string[]>
): void {
  const cb = typeof optionsOrCallback === "function" ? optionsOrCallback : callback!;
  const regex = globToRegex(pattern);

  (async function walk(dir: string): Promise<string[]> {
    const results: string[] = [];
    const entries = await vfs.readdir(dir);
    for (const entry of entries) {
      const fullPath = dir === "/" ? "/" + entry : dir + "/" + entry;
      if (regex.test(fullPath)) results.push(fullPath);
      const st = await vfs.stat(fullPath);
      if (st.isDirectory()) {
        results.push(...await walk(fullPath));
      }
    }
    return results;
  })("/").then((results) => cb(null, results)).catch((err) => cb(err));
}

export function unwatchFile(
  path: string,
  _listener?: (curr: StatResult, prev: StatResult) => void
): void {
  // VFS watchers are closed via handle.close(), this is a no-op stub
}

// --- Sync API ---

export function readFileSync(path: string, options?: ReadFileOptions | Encoding): string | Uint8Array {
  const opts: ReadFileOptions = typeof options === "string" ? { encoding: options } : options || {};
  return decodeResult(vfs.readFileSync(path), opts.encoding);
}

export function writeFileSync(path: string, data: string | Uint8Array, options?: WriteFileOptions | Encoding): void {
  const opts: WriteFileOptions = typeof options === "string" ? { encoding: options } : options || {};
  vfs.writeFileSync(path, toBuffer(data, opts.encoding));
}

export function appendFileSync(path: string, data: string | Uint8Array, options?: WriteFileOptions | Encoding): void {
  vfs.appendFileSync(path, toBuffer(data));
}

export function copyFileSync(src: string, dest: string, _mode?: number): void {
  vfs.copyFileSync(src, dest);
}

export function readdirSync(path: string): string[] {
  return vfs.readdirSync(path);
}

export function mkdirSync(path: string, options?: MkdirOptions | number): void {
  const opts: MkdirOptions = typeof options === "number" ? { mode: options } : options || {};
  vfs.mkdirSync(path, opts);
}

export function statSync(path: string): StatResult {
  return wrapStat(vfs.statSync(path));
}

export function lstatSync(path: string): StatResult {
  return wrapStat(vfs.lstatSync(path));
}

export function fstatSync(fd: number): StatResult {
  const desc = fdTable.get(fd);
  if (!desc) throw new Error("EBADF: bad file descriptor");
  return wrapStat(vfs.statSync(desc.path));
}

export function unlinkSync(path: string): void {
  vfs.unlinkSync(path);
}

export function rmdirSync(path: string, options?: RmdirOptions): void {
  vfs.rmdirSync(path, options);
}

export function rmSync(path: string, options?: RmOptions): void {
  try {
    const s = vfs.statSync(path);
    if (s.isDirectory()) {
      vfs.rmdirSync(path, { recursive: options?.recursive });
    } else {
      vfs.unlinkSync(path);
    }
  } catch (err: any) {
    if (options?.force && err?.code === "ENOENT") return;
    throw err;
  }
}

export function renameSync(oldPath: string, newPath: string): void {
  vfs.renameSync(oldPath, newPath);
}

export function linkSync(existingPath: string, newPath: string): void {
  vfs.copyFileSync(existingPath, newPath);
}

export function symlinkSync(target: string, path: string, _type?: string): void {
  vfs.symlinkSync(target, path);
}

export function readlinkSync(path: string, _options?: object): string {
  return vfs.readlinkSync(path);
}

export function realpathSync(path: string, _options?: object): string {
  const normalized = normalizeFsPath(path);
  if (!vfs.existsSync(normalized)) {
    throw new Error(`ENOENT: no such file or directory, '${path}'`);
  }
  return normalized;
}

export function mkdtempSync(prefix: string, _options?: object | Encoding): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  const dir = prefix + suffix;
  vfs.mkdirSync(dir);
  return dir;
}

export function truncateSync(path: string, len = 0): void {
  vfs.truncateSync(path, len);
}

export function chmodSync(path: string, _mode: number): void {
  if (!vfs.existsSync(path)) throw new Error(`ENOENT: no such file or directory, '${path}'`);
}

export function chownSync(path: string, _uid: number, _gid: number): void {
  if (!vfs.existsSync(path)) throw new Error(`ENOENT: no such file or directory, '${path}'`);
}

export function utimesSync(path: string, atime: number | string | Date, mtime: number | string | Date): void {
  vfs.utimesSync(path, toTime(atime), toTime(mtime));
}

export function lutimesSync(path: string, atime: number | string | Date, mtime: number | string | Date): void {
  vfs.utimesSync(path, toTime(atime), toTime(mtime));
}

export function openSync(path: string, flags: string | number = "r", _mode?: number): number {
  const flagStr = typeof flags === "number" ? "r" : flags;
  if (flagStr.includes("w") || flagStr.includes("a")) {
    if (!vfs.existsSync(path)) {
      vfs.writeFileSync(path, new Uint8Array(0));
    }
    if (flagStr.includes("w") && vfs.existsSync(path)) {
      vfs.truncateSync(path, 0);
    }
  } else {
    if (!vfs.existsSync(path)) throw new Error(`ENOENT: no such file or directory, '${path}'`);
  }
  const fd = nextFd++;
  fdTable.set(fd, { path, flags: flagStr, position: flagStr.includes("a") ? -1 : 0 });
  return fd;
}

export function closeSync(fd: number): void {
  if (!fdTable.has(fd)) throw new Error("EBADF: bad file descriptor");
  fdTable.delete(fd);
}

export function readSync(fd: number, buffer: Uint8Array, offset: number, length: number, position: number | null): number {
  const desc = fdTable.get(fd);
  if (!desc) throw new Error("EBADF: bad file descriptor");
  const data = vfs.readFileSync(desc.path);
  const pos = position !== null ? position : desc.position;
  const bytesRead = Math.min(length, data.byteLength - pos);
  if (bytesRead > 0) {
    buffer.set(data.slice(pos, pos + bytesRead), offset);
    desc.position = pos + bytesRead;
  }
  return Math.max(0, bytesRead);
}

export function writeSync(fd: number, buffer: Uint8Array | string, offset?: number, length?: number, position?: number | null): number {
  const desc = fdTable.get(fd);
  if (!desc) throw new Error("EBADF: bad file descriptor");

  let data: Uint8Array;
  if (typeof buffer === "string") {
    data = encoder.encode(buffer);
  } else {
    const off = offset ?? 0;
    const len = length ?? buffer.byteLength - off;
    data = buffer.slice(off, off + len);
  }

  const existing = vfs.readFileSync(desc.path);
  const pos = position != null ? position : desc.position >= 0 ? desc.position : existing.byteLength;
  const newSize = Math.max(existing.byteLength, pos + data.byteLength);
  const result = new Uint8Array(newSize);
  result.set(existing);
  result.set(data, pos);
  desc.position = pos + data.byteLength;
  vfs.writeFileSync(desc.path, result);
  return data.byteLength;
}

export function cpSync(src: string, dest: string, options?: CpOptions): void {
  const s = vfs.statSync(src);
  if (s.isDirectory()) {
    if (!options?.recursive) throw new Error(`EISDIR: illegal operation on a directory, '${src}'`);
    try { vfs.mkdirSync(dest); } catch {}
    const entries = vfs.readdirSync(src);
    for (const entry of entries) {
      cpSync(src + "/" + entry, dest + "/" + entry, options);
    }
  } else {
    vfs.copyFileSync(src, dest);
  }
}

export function opendirSync(path: string, _options?: object): Dir {
  const entries = vfs.readdirSync(path);
  let index = 0;
  const dirPath = path;
  return {
    path: dirPath,
    async read() {
      if (index >= entries.length) return null;
      const name = entries[index++];
      const st = await vfs.stat(dirPath + "/" + name);
      return makeDirent(name, st);
    },
    readSync() {
      if (index >= entries.length) return null;
      const name = entries[index++];
      const st = vfs.statSync(dirPath + "/" + name);
      return makeDirent(name, st);
    },
    async close() {},
    closeSync() {},
    async *[Symbol.asyncIterator]() {
      let entry;
      while ((entry = await this.read()) !== null) {
        yield entry;
      }
    },
  };
}

export function globSync(pattern: string, _options?: object): string[] {
  const regex = globToRegex(pattern);
  const results: string[] = [];
  function walk(dir: string) {
    const entries = vfs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = dir === "/" ? "/" + entry : dir + "/" + entry;
      if (regex.test(fullPath)) results.push(fullPath);
      try {
        const st = vfs.statSync(fullPath);
        if (st.isDirectory()) walk(fullPath);
      } catch {}
    }
  }
  walk("/");
  return results;
}

export function statfsSync(_path: string, _options?: object): StatFsResult {
  return { type: 0x4d44, bsize: 4096, blocks: 1000000, bfree: 500000, bavail: 500000, files: 100000, ffree: 50000 };
}

// --- Streams ---

interface ReadStream {
  on(event: string, cb: Function): ReadStream;
  pipe(dest: any): any;
  destroy(): void;
}

interface WriteStream {
  write(chunk: string | Uint8Array): boolean;
  end(chunk?: string | Uint8Array): void;
  on(event: string, cb: Function): WriteStream;
  destroy(): void;
}

export function createReadStream(path: string, options?: { encoding?: string } | string): ReadStream {
  const enc = typeof options === "string" ? options : options?.encoding;
  const events: Record<string, Function[]> = {};
  const stream: ReadStream = {
    on(event: string, cb: Function) { (events[event] ??= []).push(cb); return stream; },
    pipe(dest: any) {
      stream.on("data", (chunk: any) => dest.write(chunk));
      stream.on("end", () => { if (dest.end) dest.end(); });
      return dest;
    },
    destroy() {},
  };
  Promise.resolve().then(async () => {
    try {
      const data = await vfs.readFile(path);
      const result = enc ? decoder.decode(data) : data;
      events.data?.forEach((cb) => cb(result));
      events.end?.forEach((cb) => cb());
    } catch (err) {
      events.error?.forEach((cb) => cb(err));
    }
  });
  return stream;
}

export function createWriteStream(path: string, _options?: object | string): WriteStream {
  const chunks: Uint8Array[] = [];
  const events: Record<string, Function[]> = {};
  const stream: WriteStream = {
    write(chunk: string | Uint8Array) {
      chunks.push(toBuffer(chunk)); return true;
    },
    end(chunk?: string | Uint8Array) {
      if (chunk) chunks.push(toBuffer(chunk));
      const total = chunks.reduce((s, c) => s + c.byteLength, 0);
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) { merged.set(c, offset); offset += c.byteLength; }
      vfs.writeFile(path, merged).then(() => {
        events.finish?.forEach((cb) => cb());
      }).catch((err) => {
        events.error?.forEach((cb) => cb(err));
      });
    },
    on(event: string, cb: Function) { (events[event] ??= []).push(cb); return stream; },
    destroy() {},
  };
  return stream;
}

// --- Watch ---

export function watch(
  path: string,
  optionsOrListener?: object | ((eventType: string, filename: string) => void),
  listener?: (eventType: string, filename: string) => void
): { close(): void } {
  const cb = typeof optionsOrListener === "function" ? optionsOrListener : listener;
  if (!cb) throw new Error("watch requires a listener");
  return vfs.watch(path, (event) => {
    const eventType = event.type === "rename" ? "rename" : "change";
    const filename = event.path.split("/").pop() || "";
    cb(eventType, filename);
  });
}

export function watchFile(
  path: string,
  optionsOrListener?: object | ((curr: StatResult, prev: StatResult) => void),
  listener?: (curr: StatResult, prev: StatResult) => void
): { close(): void } {
  const cb = typeof optionsOrListener === "function" ? optionsOrListener : listener;
  if (!cb) throw new Error("watchFile requires a listener");
  let prevStat: StatResult | null = null;
  try { prevStat = wrapStat(vfs.statSync(path)); } catch {}
  return vfs.watchFile(path, () => {
    let currStat: StatResult;
    try {
      currStat = wrapStat(vfs.statSync(path));
    } catch {
      currStat = wrapStat({
        isFile: () => false, isDirectory: () => false, isSymbolicLink: () => false,
        size: 0, mtimeMs: 0, ctimeMs: 0, birthtimeMs: 0,
        mtime: new Date(0), ctime: new Date(0), birthtime: new Date(0),
      });
    }
    const prev = prevStat || currStat;
    cb(currStat, prev);
    prevStat = currStat;
  });
}

// --- Helpers ---

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
      regex += ".*";
      i += pattern[i + 2] === "/" ? 3 : 2;
    } else if (c === "*") {
      regex += "[^/]*";
      i++;
    } else if (c === "?") {
      regex += "[^/]";
      i++;
    } else if (".+^${}()|[]\\".includes(c)) {
      regex += "\\" + c;
      i++;
    } else {
      regex += c;
      i++;
    }
  }
  return new RegExp("^" + regex + "$");
}

// --- Promises namespace (re-export) ---
export { default as promises } from "./fs/promises.js";

// Default export
const fs = {
  configure, getVFS,
  readFile, writeFile, appendFile, copyFile, readdir, mkdir, stat, lstat, fstat,
  unlink, rmdir, rm, rename, existsSync, access,
  link, symlink, readlink, realpath, mkdtemp, truncate,
  chmod, chown, utimes, lutimes,
  open, close, read, write, cp, statfs, opendir, glob, unwatchFile,
  readFileSync, writeFileSync, appendFileSync, copyFileSync,
  readdirSync, mkdirSync, statSync, lstatSync, fstatSync,
  unlinkSync, rmdirSync, rmSync, renameSync,
  linkSync, symlinkSync, readlinkSync, realpathSync,
  mkdtempSync, truncateSync, chmodSync, chownSync,
  utimesSync, lutimesSync,
  openSync, closeSync, readSync, writeSync,
  cpSync, opendirSync, globSync, statfsSync,
  createReadStream, createWriteStream,
  watch, watchFile,
  promises: undefined as any,
};

// Lazy-load promises to avoid circular issues
import fsPromises, { _setVFS } from "./fs/promises.js";
fs.promises = fsPromises;
_setVFS(vfs);
syncPromisesVFS = _setVFS;

export default fs;
