import { EventEmitter } from './events.js';

export class Readable extends EventEmitter {
  private _buffer: string[] = [];
  protected _ended = false;
  readable = true;

  push(chunk: string | null): void {
    if (chunk === null) {
      this._ended = true;
      this.readable = false;
      this.emit('end');
    } else {
      this._buffer.push(chunk);
      this.emit('data', chunk);
    }
  }

  read(): string | null {
    if (this._buffer.length > 0) return this._buffer.shift()!;
    return null;
  }

  pipe<T extends Writable>(dest: T): T {
    this.on('data', (chunk) => dest.write(chunk as string));
    this.on('end', () => dest.end());
    return dest;
  }

  destroy(): this {
    this._ended = true;
    this.readable = false;
    this.emit('close');
    return this;
  }

  setEncoding(_encoding: string): this {
    return this;
  }

  resume(): this {
    return this;
  }

  pause(): this {
    return this;
  }
}

export class Writable extends EventEmitter {
  private _ended = false;
  writable = true;

  write(chunk: string, _encoding?: string, cb?: () => void): boolean {
    if (this._ended) return false;
    this.emit('data', chunk);
    if (cb) cb();
    return true;
  }

  end(chunk?: string): void {
    if (chunk) this.write(chunk);
    this._ended = true;
    this.writable = false;
    this.emit('finish');
    this.emit('close');
  }

  destroy(): this {
    this._ended = true;
    this.writable = false;
    this.emit('close');
    return this;
  }
}

export class Duplex extends Readable {
  writable = true;
  private _writableEnded = false;

  write(chunk: string, _encoding?: string, cb?: () => void): boolean {
    if (this._writableEnded) return false;
    this.emit('data', chunk);
    if (cb) cb();
    return true;
  }

  end(chunk?: string): void {
    if (chunk) this.write(chunk);
    this._writableEnded = true;
    this.writable = false;
    this.emit('finish');
  }
}

export class PassThrough extends Duplex {}

type TransformCallback = (err?: Error | null, data?: unknown) => void;

export class Transform extends Duplex {
  private _transformFn?: (chunk: unknown, encoding: string, cb: TransformCallback) => void;
  private _flushFn?: (cb: TransformCallback) => void;

  constructor(opts?: {
    objectMode?: boolean;
    transform?: (chunk: unknown, encoding: string, cb: TransformCallback) => void;
    flush?: (cb: TransformCallback) => void;
  }) {
    super();
    if (opts?.transform) this._transformFn = opts.transform;
    if (opts?.flush) this._flushFn = opts.flush;
  }

  override write(chunk: string, _encoding?: string, cb?: () => void): boolean {
    if (this._transformFn) {
      this._transformFn(chunk, 'utf8', (err, data) => {
        if (err) { this.emit('error', err); return; }
        if (data != null) this.push(data as string);
        if (cb) cb();
      });
    } else {
      this.push(chunk);
      if (cb) cb();
    }
    return true;
  }

  override end(chunk?: string): void {
    if (chunk) this.write(chunk);
    if (this._flushFn) {
      this._flushFn((err, data) => {
        if (data != null) this.push(data as string);
        this.push(null);
      });
    } else {
      this.push(null);
    }
  }
}

export function pipeline(...args: unknown[]): void {
  const cb = typeof args[args.length - 1] === 'function'
    ? args.pop() as (err: Error | null) => void
    : () => {};
  const streams = args as (Readable | Writable | Transform)[];
  if (streams.length < 2) { cb(new Error('pipeline requires at least 2 streams')); return; }

  let current = streams[0] as Readable;
  for (let i = 1; i < streams.length; i++) {
    current = current.pipe(streams[i] as Writable) as unknown as Readable;
  }

  const last = streams[streams.length - 1];
  last.on('finish', () => cb(null));
  last.on('error', (err: unknown) => cb(err as Error));
}

export default { Readable, Writable, Duplex, PassThrough, Transform, pipeline };
