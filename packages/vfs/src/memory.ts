import type { VFSBackend, VFSStat } from "./types.js";
import {
  createENOENT,
  createEEXIST,
  createEISDIR,
  createENOTDIR,
  createENOTEMPTY,
  createELOOP,
  createEINVAL,
} from "./errors.js";

interface FileNode {
  type: "file";
  data: Uint8Array;
  mtimeMs: number;
  ctimeMs: number;
  birthtimeMs: number;
}

interface DirNode {
  type: "directory";
  mtimeMs: number;
  ctimeMs: number;
  birthtimeMs: number;
}

interface SymlinkNode {
  type: "symlink";
  target: string;
  mtimeMs: number;
  ctimeMs: number;
  birthtimeMs: number;
}

type FSNode = FileNode | DirNode | SymlinkNode;

function createStat(node: FSNode): VFSStat {
  return {
    isFile: () => node.type === "file",
    isDirectory: () => node.type === "directory",
    isSymbolicLink: () => node.type === "symlink",
    size: node.type === "file" ? node.data.byteLength : 0,
    mtimeMs: node.mtimeMs,
    ctimeMs: node.ctimeMs,
    birthtimeMs: node.birthtimeMs,
    mtime: new Date(node.mtimeMs),
    ctime: new Date(node.ctimeMs),
    birthtime: new Date(node.birthtimeMs),
  };
}

function normalizePath(p: string): string {
  if (p !== "/" && p.endsWith("/")) {
    p = p.slice(0, -1);
  }
  if (!p.startsWith("/")) {
    p = "/" + p;
  }
  p = p.replace(/\/+/g, "/");
  return p;
}

function parentDir(p: string): string {
  const idx = p.lastIndexOf("/");
  if (idx === 0) return "/";
  return p.slice(0, idx);
}

export class MemoryBackend implements VFSBackend {
  private nodes: Map<string, FSNode> = new Map();

  constructor() {
    const now = Date.now();
    this.nodes.set("/", {
      type: "directory",
      mtimeMs: now,
      ctimeMs: now,
      birthtimeMs: now,
    });
  }

  /** Resolve symlinks in path. Returns the real path. */
  private resolvePathSync(path: string, maxDepth = 32): string {
    path = normalizePath(path);
    const node = this.nodes.get(path);
    if (!node) return path;
    if (node.type === "symlink") {
      if (maxDepth <= 0) throw createELOOP(path, "resolve");
      const target = node.target.startsWith("/")
        ? node.target
        : parentDir(path) + "/" + node.target;
      return this.resolvePathSync(normalizePath(target), maxDepth - 1);
    }
    return path;
  }

  // --- Async methods ---

