# node-compat

Node.js API compatibility layer for the browser, powered by a Virtual File System.

Use familiar Node.js APIs -- `fs`, `path`, `events`, `buffer`, `crypto`, and more -- in browser environments, with zero native dependencies.

## Features

- **14 Node.js modules** polyfilled for browser use
- **Virtual File System** with swappable backends (in-memory, IndexedDB planned)
- **Full `fs` module** with callbacks, sync, and promise APIs (50+ functions)
- **Web Crypto API** backed `crypto` module (SHA hashing, HMAC, randomBytes, randomUUID)
- **Stream primitives** (Readable, Writable, Transform, Duplex, pipeline)
- **94 tests** running in both Node.js and real Chromium via Playwright
- **Dual format** builds (ESM + CJS) with full TypeScript declarations
- **Tree-shakeable** -- import only the modules you need

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| `@lifo-sh/vfs` | [`packages/vfs`](./packages/vfs) | Standalone Virtual File System with swappable backends |
| `@lifo-sh/node-compat` | [`packages/node-compat`](./packages/node-compat) | Node.js API compatibility layer |
| `stories` | [`packages/stories`](./packages/stories) | Shared test stories with assertions |
| `vite-react-app` | [`packages/vite-react-app`](./packages/vite-react-app) | Browser playground with dashboard UI (Tailwind + shadcn) |
| `cli-app` | [`packages/cli-app`](./packages/cli-app) | CLI playground with interactive menu |

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run the browser playground
pnpm dev:vite

# Run tests
pnpm test:node      # Node.js
pnpm test:browser   # Real Chromium via Playwright
```

## Modules

### `@lifo-sh/node-compat/fs`

Full `fs` module with callback, sync, and promise APIs backed by the Virtual File System.

```js
import fs from "@lifo-sh/node-compat/fs";

fs.mkdirSync("/app/data", { recursive: true });
fs.writeFileSync("/app/data/config.json", '{"port": 3000}', "utf-8");

const config = fs.readFileSync("/app/data/config.json", "utf-8");
console.log(config); // '{"port": 3000}'
```

**Supported APIs:** readFile, writeFile, appendFile, copyFile, cp, rm, readdir, mkdir, stat, lstat, fstat, unlink, rmdir, rename, existsSync, access, chmod, chown, link, symlink, readlink, realpath, mkdtemp, truncate, utimes, lutimes, open, close, read, write, opendir, glob, statfs, watch, watchFile, unwatchFile, createReadStream, createWriteStream -- plus all sync variants and `fs.promises`.

### `@lifo-sh/node-compat/fs/promises`

```js
import fs from "@lifo-sh/node-compat/fs/promises";

await fs.writeFile("/hello.txt", "Hello!", "utf-8");
const data = await fs.readFile("/hello.txt", "utf-8");
```

### `@lifo-sh/node-compat/path`

Pure path manipulation -- no VFS dependency.

```js
import path from "@lifo-sh/node-compat/path";

path.join("/home", "user", "docs");       // "/home/user/docs"
path.resolve("/a", "b", "../c");           // "/a/c"
path.parse("/home/user/file.txt");         // { root: "/", dir: "/home/user", ... }
path.relative("/a/b/c", "/a/d");           // "../../d"
```

**Supported APIs:** join, resolve, normalize, isAbsolute, dirname, basename, extname, parse, format, relative, toNamespacedPath, sep, delimiter, posix, win32.

### `@lifo-sh/node-compat/events`

Full EventEmitter implementation.

```js
import { EventEmitter } from "@lifo-sh/node-compat/events";

const ee = new EventEmitter();
ee.on("data", (msg) => console.log(msg));
ee.once("init", () => console.log("initialized"));
ee.emit("init");
ee.emit("data", "hello");
```

**Supported APIs:** on, addListener, once, off, removeListener, removeAllListeners, emit, listeners, listenerCount, eventNames, setMaxListeners, prependListener, prependOnceListener. Static: `EventEmitter.once()`, `EventEmitter.on()` (async iterator).

### `@lifo-sh/node-compat/buffer`

Buffer via composition pattern (augmented Uint8Array).

```js
import { Buffer } from "@lifo-sh/node-compat/buffer";

const buf = Buffer.from("Hello, world!");
console.log(buf.toString("hex"));      // "48656c6c6f2c20776f726c6421"
console.log(buf.toString("base64"));   // "SGVsbG8sIHdvcmxkIQ=="

const combined = Buffer.concat([Buffer.from("foo"), Buffer.from("bar")]);
console.log(combined.toString());       // "foobar"
```

**Supported APIs:** Buffer.from, Buffer.alloc, Buffer.allocUnsafe, Buffer.concat, Buffer.isBuffer, Buffer.byteLength, Buffer.isEncoding. Instance: toString, write, copy, equals, compare, toJSON, readUInt8/16/32 BE/LE, readInt8/16/32 BE/LE, writeUInt8/16/32 BE/LE, writeInt8/16/32 BE/LE.

**Encodings:** utf-8, hex, base64, ascii, latin1, binary.

### `@lifo-sh/node-compat/stream`

Stream primitives with flowing/paused modes and backpressure.

```js
import { Readable, Writable, Transform, pipeline } from "@lifo-sh/node-compat/stream";

