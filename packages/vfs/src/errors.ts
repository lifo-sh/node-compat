export class VFSError extends Error {
  code: string;
  path?: string;
  syscall?: string;

  constructor(
    code: string,
    message: string,
    path?: string,
    syscall?: string
  ) {
    super(`${code}: ${message}${path ? `, '${path}'` : ""}`);
    this.name = "VFSError";
    this.code = code;
    this.path = path;
    this.syscall = syscall;
  }
}

export function createENOENT(path: string, syscall?: string): VFSError {
  return new VFSError("ENOENT", "no such file or directory", path, syscall);
}

export function createEEXIST(path: string, syscall?: string): VFSError {
  return new VFSError("EEXIST", "file already exists", path, syscall);
}

export function createEISDIR(path: string, syscall?: string): VFSError {
  return new VFSError("EISDIR", "illegal operation on a directory", path, syscall);
}

export function createENOTDIR(path: string, syscall?: string): VFSError {
  return new VFSError("ENOTDIR", "not a directory", path, syscall);
}

export function createENOTEMPTY(path: string, syscall?: string): VFSError {
  return new VFSError("ENOTEMPTY", "directory not empty", path, syscall);
}

export function createELOOP(path: string, syscall?: string): VFSError {
  return new VFSError("ELOOP", "too many levels of symbolic links", path, syscall);
}

export function createEINVAL(path: string, syscall?: string): VFSError {
  return new VFSError("EINVAL", "invalid argument", path, syscall);
}

export function createEBADF(syscall?: string): VFSError {
  return new VFSError("EBADF", "bad file descriptor", undefined, syscall);
}
