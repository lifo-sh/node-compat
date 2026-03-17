/**
 * Node.js `readline` module shim for Lifo.
 *
 * Provides Interface (createInterface), clearLine, clearScreenDown,
 * cursorTo, moveCursor, and the promises API.
 */

import { EventEmitter } from './events.js';

export interface InterfaceOptions {
  input?: { on?: (event: string, cb: (...args: unknown[]) => void) => void };
  output?: { write?: (data: string) => void };
  prompt?: string;
  terminal?: boolean;
  historySize?: number;
  completer?: (line: string) => [string[], string];
  crlfDelay?: number;
}

export class Interface extends EventEmitter {
  private _prompt: string;
  private _input: InterfaceOptions['input'] | undefined;
  private _output: { write?: (data: string) => void } | undefined;
  private _closed = false;
  private _lines: string[] = [];
  terminal: boolean;
  line = '';
  cursor = 0;

  constructor(opts: InterfaceOptions = {}) {
    super();
    this._prompt = opts.prompt ?? '> ';
    this._input = opts.input;
    this._output = opts.output;
    this.terminal = opts.terminal ?? false;

    // Listen for data on input if provided
    // NOTE: Register this BEFORE emitKeypressEvents so that line/cursor
    // are updated before keypress handlers read them.
    if (opts.input?.on) {
      opts.input.on('data', (chunk) => {
        if (this._closed) return;
        const str = String(chunk);
        if (this.terminal) {
          // In terminal mode, process character by character
          this._processTerminalInput(str);
        } else {
          const lines = str.split(/\r?\n/);
          for (const line of lines) {
            if (line !== '') {
              this._lines.push(line);
              this.emit('line', line);
            }
          }
        }
      });

      opts.input.on('end', () => {
        if (!this._closed) this.close();
      });
    }

    // When terminal mode, emit keypress events on the input stream
    // so that libraries like @clack/prompts can listen for 'keypress' on stdin.
    // This MUST be after the data listener above so line/cursor are updated
    // before keypress handlers read them.
    if (this.terminal && opts.input) {
      emitKeypressEvents(opts.input);
    }
  }

