import { EventEmitter } from "./events.js";

export class Readable extends EventEmitter {
  private _buffer: any[] = [];
  private _flowing: boolean = false;
  private _ended: boolean = false;
  private _readableState = { objectMode: false, highWaterMark: 16384 };
  readable: boolean = true;
  readableEnded: boolean = false;
  readableFlowing: boolean | null = null;

  constructor(options?: { objectMode?: boolean; highWaterMark?: number; read?: (this: Readable, size: number) => void }) {
    super();
    if (options?.objectMode) this._readableState.objectMode = true;
    if (options?.highWaterMark !== undefined) this._readableState.highWaterMark = options.highWaterMark;
    if (options?.read) this._read = options.read.bind(this);
  }

  _read(_size: number): void {
    // subclasses override
  }

  push(chunk: any): boolean {
    if (chunk === null) {
      this._ended = true;
      this.readableEnded = true;
      this.readable = false;
      if (this._flowing) {
        this.emit("end");
      }
      return false;
    }
    this._buffer.push(chunk);
    if (this._flowing) {
      this._drain();
    }
    return this._buffer.length < this._readableState.highWaterMark;
  }

  read(size?: number): any {
    if (this._buffer.length === 0) return null;
    if (this._readableState.objectMode || size === undefined) {
      return this._buffer.shift();
    }
    // For buffer mode, concatenate and slice
    const chunk = this._buffer.shift();
    return chunk;
  }

  private _drain(): void {
    while (this._buffer.length > 0) {
      const chunk = this._buffer.shift();
      this.emit("data", chunk);
    }
    if (this._ended) {
      this.emit("end");
    }
  }

  resume(): this {
    this._flowing = true;
    this.readableFlowing = true;
    if (this._buffer.length === 0 && !this._ended) {
      this._read(this._readableState.highWaterMark);
    }
    this._drain();
    return this;
  }

  pause(): this {
    this._flowing = false;
    this.readableFlowing = false;
    return this;
  }

  pipe<T extends Writable>(destination: T): T {
    this.on("data", (chunk: any) => {
      const canContinue = destination.write(chunk);
      if (!canContinue) {
        this.pause();
        destination.once("drain", () => this.resume());
      }
    });
    this.on("end", () => {
      destination.end();
    });
    this.resume();
    return destination;
  }

  unpipe(destination?: Writable): this {
    this.removeAllListeners("data");
    this.removeAllListeners("end");
    if (destination) {
      // noop beyond removing listeners
    }
    return this;
  }

  destroy(error?: Error): this {
    this._buffer = [];
    this._ended = true;
    this.readable = false;
    if (error) this.emit("error", error);
    this.emit("close");
    return this;
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<any> {
    const stream = this;
    const buffer: any[] = [];
    let resolve: ((value: IteratorResult<any>) => void) | null = null;
    let done = false;

    stream.on("data", (chunk: any) => {
      if (resolve) {
        const r = resolve;
        resolve = null;
        r({ value: chunk, done: false });
      } else {
        buffer.push(chunk);
      }
    });

    stream.on("end", () => {
      done = true;
      if (resolve) {
        const r = resolve;
        resolve = null;
        r({ value: undefined, done: true });
      }
    });

    stream.resume();

    return {
      next(): Promise<IteratorResult<any>> {
        if (buffer.length > 0) {
          return Promise.resolve({ value: buffer.shift(), done: false });
        }
        if (done) {
          return Promise.resolve({ value: undefined, done: true });
        }
        return new Promise((r) => { resolve = r; });
      },
      return(): Promise<IteratorResult<any>> {
        stream.destroy();
        return Promise.resolve({ value: undefined, done: true });
      },
      [Symbol.asyncIterator]() { return this; },
    };
  }
}

export class Writable extends EventEmitter {
  private _writableState = { objectMode: false, highWaterMark: 16384 };
  private _chunks: any[] = [];
  private _ended: boolean = false;
  writable: boolean = true;
  writableEnded: boolean = false;
  writableFinished: boolean = false;

  constructor(options?: { objectMode?: boolean; highWaterMark?: number; write?: (chunk: any, encoding: string, callback: (error?: Error | null) => void) => void; final?: (callback: (error?: Error | null) => void) => void }) {
    super();
    if (options?.objectMode) this._writableState.objectMode = true;
    if (options?.highWaterMark !== undefined) this._writableState.highWaterMark = options.highWaterMark;
    if (options?.write) this._write = options.write.bind(this);
    if (options?.final) this._final = options.final.bind(this);
  }

  _write(chunk: any, _encoding: string, callback: (error?: Error | null) => void): void {
    this._chunks.push(chunk);
    callback();
  }

  _final(callback: (error?: Error | null) => void): void {
    callback();
  }

  write(chunk: any, encodingOrCb?: string | ((error?: Error | null) => void), cb?: (error?: Error | null) => void): boolean {
    const encoding = typeof encodingOrCb === "string" ? encodingOrCb : "utf-8";
    const callback = typeof encodingOrCb === "function" ? encodingOrCb : cb ?? (() => {});
    if (this._ended) {
      const err = new Error("write after end");
      callback(err);
      this.emit("error", err);
      return false;
    }
    this._write(chunk, encoding, (err) => {
      if (err) {
        callback(err);
        this.emit("error", err);
      } else {
        callback();
        this.emit("drain");
      }
    });
    return true;
  }

