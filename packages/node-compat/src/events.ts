export class EventEmitter {
  static defaultMaxListeners = 10;

  private _events: Map<string | symbol, Function[]> = new Map();
  private _maxListeners: number = EventEmitter.defaultMaxListeners;

  on(event: string | symbol, listener: Function): this {
    const listeners = this._events.get(event) ?? [];
    listeners.push(listener);
    this._events.set(event, listeners);
    return this;
  }

  addListener(event: string | symbol, listener: Function): this {
    return this.on(event, listener);
  }

  prependListener(event: string | symbol, listener: Function): this {
    const listeners = this._events.get(event) ?? [];
    listeners.unshift(listener);
    this._events.set(event, listeners);
    return this;
  }

  once(event: string | symbol, listener: Function): this {
    const wrapper = (...args: any[]) => {
      this.off(event, wrapper);
      listener.apply(this, args);
    };
    (wrapper as any)._original = listener;
    return this.on(event, wrapper);
  }

  prependOnceListener(event: string | symbol, listener: Function): this {
    const wrapper = (...args: any[]) => {
      this.off(event, wrapper);
      listener.apply(this, args);
    };
    (wrapper as any)._original = listener;
    return this.prependListener(event, wrapper);
  }

  off(event: string | symbol, listener: Function): this {
    const listeners = this._events.get(event);
    if (!listeners) return this;
    const idx = listeners.findIndex(
      (l) => l === listener || (l as any)._original === listener
    );
    if (idx !== -1) listeners.splice(idx, 1);
    if (listeners.length === 0) this._events.delete(event);
    return this;
  }

  removeListener(event: string | symbol, listener: Function): this {
    return this.off(event, listener);
  }

  removeAllListeners(event?: string | symbol): this {
    if (event !== undefined) {
      this._events.delete(event);
    } else {
      this._events.clear();
    }
    return this;
  }

  emit(event: string | symbol, ...args: any[]): boolean {
    const listeners = this._events.get(event);
    if (!listeners || listeners.length === 0) return false;
    for (const listener of [...listeners]) {
      listener.apply(this, args);
    }
    return true;
  }

  listeners(event: string | symbol): Function[] {
    return [...(this._events.get(event) ?? [])];
  }

  rawListeners(event: string | symbol): Function[] {
    return [...(this._events.get(event) ?? [])];
  }

  listenerCount(event: string | symbol): number {
    return this._events.get(event)?.length ?? 0;
  }

  eventNames(): (string | symbol)[] {
    return [...this._events.keys()];
  }

  setMaxListeners(n: number): this {
    this._maxListeners = n;
    return this;
  }

  getMaxListeners(): number {
    return this._maxListeners;
  }
}

export function once(emitter: EventEmitter, event: string | symbol): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error) => {
      emitter.off(event, onEvent);
      reject(err);
    };
    const onEvent = (...args: any[]) => {
      emitter.off("error", onError);
      resolve(args);
    };
    emitter.once(event, onEvent);
    if (event !== "error") {
      emitter.once("error", onError);
    }
  });
}

export async function* on(emitter: EventEmitter, event: string | symbol): AsyncIterableIterator<any[]> {
  const queue: any[][] = [];
  let resolve: (() => void) | null = null;
  let done = false;

  const listener = (...args: any[]) => {
    queue.push(args);
    if (resolve) { resolve(); resolve = null; }
  };

  const errorListener = (err: Error) => {
    done = true;
    if (resolve) { resolve(); resolve = null; }
    throw err;
  };

  emitter.on(event, listener);
  if (event !== "error") emitter.on("error", errorListener);

  try {
    while (!done) {
      if (queue.length > 0) {
        yield queue.shift()!;
      } else {
        await new Promise<void>((r) => { resolve = r; });
      }
    }
  } finally {
    emitter.off(event, listener);
    if (event !== "error") emitter.off("error", errorListener);
  }
}

const events = { EventEmitter, once, on };
export default events;
