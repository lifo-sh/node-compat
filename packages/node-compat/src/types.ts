// Re-export canonical types from @lifo-sh/kernel
export type {
  ICommandOutputStream as CommandOutputStream,
  VirtualRequest,
  VirtualResponse,
  VirtualRequestHandler,
  IKernelProcessAPI,
  ChildProcessHandle,
  ReadableStreamHandle,
  SpawnSyscallOptions,
  ExecSyscallOptions,
} from '@lifo-sh/kernel/types';