  end(chunkOrCb?: any, encodingOrCb?: string | (() => void), cb?: () => void): this {
    const chunk = typeof chunkOrCb === "function" ? undefined : chunkOrCb;
    const callback = typeof chunkOrCb === "function" ? chunkOrCb : typeof encodingOrCb === "function" ? encodingOrCb : cb;

    if (chunk !== undefined) {
      this.write(chunk);
    }
    this._ended = true;
    this.writable = false;
    this.writableEnded = true;
    this._final((err) => {
      if (err) {
        this.emit("error", err);
      } else {
        this.writableFinished = true;
        this.emit("finish");
        this.emit("close");
        if (callback) callback();
      }
    });
    return this;
  }

  destroy(error?: Error): this {
    this._ended = true;
    this.writable = false;
    if (error) this.emit("error", error);
    this.emit("close");
    return this;
  }
}

export class Duplex extends Readable {
  private _writable: Writable;
  writable: boolean = true;
  writableEnded: boolean = false;
  writableFinished: boolean = false;

  constructor(options?: { objectMode?: boolean; read?: (size: number) => void; write?: (chunk: any, encoding: string, callback: (error?: Error | null) => void) => void; final?: (callback: (error?: Error | null) => void) => void }) {
    super(options);
    this._writable = new Writable({
      objectMode: options?.objectMode,
      write: options?.write,
      final: options?.final,
    });
    this._writable.on("finish", () => {
      this.writableFinished = true;
      this.emit("finish");
    });
    this._writable.on("drain", () => this.emit("drain"));
  }

  write(chunk: any, encodingOrCb?: string | ((error?: Error | null) => void), cb?: (error?: Error | null) => void): boolean {
    return this._writable.write(chunk, encodingOrCb as any, cb);
  }

  end(chunkOrCb?: any, encodingOrCb?: string | (() => void), cb?: () => void): this {
    this._writable.end(chunkOrCb, encodingOrCb as any, cb);
    this.writableEnded = true;
    this.writable = false;
    return this;
  }
}

export class Transform extends Duplex {
  private _transformCallback: ((chunk: any, encoding: string, callback: (error?: Error | null, data?: any) => void) => void) | null = null;
  private _flushCallback: ((callback: (error?: Error | null, data?: any) => void) => void) | null = null;

  constructor(options?: { objectMode?: boolean; transform?: (chunk: any, encoding: string, callback: (error?: Error | null, data?: any) => void) => void; flush?: (callback: (error?: Error | null, data?: any) => void) => void }) {
    super({
      objectMode: options?.objectMode,
      write: (chunk: any, encoding: string, cb: (error?: Error | null) => void) => {
        this._transform(chunk, encoding, (err, data) => {
          if (data !== undefined) this.push(data);
          cb(err);
        });
      },
      final: (cb: (error?: Error | null) => void) => {
        this._flush((err, data) => {
          if (data !== undefined) this.push(data);
          this.push(null);
          cb(err);
        });
      },
    });
    if (options?.transform) this._transformCallback = options.transform.bind(this);
    if (options?.flush) this._flushCallback = options.flush.bind(this);
  }

  _transform(chunk: any, encoding: string, callback: (error?: Error | null, data?: any) => void): void {
    if (this._transformCallback) {
      this._transformCallback(chunk, encoding, callback);
    } else {
      callback(null, chunk);
    }
  }

  _flush(callback: (error?: Error | null, data?: any) => void): void {
    if (this._flushCallback) {
      this._flushCallback(callback);
    } else {
      callback();
    }
  }
}

export class PassThrough extends Transform {
  constructor(options?: { objectMode?: boolean }) {
    super({
      ...options,
      transform(chunk: any, _encoding: string, callback: (error?: Error | null, data?: any) => void) {
        callback(null, chunk);
      },
    });
  }
}

export function pipeline(...args: any[]): any {
  const callback = typeof args[args.length - 1] === "function" ? args.pop() as (err?: Error | null) => void : undefined;
  const streams = args as (Readable | Writable | Transform)[];

  if (streams.length < 2) {
    const err = new Error("pipeline requires at least 2 streams");
    if (callback) callback(err);
    return;
  }

  let error: Error | null = null;
  let finished = false;

  const last = streams[streams.length - 1] as Writable;
  last.on("error", (err: Error) => { error = err; });
  last.on("finish", () => {
    if (!finished) { finished = true; if (callback) callback(error); }
  });

  for (let i = 0; i < streams.length - 1; i++) {
    const source = streams[i] as Readable;
    const dest = streams[i + 1] as Writable;

    source.on("error", (err: Error) => {
      error = err;
      dest.destroy(err);
    });

    if (typeof source.pipe === "function") {
      source.pipe(dest as any);
    }
  }

  return last;
}

export const finished = (stream: Readable | Writable, callback: (err?: Error | null) => void): void => {
  if ("writable" in stream && stream instanceof Writable) {
    stream.on("finish", () => callback());
    stream.on("error", (err: Error) => callback(err));
  } else {
    (stream as Readable).on("end", () => callback());
    (stream as Readable).on("error", (err: Error) => callback(err));
  }
};

const stream = {
  Readable, Writable, Duplex, Transform, PassThrough, pipeline, finished,
};

export default stream;