  private _processTerminalInput(str: string): void {
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      const code = ch.charCodeAt(0);

      if (ch === '\r' || ch === '\n') {
        // Enter pressed - emit line
        const line = this.line;
        this._lines.push(line);
        this.line = '';
        this.cursor = 0;
        this.emit('line', line);
      } else if (code === 0x7f || code === 0x08) {
        // Backspace
        if (this.cursor > 0) {
          this.line = this.line.slice(0, this.cursor - 1) + this.line.slice(this.cursor);
          this.cursor--;
        }
      } else if (code === 0x15) {
        // Ctrl+U - clear line before cursor
        this.line = this.line.slice(this.cursor);
        this.cursor = 0;
      } else if (code === 0x0b) {
        // Ctrl+K - clear line after cursor
        this.line = this.line.slice(0, this.cursor);
      } else if (code >= 32) {
        // Regular character
        this.line = this.line.slice(0, this.cursor) + ch + this.line.slice(this.cursor);
        this.cursor++;
      }
    }
  }

  setPrompt(prompt: string): void {
    this._prompt = prompt;
  }

  getPrompt(): string {
    return this._prompt;
  }

  prompt(preserveCursor = false): void {
    if (this._closed) return;
    void preserveCursor;
    this._output?.write?.(this._prompt);
  }

  write(data: string | null, key?: { ctrl?: boolean; meta?: boolean; shift?: boolean; name?: string; sequence?: string }): void {
    if (this._closed) return;

    // Handle write(null, key) form - simulate key press
    if (data === null && key) {
      if (key.ctrl && key.name === 'u') {
        // Ctrl+U: clear line before cursor
        this.line = this.line.slice(this.cursor);
        this.cursor = 0;
      } else if (key.ctrl && key.name === 'h') {
        // Ctrl+H: backspace
        if (this.cursor > 0) {
          this.line = this.line.slice(0, this.cursor - 1) + this.line.slice(this.cursor);
          this.cursor--;
        }
      } else if (key.ctrl && key.name === 'k') {
        // Ctrl+K: clear line after cursor
        this.line = this.line.slice(0, this.cursor);
      } else if (key.ctrl && key.name === 'a') {
        // Ctrl+A: move to beginning
        this.cursor = 0;
      } else if (key.ctrl && key.name === 'e') {
        // Ctrl+E: move to end
        this.cursor = this.line.length;
      } else if (key.name === 'return') {
        const line = this.line;
        this._lines.push(line);
        this.line = '';
        this.cursor = 0;
        this.emit('line', line);
      } else if (key.name === 'backspace') {
        if (this.cursor > 0) {
          this.line = this.line.slice(0, this.cursor - 1) + this.line.slice(this.cursor);
          this.cursor--;
        }
      }
      // Emit keypress on input stream so listeners on stdin can hear it
      if (this._input && typeof (this._input as any).emit === 'function') {
        (this._input as any).emit('keypress', key.sequence ?? '', key);
      }
      return;
    }

    if (typeof data === 'string') {
      // Insert data at cursor position
      for (const ch of data) {
        if (ch === '\r' || ch === '\n') {
          const line = this.line;
          this._lines.push(line);
          this.line = '';
          this.cursor = 0;
          this.emit('line', line);
        } else {
          this.line = this.line.slice(0, this.cursor) + ch + this.line.slice(this.cursor);
          this.cursor++;
        }
      }
    }
  }

  question(query: string, cb: (answer: string) => void): void;
  question(query: string, options: { signal?: AbortSignal }, cb: (answer: string) => void): void;
  question(
    query: string,
    optionsOrCb: { signal?: AbortSignal } | ((answer: string) => void),
    cb?: (answer: string) => void,
  ): void {
    if (this._closed) return;
    const callback = typeof optionsOrCb === 'function' ? optionsOrCb : cb!;
    this._output?.write?.(query);
    // Answer comes from next line event
    this.once('line', (line) => callback(line as string));
  }

  close(): void {
    if (this._closed) return;
    this._closed = true;
    this.emit('close');
  }

  pause(): this {
    this.emit('pause');
    return this;
  }

  resume(): this {
    this.emit('resume');
    return this;
  }

  getCursorPos(): { rows: number; cols: number } {
    return { rows: 0, cols: 0 };
  }

  get closed(): boolean {
    return this._closed;
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<string> {
    const iface = this;
    const queue: string[] = [];
    let resolveNext: ((value: IteratorResult<string>) => void) | null = null;

    iface.on('line', (line) => {
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r({ value: line as string, done: false });
      } else {
        queue.push(line as string);
      }
    });

    iface.on('close', () => {
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r({ value: undefined as unknown as string, done: true });
      }
    });

    return {
      next(): Promise<IteratorResult<string>> {
        if (queue.length > 0) {
          return Promise.resolve({ value: queue.shift()!, done: false });
        }
        if (iface._closed) {
          return Promise.resolve({ value: undefined as unknown as string, done: true });
        }
        return new Promise((resolve) => { resolveNext = resolve; });
      },
      return(): Promise<IteratorResult<string>> {
        iface.close();
        return Promise.resolve({ value: undefined as unknown as string, done: true });
      },
      throw(err: Error): Promise<IteratorResult<string>> {
        iface.close();
        return Promise.reject(err);
      },
      [Symbol.asyncIterator]() { return this; },
    };
  }
}

export function createInterface(opts: InterfaceOptions): Interface;
export function createInterface(
  input: InterfaceOptions['input'],
  output?: InterfaceOptions['output'],
): Interface;
export function createInterface(
  inputOrOpts: InterfaceOptions | InterfaceOptions['input'],
  output?: InterfaceOptions['output'],
): Interface {
  if (inputOrOpts && typeof inputOrOpts === 'object' && ('input' in inputOrOpts || 'output' in inputOrOpts || 'prompt' in inputOrOpts)) {
    return new Interface(inputOrOpts as InterfaceOptions);
  }
  return new Interface({ input: inputOrOpts as InterfaceOptions['input'], output });
}