const source = new Readable({
  read() { this.push("hello"); this.push(null); }
});

const upper = new Transform({
  objectMode: true,
  transform(chunk, enc, cb) { cb(null, chunk.toUpperCase()); }
});

const dest = new Writable({
  write(chunk, enc, cb) { console.log(chunk); cb(); }
});

pipeline(source, upper, dest, (err) => {
  if (!err) console.log("done!");
});
```

**Supported APIs:** Readable, Writable, Duplex, Transform, PassThrough, pipeline, finished. Readable supports pipe/unpipe, pause/resume, and `Symbol.asyncIterator`.

### `@lifo-sh/node-compat/crypto`

Crypto backed by the Web Crypto API (SubtleCrypto).

```js
import crypto from "@lifo-sh/node-compat/crypto";

// Random values
const bytes = crypto.randomBytes(32);
const id = crypto.randomUUID();

// SHA-256 hash (async -- uses SubtleCrypto)
const hash = crypto.createHash("sha256");
hash.update("hello");
const hex = await hash.digest("hex");
// "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"

// HMAC (async)
const hmac = crypto.createHmac("sha256", "secret");
hmac.update("message");
const sig = await hmac.digest("hex");
```

**Supported APIs:** randomBytes, randomUUID, randomInt, createHash (SHA-1, SHA-256, SHA-384, SHA-512), createHmac, timingSafeEqual.

> **Note:** `digest()` returns a `Promise` since it uses the async Web Crypto API under the hood. This differs from Node.js where digest is synchronous.

### `@lifo-sh/node-compat/url`

URL utilities. Re-exports browser globals plus Node-style helpers.

```js
import url from "@lifo-sh/node-compat/url";

const parsed = url.parse("https://user:pass@example.com/path?q=1#hash");
console.log(parsed.hostname); // "example.com"
console.log(parsed.auth);     // "user:pass"

url.format({ protocol: "https:", hostname: "example.com", pathname: "/api" });
// "https://example.com/api"
```

**Supported APIs:** URL, URLSearchParams, parse, format, resolve, domainToASCII, domainToUnicode, fileURLToPath, pathToFileURL.

### `@lifo-sh/node-compat/process`

Process shim for browser environments.

```js
import process from "@lifo-sh/node-compat/process";

console.log(process.platform); // "browser"
console.log(process.cwd());    // "/"
process.nextTick(() => console.log("tick!"));
```

**Supported APIs:** env, argv, argv0, platform, arch, version, versions, pid, ppid, title, execPath, stdout, stderr, cwd, chdir, nextTick (via queueMicrotask), exit (throws), hrtime (via performance.now), memoryUsage, uptime, emitWarning, on/off/once/emit (event stubs).

### `@lifo-sh/node-compat/util`

Utility functions.

```js
import util from "@lifo-sh/node-compat/util";

util.format("%s has %d items", "list", 3); // "list has 3 items"
util.inspect({ a: 1, b: [2, 3] });        // "{ a: 1, b: [ 2, 3 ] }"
util.isDeepStrictEqual({ x: 1 }, { x: 1 }); // true

const fn = util.promisify(asyncOp);
const result = await fn(42);
```

**Supported APIs:** TextEncoder, TextDecoder, promisify, callbackify, inherits, deprecate, inspect, format, isDeepStrictEqual.

### `@lifo-sh/node-compat/assert`

Assertion module.

```js
import assert from "@lifo-sh/node-compat/assert";

assert(true);
assert.strictEqual(1, 1);
assert.deepStrictEqual({ a: 1 }, { a: 1 });
assert.throws(() => { throw new Error("boom"); });
```

**Supported APIs:** assert (ok), equal, notEqual, strictEqual, notStrictEqual, deepEqual, notDeepEqual, deepStrictEqual, notDeepStrictEqual, throws, doesNotThrow, ifError, fail. Also: AssertionError class.

### `@lifo-sh/node-compat/timers`

Timer functions (re-exports with `setImmediate` polyfill).

```js
import { setTimeout, setImmediate } from "@lifo-sh/node-compat/timers";

setTimeout(() => console.log("delayed"), 100);
setImmediate(() => console.log("immediate!")); // polyfilled via setTimeout(fn, 0)
```

**Supported APIs:** setTimeout, setInterval, clearTimeout, clearInterval, setImmediate, clearImmediate.

### `@lifo-sh/node-compat/os`

OS information shim for browser environments.

```js
import os from "@lifo-sh/node-compat/os";

