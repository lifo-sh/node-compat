import { MemoryBackend } from "./memory.js";
import { VFSEventEmitter } from "./watcher.js";
import type {
  VFS,
  VFSBackend,
  VFSWatchListener,
  VFSWatchHandle,
  VFSWatchEvent,
  CreateVFSOptions,
} from "./types.js";

export type {
  VFS,
  VFSBackend,
  VFSStat,
  VFSWatchEvent,
  VFSWatchListener,
  VFSWatchHandle,
  CreateVFSOptions,
} from "./types.js";
export { VFSError, createENOENT, createEEXIST, createEISDIR, createENOTDIR, createENOTEMPTY, createELOOP, createEINVAL, createEBADF } from "./errors.js";
export { MemoryBackend } from "./memory.js";
export { VFSEventEmitter } from "./watcher.js";

export function createVFS(options?: CreateVFSOptions): VFS {
  const backend = options?.backend ?? new MemoryBackend();
  const emitter = new VFSEventEmitter();

  function emitEvent(type: VFSWatchEvent["type"], path: string, newPath?: string) {
    emitter.emit({ type, path, newPath });
  }

  return {
    // --- Async ---
    async readFile(path: string) {
      return backend.readFile(path);
    },
    async writeFile(path: string, data: Uint8Array) {
      const existed = await backend.exists(path);
      await backend.writeFile(path, data);
      emitEvent(existed ? "change" : "create", path);
    },
    async stat(path: string) {
      return backend.stat(path);
    },
    async readdir(path: string) {
      return backend.readdir(path);
    },
    async mkdir(path: string, options?: { recursive?: boolean }) {
      await backend.mkdir(path, options);
      emitEvent("create", path);
    },
    async unlink(path: string) {
      await backend.unlink(path);
      emitEvent("delete", path);
    },
    async rmdir(path: string, options?: { recursive?: boolean }) {
      await backend.rmdir(path, options);
      emitEvent("delete", path);
    },
    async rename(oldPath: string, newPath: string) {
      await backend.rename(oldPath, newPath);
      emitEvent("rename", oldPath, newPath);
    },
    async exists(path: string) {
      return backend.exists(path);
    },
    async appendFile(path: string, data: Uint8Array) {
      await backend.appendFile(path, data);
      emitEvent("change", path);
    },
    async copyFile(src: string, dest: string) {
      const existed = await backend.exists(dest);
      await backend.copyFile(src, dest);
      emitEvent(existed ? "change" : "create", dest);
    },
    async truncate(path: string, len?: number) {
      await backend.truncate(path, len);
      emitEvent("change", path);
    },
    async utimes(path: string, atimeMs: number, mtimeMs: number) {
      await backend.utimes(path, atimeMs, mtimeMs);
      emitEvent("change", path);
    },
    async symlink(target: string, path: string) {
      await backend.symlink(target, path);
      emitEvent("create", path);
    },
    async readlink(path: string) {
      return backend.readlink(path);
    },
    async lstat(path: string) {
      return backend.lstat(path);
    },

    // --- Sync ---
    readFileSync(path: string) {
      return backend.readFileSync(path);
    },
    writeFileSync(path: string, data: Uint8Array) {
      const existed = backend.existsSync(path);
      backend.writeFileSync(path, data);
      emitEvent(existed ? "change" : "create", path);
    },
    statSync(path: string) {
      return backend.statSync(path);
    },
    readdirSync(path: string) {
      return backend.readdirSync(path);
    },
    mkdirSync(path: string, options?: { recursive?: boolean }) {
      backend.mkdirSync(path, options);
      emitEvent("create", path);
    },
    unlinkSync(path: string) {
      backend.unlinkSync(path);
      emitEvent("delete", path);
    },
    rmdirSync(path: string, options?: { recursive?: boolean }) {
      backend.rmdirSync(path, options);
      emitEvent("delete", path);
    },
    renameSync(oldPath: string, newPath: string) {
      backend.renameSync(oldPath, newPath);
      emitEvent("rename", oldPath, newPath);
    },
    existsSync(path: string) {
      return backend.existsSync(path);
    },
    appendFileSync(path: string, data: Uint8Array) {
      backend.appendFileSync(path, data);
      emitEvent("change", path);
    },
    copyFileSync(src: string, dest: string) {
      const existed = backend.existsSync(dest);
      backend.copyFileSync(src, dest);
      emitEvent(existed ? "change" : "create", dest);
    },
    truncateSync(path: string, len?: number) {
      backend.truncateSync(path, len);
      emitEvent("change", path);
    },
    utimesSync(path: string, atimeMs: number, mtimeMs: number) {
      backend.utimesSync(path, atimeMs, mtimeMs);
      emitEvent("change", path);
    },
    symlinkSync(target: string, path: string) {
      backend.symlinkSync(target, path);
      emitEvent("create", path);
    },
    readlinkSync(path: string) {
      return backend.readlinkSync(path);
    },
    lstatSync(path: string) {
      return backend.lstatSync(path);
    },

    // --- Watchers ---
    watch(path: string, listener: VFSWatchListener): VFSWatchHandle {
      return emitter.watch(path, listener);
    },
    watchFile(path: string, listener: VFSWatchListener): VFSWatchHandle {
      return emitter.watchFile(path, listener);
    },
  };
}