export function clearLine(stream: { write?: (data: string) => void }, dir: number, cb?: () => void): boolean {
  if (stream?.write) {
    if (dir === -1) stream.write('\x1b[1K');       // clear left
    else if (dir === 1) stream.write('\x1b[0K');   // clear right
    else stream.write('\x1b[2K');                   // clear entire line
  }
  cb?.();
  return true;
}

export function clearScreenDown(stream: { write?: (data: string) => void }, cb?: () => void): boolean {
  if (stream?.write) stream.write('\x1b[0J');
  cb?.();
  return true;
}

export function cursorTo(stream: { write?: (data: string) => void }, x: number, y?: number | (() => void), cb?: () => void): boolean {
  if (stream?.write) {
    if (typeof y === 'number') {
      stream.write(`\x1b[${y + 1};${x + 1}H`);
    } else {
      stream.write(`\x1b[${x + 1}G`);
    }
  }
  if (typeof y === 'function') { y(); return true; }
  cb?.();
  return true;
}

export function moveCursor(stream: { write?: (data: string) => void }, dx: number, dy: number, cb?: () => void): boolean {
  if (stream?.write) {
    if (dx > 0) stream.write(`\x1b[${dx}C`);
    else if (dx < 0) stream.write(`\x1b[${-dx}D`);
    if (dy > 0) stream.write(`\x1b[${dy}B`);
    else if (dy < 0) stream.write(`\x1b[${-dy}A`);
  }
  cb?.();
  return true;
}

export function emitKeypressEvents(stream: any): void {
  if (stream._keypressDecoder) return; // already attached
  stream._keypressDecoder = true;

  const origOn = stream.on?.bind(stream);
  const origEmit = stream.emit?.bind(stream);
  if (!origOn || !origEmit) return;

  // Intercept 'data' events and also emit 'keypress' events
  origOn('data', (data: unknown) => {
    const s = typeof data === 'string' ? data : String(data);
    const keys = parseKeySequences(s);
    for (const key of keys) {
      origEmit('keypress', key.sequence, key);
    }
  });
}