os.platform();  // "browser"
os.arch();      // "wasm"
os.homedir();   // "/"
os.tmpdir();    // "/tmp"
os.cpus();      // based on navigator.hardwareConcurrency
os.EOL;         // "\n"
```

**Supported APIs:** platform, arch, type, release, homedir, tmpdir, hostname, cpus, totalmem, freemem, uptime, loadavg, networkInterfaces, userInfo, endianness, EOL.

## Architecture

```
@lifo-sh/node-compat
  |
  |-- fs, fs/promises  -->  @lifo-sh/vfs  -->  Backend (MemoryBackend)
  |-- path                  (pure, no VFS)
  |-- events                (standalone EventEmitter)
  |-- buffer                (augmented Uint8Array)
  |-- stream                (Readable/Writable/Transform/Duplex + pipeline)
  |-- crypto                (Web Crypto API wrapper)
  |-- url                   (globalThis.URL + Node-style helpers)
  |-- process               (browser shim)
  |-- util                  (promisify, inspect, format, etc.)
  |-- timers                (globalThis timers + setImmediate polyfill)
  |-- assert                (assertion functions)
  |-- os                    (browser shim)
```

### Virtual File System

The VFS is the core abstraction that makes `fs` work in the browser:

- **Backend interface** (`VFSBackend`) -- defines all filesystem operations
- **MemoryBackend** -- in-memory implementation using a tree of file/directory/symlink nodes
- **Event-driven** -- mutations emit events that power `fs.watch` and `fs.watchFile`
- **Symlink support** -- full symbolic link resolution with circular reference detection
- **Swappable** -- call `fs.configure(vfs)` to use a different VFS instance

```js
import { createVFS, MemoryBackend } from "@lifo-sh/vfs";
import fs from "@lifo-sh/node-compat/fs";

const vfs = createVFS({ backend: new MemoryBackend() });
fs.configure(vfs);

fs.writeFileSync("/hello.txt", "Hello from the browser!");
```

## Testing

Tests run in both environments to ensure true cross-platform compatibility:

```bash
pnpm test:node      # Vitest in Node.js
pnpm test:browser   # Vitest + Playwright in real Chromium
```

All 94 stories have test assertions that validate actual behavior. The test runner executes each story's `run()` function and then calls its `test(output)` function to assert correctness.

## Project Structure

```
node-compat/
  packages/
    vfs/                     # @lifo-sh/vfs
      src/
        types.ts             # VFSBackend, VFSStat interfaces
        memory.ts            # In-memory backend implementation
        errors.ts            # POSIX-style error factories (ENOENT, EEXIST, etc.)
        watcher.ts           # Event emitter for filesystem mutations
        index.ts             # createVFS factory
    node-compat/             # @lifo-sh/node-compat
      src/
        fs.ts                # fs module (callbacks + sync)
        fs/promises.ts       # fs.promises module
        path.ts              # path module
        events.ts            # EventEmitter
        buffer.ts            # Buffer
        stream.ts            # Readable, Writable, Transform, Duplex, pipeline
        crypto.ts            # createHash, createHmac, randomBytes, randomUUID
        url.ts               # URL, URLSearchParams, parse, format
        process.ts           # process shim
        util.ts              # promisify, inspect, format, etc.
        timers.ts            # setTimeout, setImmediate, etc.
        assert.ts            # assert module
        os.ts                # os shim
        index.ts             # re-exports
    stories/                 # Shared test stories
      src/
        index.ts             # 94 stories with run + test functions
        __tests__/
          stories.test.ts    # Vitest runner
    vite-react-app/          # Browser playground (React + Tailwind + shadcn)
    cli-app/                 # CLI playground (interactive menu)
  CLAUDE.md                  # Development instructions and conventions
  tsconfig.base.json         # Shared TypeScript config
  pnpm-workspace.yaml        # pnpm workspace config
```

## Development

### Prerequisites

- Node.js >= 18
- pnpm

### Building

```bash
# Build everything
pnpm build

# Build individual packages
pnpm --filter @lifo-sh/vfs run build
pnpm --filter @lifo-sh/node-compat run build
pnpm --filter stories run build
```

### Running playgrounds

```bash
pnpm dev:vite    # Browser playground at http://localhost:5173
pnpm dev:cli     # CLI playground
```

### Adding a new module

1. Create `packages/node-compat/src/{module}.ts`
2. Add the entry to `packages/node-compat/tsup.config.ts`
3. Add the export map to `packages/node-compat/package.json`
4. Add stories with tests to `packages/stories/src/index.ts`
5. Build and run tests in both environments

See [CLAUDE.md](./CLAUDE.md) for the full implementation guide.

## Tech Stack

- **pnpm workspaces** -- monorepo management
- **tsup** -- ESM + CJS dual builds with DTS generation
- **TypeScript** -- strict mode, ES2022 target
- **Vitest** -- test runner for both Node.js and browser
- **Playwright** -- real Chromium browser testing
- **React + Vite + Tailwind + shadcn** -- browser playground UI

## License

MIT