  async readFile(path: string): Promise<Uint8Array> {
    return this.readFileSync(path);
  }
  async writeFile(path: string, data: Uint8Array): Promise<void> {
    this.writeFileSync(path, data);
  }
  async stat(path: string): Promise<VFSStat> {
    return this.statSync(path);
  }
  async readdir(path: string): Promise<string[]> {
    return this.readdirSync(path);
  }
  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    this.mkdirSync(path, options);
  }
  async unlink(path: string): Promise<void> {
    this.unlinkSync(path);
  }
  async rmdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    this.rmdirSync(path, options);
  }
  async rename(oldPath: string, newPath: string): Promise<void> {
    this.renameSync(oldPath, newPath);
  }
  async exists(path: string): Promise<boolean> {
    return this.existsSync(path);
  }
  async appendFile(path: string, data: Uint8Array): Promise<void> {
    this.appendFileSync(path, data);
  }
  async copyFile(src: string, dest: string): Promise<void> {
    this.copyFileSync(src, dest);
  }
  async truncate(path: string, len?: number): Promise<void> {
    this.truncateSync(path, len);
  }
  async utimes(path: string, atimeMs: number, mtimeMs: number): Promise<void> {
    this.utimesSync(path, atimeMs, mtimeMs);
  }
  async symlink(target: string, path: string): Promise<void> {
    this.symlinkSync(target, path);
  }
  async readlink(path: string): Promise<string> {
    return this.readlinkSync(path);
  }
  async lstat(path: string): Promise<VFSStat> {
    return this.lstatSync(path);
  }

  // --- Sync methods ---

  readFileSync(path: string): Uint8Array {
    path = this.resolvePathSync(normalizePath(path));
    const node = this.nodes.get(path);
    if (!node) throw createENOENT(path, "read");
    if (node.type === "directory") throw createEISDIR(path, "read");
    if (node.type === "symlink") throw createENOENT(path, "read");
    return node.data;
  }

  writeFileSync(path: string, data: Uint8Array): void {
    path = normalizePath(path);
    const resolved = this.resolvePathSync(path);
    const parent = parentDir(resolved);
    const parentNode = this.nodes.get(parent);
    if (!parentNode) throw createENOENT(parent, "write");
    if (parentNode.type !== "directory") throw createENOTDIR(parent, "write");

    const now = Date.now();
    const existing = this.nodes.get(resolved);
    if (existing && existing.type === "directory") {
      throw createEISDIR(resolved, "write");
    }

    this.nodes.set(resolved, {
      type: "file",
      data,
      mtimeMs: now,
      ctimeMs: now,
      birthtimeMs: existing ? existing.birthtimeMs : now,
    });
  }

  statSync(path: string): VFSStat {
    path = this.resolvePathSync(normalizePath(path));
    const node = this.nodes.get(path);
    if (!node) throw createENOENT(path, "stat");
    return createStat(node);
  }

  lstatSync(path: string): VFSStat {
    path = normalizePath(path);
    const node = this.nodes.get(path);
    if (!node) throw createENOENT(path, "lstat");
    return createStat(node);
  }

  readdirSync(path: string): string[] {
    path = this.resolvePathSync(normalizePath(path));
    const node = this.nodes.get(path);
    if (!node) throw createENOENT(path, "readdir");
    if (node.type !== "directory") throw createENOTDIR(path, "readdir");

    const prefix = path === "/" ? "/" : path + "/";
    const entries: string[] = [];
    for (const key of this.nodes.keys()) {
      if (key === path) continue;
      if (key.startsWith(prefix)) {
        const rest = key.slice(prefix.length);
        if (!rest.includes("/")) {
          entries.push(rest);
        }
      }
    }
    return entries.sort();
  }

  mkdirSync(path: string, options?: { recursive?: boolean }): void {
    path = normalizePath(path);

    if (options?.recursive) {
      const parts = path.split("/").filter(Boolean);
      let current = "";
      for (const part of parts) {
        current += "/" + part;
        const existing = this.nodes.get(current);
        if (existing) {
          if (existing.type !== "directory") {
            throw createENOTDIR(current, "mkdir");
          }
          continue;
        }
        const now = Date.now();
        this.nodes.set(current, {
          type: "directory",
          mtimeMs: now,
          ctimeMs: now,
          birthtimeMs: now,
        });
      }
      return;
    }

    const existing = this.nodes.get(path);
    if (existing) throw createEEXIST(path, "mkdir");

    const parent = parentDir(path);
    const parentNode = this.nodes.get(parent);
    if (!parentNode) throw createENOENT(parent, "mkdir");
    if (parentNode.type !== "directory") throw createENOTDIR(parent, "mkdir");

    const now = Date.now();
    this.nodes.set(path, {
      type: "directory",
      mtimeMs: now,
      ctimeMs: now,
      birthtimeMs: now,
    });
  }

  unlinkSync(path: string): void {
    path = normalizePath(path);
    const node = this.nodes.get(path);
    if (!node) throw createENOENT(path, "unlink");
    if (node.type === "directory") throw createEISDIR(path, "unlink");
    this.nodes.delete(path);
  }

  rmdirSync(path: string, options?: { recursive?: boolean }): void {
    path = normalizePath(path);
    const node = this.nodes.get(path);
    if (!node) throw createENOENT(path, "rmdir");
    if (node.type !== "directory") throw createENOTDIR(path, "rmdir");

    const prefix = path === "/" ? "/" : path + "/";
    const children = [...this.nodes.keys()].filter(
      (k) => k !== path && k.startsWith(prefix)
    );

    if (children.length > 0 && !options?.recursive) {
      throw createENOTEMPTY(path, "rmdir");
    }

    for (const child of children) {
      this.nodes.delete(child);
    }
    this.nodes.delete(path);
  }

  renameSync(oldPath: string, newPath: string): void {
    oldPath = normalizePath(oldPath);
    newPath = normalizePath(newPath);

    const node = this.nodes.get(oldPath);
    if (!node) throw createENOENT(oldPath, "rename");

    const newParent = parentDir(newPath);
    const newParentNode = this.nodes.get(newParent);
    if (!newParentNode) throw createENOENT(newParent, "rename");
    if (newParentNode.type !== "directory")
      throw createENOTDIR(newParent, "rename");

    if (node.type === "directory") {
      const oldPrefix = oldPath === "/" ? "/" : oldPath + "/";
      const toMove: [string, FSNode][] = [];
      for (const [key, value] of this.nodes) {
        if (key.startsWith(oldPrefix)) {
          toMove.push([key, value]);
        }
      }
      for (const [key] of toMove) {
        this.nodes.delete(key);
      }
      for (const [key, value] of toMove) {
        const newKey = newPath + key.slice(oldPath.length);
        this.nodes.set(newKey, value);
      }
    }

    this.nodes.delete(oldPath);
    this.nodes.set(newPath, node);
  }

  existsSync(path: string): boolean {
    path = normalizePath(path);
    return this.nodes.has(path);
  }

  appendFileSync(path: string, data: Uint8Array): void {
    path = normalizePath(path);
    const resolved = this.resolvePathSync(path);
    const existing = this.nodes.get(resolved);
    if (existing && existing.type === "file") {
      const combined = new Uint8Array(existing.data.byteLength + data.byteLength);
      combined.set(existing.data);
      combined.set(data, existing.data.byteLength);
      const now = Date.now();
      this.nodes.set(resolved, {
        type: "file",
        data: combined,
        mtimeMs: now,
        ctimeMs: now,
        birthtimeMs: existing.birthtimeMs,
      });
    } else {
      this.writeFileSync(path, data);
    }
  }

  copyFileSync(src: string, dest: string): void {
    const data = this.readFileSync(src);
    this.writeFileSync(dest, new Uint8Array(data));
  }

  truncateSync(path: string, len = 0): void {
    path = this.resolvePathSync(normalizePath(path));
    const node = this.nodes.get(path);
    if (!node) throw createENOENT(path, "truncate");
    if (node.type !== "file") throw createEINVAL(path, "truncate");
    const now = Date.now();
    const newData = new Uint8Array(len);
    newData.set(node.data.slice(0, len));
    this.nodes.set(path, {
      type: "file",
      data: newData,
      mtimeMs: now,
      ctimeMs: now,
      birthtimeMs: node.birthtimeMs,
    });
  }

  utimesSync(path: string, atimeMs: number, mtimeMs: number): void {
    path = this.resolvePathSync(normalizePath(path));
    const node = this.nodes.get(path);
    if (!node) throw createENOENT(path, "utimes");
    node.mtimeMs = mtimeMs;
    node.ctimeMs = Date.now();
  }

  symlinkSync(target: string, path: string): void {
    path = normalizePath(path);
    if (this.nodes.has(path)) throw createEEXIST(path, "symlink");
    const parent = parentDir(path);
    const parentNode = this.nodes.get(parent);
    if (!parentNode) throw createENOENT(parent, "symlink");
    if (parentNode.type !== "directory") throw createENOTDIR(parent, "symlink");
    const now = Date.now();
    this.nodes.set(path, {
      type: "symlink",
      target,
      mtimeMs: now,
      ctimeMs: now,
      birthtimeMs: now,
    });
  }

  readlinkSync(path: string): string {
    path = normalizePath(path);
    const node = this.nodes.get(path);
    if (!node) throw createENOENT(path, "readlink");
    if (node.type !== "symlink") throw createEINVAL(path, "readlink");
    return node.target;
  }
}