interface KeyInfo {
  sequence: string;
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

function parseKeySequences(input: string): KeyInfo[] {
  const keys: KeyInfo[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (ch === '\x1b') {
      // Escape sequence
      if (i + 1 < input.length && input[i + 1] === '[') {
        // CSI sequence
        let j = i + 2;
        // Read until we find a letter (the final byte)
        while (j < input.length && input.charCodeAt(j) >= 0x20 && input.charCodeAt(j) <= 0x3f) {
          j++;
        }
        if (j < input.length) {
          const seq = input.slice(i, j + 1);
          const final = input[j];
          const params = input.slice(i + 2, j);
          keys.push(parseCSI(seq, final, params));
          i = j + 1;
        } else {
          keys.push({ sequence: '\x1b', name: 'escape', ctrl: false, meta: false, shift: false });
          i++;
        }
      } else if (i + 1 < input.length && input[i + 1] === 'O') {
        // SS3 sequence (e.g., \eOA for up arrow in some terminals)
        if (i + 2 < input.length) {
          const seq = input.slice(i, i + 3);
          const final = input[i + 2];
          keys.push(parseSS3(seq, final));
          i += 3;
        } else {
          keys.push({ sequence: '\x1b', name: 'escape', ctrl: false, meta: false, shift: false });
          i++;
        }
      } else {
        // Alt+key or bare escape
        if (i + 1 < input.length) {
          const next = input[i + 1];
          keys.push({ sequence: '\x1b' + next, name: next.toLowerCase(), ctrl: false, meta: true, shift: next !== next.toLowerCase() });
          i += 2;
        } else {
          keys.push({ sequence: '\x1b', name: 'escape', ctrl: false, meta: false, shift: false });
          i++;
        }
      }
    } else if (ch.charCodeAt(0) < 32) {
      // Control character
      keys.push(parseControlChar(ch));
      i++;
    } else {
      keys.push({ sequence: ch, name: ch.toLowerCase(), ctrl: false, meta: false, shift: ch !== ch.toLowerCase() });
      i++;
    }
  }

  return keys;
}

function parseCSI(seq: string, final: string, params: string): KeyInfo {
  const base = { sequence: seq, ctrl: false, meta: false, shift: false };

  // Parse modifier if present (e.g., \x1b[1;2A = shift+up)
  const parts = params.split(';');
  const modifier = parts.length > 1 ? parseInt(parts[1], 10) : 0;
  if (modifier) {
    base.shift = !!(modifier & 1); // bit 0 is actually modifier-1
    // Modifier encoding: 2=shift, 3=alt, 4=alt+shift, 5=ctrl, etc.
    const m = modifier - 1;
    base.shift = !!(m & 1);
    base.meta = !!(m & 2);
    base.ctrl = !!(m & 4);
  }

  switch (final) {
    case 'A': return { ...base, name: 'up' };
    case 'B': return { ...base, name: 'down' };
    case 'C': return { ...base, name: 'right' };
    case 'D': return { ...base, name: 'left' };
    case 'H': return { ...base, name: 'home' };
    case 'F': return { ...base, name: 'end' };
    case '~': {
      const code = parts[0];
      switch (code) {
        case '1': return { ...base, name: 'home' };
        case '2': return { ...base, name: 'insert' };
        case '3': return { ...base, name: 'delete' };
        case '4': return { ...base, name: 'end' };
        case '5': return { ...base, name: 'pageup' };
        case '6': return { ...base, name: 'pagedown' };
        default: return { ...base, name: 'undefined' };
      }
    }
    default: return { ...base, name: final.toLowerCase() };
  }
}

function parseSS3(seq: string, final: string): KeyInfo {
  const base = { sequence: seq, ctrl: false, meta: false, shift: false };
  switch (final) {
    case 'A': return { ...base, name: 'up' };
    case 'B': return { ...base, name: 'down' };
    case 'C': return { ...base, name: 'right' };
    case 'D': return { ...base, name: 'left' };
    case 'H': return { ...base, name: 'home' };
    case 'F': return { ...base, name: 'end' };
    default: return { ...base, name: final.toLowerCase() };
  }
}

function parseControlChar(ch: string): KeyInfo {
  const code = ch.charCodeAt(0);
  switch (code) {
    case 0x0d: return { sequence: ch, name: 'return', ctrl: false, meta: false, shift: false };
    case 0x0a: return { sequence: ch, name: 'return', ctrl: false, meta: false, shift: false };
    case 0x09: return { sequence: ch, name: 'tab', ctrl: false, meta: false, shift: false };
    case 0x08: return { sequence: ch, name: 'backspace', ctrl: false, meta: false, shift: false };
    case 0x7f: return { sequence: ch, name: 'backspace', ctrl: false, meta: false, shift: false };
    case 0x03: return { sequence: ch, name: 'c', ctrl: true, meta: false, shift: false };
    case 0x04: return { sequence: ch, name: 'd', ctrl: true, meta: false, shift: false };
    default: {
      // Ctrl+A through Ctrl+Z
      const name = String.fromCharCode(code + 96);
      return { sequence: ch, name, ctrl: true, meta: false, shift: false };
    }
  }
}

// readline/promises API
export const promises = {
  createInterface: (opts: InterfaceOptions): Interface & { question: (query: string, options?: { signal?: AbortSignal }) => Promise<string> } => {
    const iface = createInterface(opts);
    const promiseIface = iface as Interface & { question: (query: string, options?: { signal?: AbortSignal }) => Promise<string> };
    const originalQuestion = iface.question.bind(iface);
    promiseIface.question = (query: string, _options?: { signal?: AbortSignal }): Promise<string> => {
      return new Promise((resolve) => {
        originalQuestion(query, (answer: string) => resolve(answer));
      });
    };
    return promiseIface;
  },
};

export default {
  Interface,
  createInterface,
  clearLine,
  clearScreenDown,
  cursorTo,
  moveCursor,
  emitKeypressEvents,
  promises,
};
