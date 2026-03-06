export interface VFSStat {
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
  birthtimeMs: number;
  mtime: Date;
  ctime: Date;
  birthtime: Date;
}

export interface VFSWatchEvent {
  type: "create" | "change" | "rename" | "delete";
  path: string;
  /** Only present for rename events */
  newPath?: string;
}

export type VFSWatchListener = (event: VFSWatchEvent) => void;

export interface VFSBackend {
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  stat(path: string): Promise<VFSStat>;
  readdir(path: string): Promise<string[]>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  unlink(path: string): Promise<void>;
  rmdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  appendFile(path: string, data: Uint8Array): Promise<void>;
  copyFile(src: string, dest: string): Promise<void>;
  truncate(path: string, len?: number): Promise<void>;
  utimes(path: string, atimeMs: number, mtimeMs: number): Promise<void>;
  symlink(target: string, path: string): Promise<void>;
  readlink(path: string): Promise<string>;
  lstat(path: string): Promise<VFSStat>;

  // Sync variants
  readFileSync(path: string): Uint8Array;
  writeFileSync(path: string, data: Uint8Array): void;
  statSync(path: string): VFSStat;
  readdirSync(path: string): string[];
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  unlinkSync(path: string): void;
  rmdirSync(path: string, options?: { recursive?: boolean }): void;
  renameSync(oldPath: string, newPath: string): void;
  existsSync(path: string): boolean;
  appendFileSync(path: string, data: Uint8Array): void;
  copyFileSync(src: string, dest: string): void;
  truncateSync(path: string, len?: number): void;
  utimesSync(path: string, atimeMs: number, mtimeMs: number): void;
  symlinkSync(target: string, path: string): void;
  readlinkSync(path: string): string;
  lstatSync(path: string): VFSStat;
}

export interface VFS extends VFSBackend {
  watch(path: string, listener: VFSWatchListener): VFSWatchHandle;
  watchFile(path: string, listener: VFSWatchListener): VFSWatchHandle;
}

export interface VFSWatchHandle {
  close(): void;
}

export interface CreateVFSOptions {
  backend?: VFSBackend;
}
