import { EventEmitter } from './events.js';
import type { IKernelProcessAPI, ChildProcessHandle } from '@lifo-sh/kernel/types';

export const ACTIVE_CHILD_PROCESSES = Symbol.for('lifo:activeChildProcesses');

type ExecuteCapture = (input: string) => Promise<string>;

/**
 * Node.js child_process compatibility layer.
 * When a kernel process API is available, spawn/fork/exec delegate to kernel syscalls.
 * Falls back to executeCapture for basic spawn/exec support.
 */
export function createChildProcess(executeCapture?: ExecuteCapture, processAPI?: IKernelProcessAPI) {

  // Track active child processes so the node command can wait for them
  const activeChildren: EventEmitter[] = [];

  function exec(
    cmd: string,
    optionsOrCb?: Record<string, unknown> | ((err: Error | null, stdout: string, stderr: string) => void),
    cb?: (err: Error | null, stdout: string, stderr: string) => void,
  ): EventEmitter {
    const callback = typeof optionsOrCb === 'function' ? optionsOrCb : cb;
    const options = typeof optionsOrCb === 'object' ? optionsOrCb : undefined;
    const child = new EventEmitter();

    // Prefer kernel syscall if available
    if (processAPI) {
      queueMicrotask(async () => {
        try {
          const result = await processAPI.exec(cmd, {
            cwd: options?.cwd as string | undefined,
            env: options?.env as Record<string, string> | undefined,
          });
          if (callback) callback(
            result.exitCode === 0 ? null : Object.assign(new Error(`Command failed: ${cmd}`), { code: result.exitCode }),
            result.stdout,
            result.stderr,
          );
          child.emit('close', result.exitCode);
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          if (callback) callback(err, '', err.message);
          child.emit('close', 1);
        }
      });
      return child;
    }

    // Fallback to executeCapture
    if (!executeCapture) {
      queueMicrotask(() => {
        const err = new Error('child_process.exec() requires shell interpreter');
        if (callback) callback(err, '', '');
        child.emit('error', err);
      });
      return child;
    }

    const run = executeCapture;
    queueMicrotask(async () => {
      try {
        const output = await run(cmd);
        if (callback) callback(null, output, '');
        child.emit('close', 0);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        if (callback) callback(err, '', err.message);
        child.emit('close', 1);
      }
    });

    return child;
  }

  function execSync(_cmd: string, _options?: Record<string, unknown>): never {
    throw new Error('child_process.execSync() is not supported in Lifo (async-only environment)');
  }

  /**
   * Create a ChildProcess-like EventEmitter with stdout/stderr as EventEmitters.
   * Used by both the kernel-backed path and the executeCapture fallback.
   */
  function makeChildEmitter() {
    const child = new EventEmitter() as EventEmitter & {
      pid: number;
      stdin: { write: (data: string) => void; end: () => void } | null;
      stdout: EventEmitter;
      stderr: EventEmitter;
      exitCode: number | null;
      killed: boolean;
      kill: (signal?: string) => boolean;
    };
    child.pid = -1;
    child.exitCode = null;
    child.killed = false;
    child.stdin = null;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => false;
    return child;
  }

  /**
   * spawn() — delegates to kernel's spawn syscall (fork+exec).
   * Falls back to executeCapture when kernel process API is not available
   * (e.g. running inside a worker thread).
   */
  function spawn(command: string, argsOrOpts?: string[] | Record<string, unknown>, maybeOpts?: Record<string, unknown>): EventEmitter {
    const args = Array.isArray(argsOrOpts) ? argsOrOpts : [];
    const options = Array.isArray(argsOrOpts) ? maybeOpts : argsOrOpts;

    // ── Kernel syscall path (main thread with full kernel) ──
    if (processAPI) {
      const handle: ChildProcessHandle = processAPI.spawn(command, args, {
        cwd: options?.cwd as string | undefined,
        env: options?.env as Record<string, string> | undefined,
        stdio: options?.stdio === 'inherit' ? 'inherit' : 'pipe',
      });

      const child = makeChildEmitter();
      child.pid = handle.pid;

      // Wrap stdin
      child.stdin = handle.stdin ? {
        write: (data: string) => handle.stdin!.write(data),
        end: () => {},
      } : null;

      // Bridge kernel stdout/stderr streams to child EventEmitters
      if (handle.stdout) {
        handle.stdout.on('data', (chunk: string) => child.stdout.emit('data', chunk));
        handle.stdout.on('end', () => child.stdout.emit('end'));
      }
      if (handle.stderr) {
        handle.stderr.on('data', (chunk: string) => child.stderr.emit('data', chunk));
        handle.stderr.on('end', () => child.stderr.emit('end'));
      }

      child.kill = (signal?: string) => {
        child.killed = true;
        return handle.kill(signal);
      };

      handle.on('exit', (code: number) => {
        child.exitCode = code;
        const idx = activeChildren.indexOf(child);
        if (idx >= 0) activeChildren.splice(idx, 1);
        child.emit('exit', code, null);
        child.emit('close', code, null);
      });

      handle.on('error', (err: Error) => {
        child.emit('error', err);
      });

      activeChildren.push(child);
      return child;
    }

    // ── Fallback path: use executeCapture to run the command as a shell string ──
    if (executeCapture) {
      const child = makeChildEmitter();
      const fullCmd = [command, ...args].join(' ');

      queueMicrotask(async () => {
        try {
          const output = await executeCapture(fullCmd);
          child.stdout.emit('data', output);
          child.stdout.emit('end');
          child.stderr.emit('end');
          child.exitCode = 0;
          child.emit('exit', 0, null);
          child.emit('close', 0, null);
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          child.stderr.emit('data', err.message);
          child.stdout.emit('end');
          child.stderr.emit('end');
          child.exitCode = 1;
          child.emit('exit', 1, null);
          child.emit('close', 1, null);
        }
      });

      return child;
    }

    // ── No backend available ──
    const child = makeChildEmitter();
    queueMicrotask(() => {
      child.emit('error', new Error('child_process.spawn() requires kernel process API or shell interpreter'));
    });
    return child;
  }

  function spawnSync(_cmd: string, _args?: string[], _options?: Record<string, unknown>): never {
    throw new Error('child_process.spawnSync() is not supported in Lifo (async-only environment)');
  }

  /**
   * fork() — spawn a Node.js module as a child process.
   * In Lifo, this delegates to spawn('node', [modulePath, ...args]).
   */
  function fork(modulePath: string, argsOrOpts?: string[] | Record<string, unknown>, maybeOpts?: Record<string, unknown>): EventEmitter {
    const args = Array.isArray(argsOrOpts) ? argsOrOpts : [];
    const options = Array.isArray(argsOrOpts) ? maybeOpts : argsOrOpts;

    return spawn('node', [modulePath, ...args], options);
  }

  const mod: Record<string | symbol, unknown> = { exec, execSync, spawn, spawnSync, fork };
  mod[ACTIVE_CHILD_PROCESSES] = activeChildren;
  return mod;
}
