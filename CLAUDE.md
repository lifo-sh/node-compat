# node-compat

A monorepo that polyfills Node.js core APIs for the browser using a Virtual File System.

## Packages

- `packages/vfs` (`@lifo-sh/vfs`) - Standalone VFS with swappable backends (MemoryBackend, future: IndexedDB, NodeFS)
- `packages/node-compat` (`@lifo-sh/node-compat`) - Node.js API compatibility layer wrapping VFS. Exports `fs`, `fs/promises`, `path`.
- `packages/stories` (`stories`) - Shared test stories consumed by both playground apps
- `packages/vite-react-app` - Browser playground with dashboard UI (Tailwind + shadcn, dark mode)
- `packages/cli-app` - CLI playground with interactive two-level menu

## Commands

- `pnpm build` - Build all packages
- `pnpm dev:vite` - Run the Vite playground
- `pnpm dev:cli` - Run the CLI playground
- `pnpm --filter @lifo-sh/vfs run build` - Build VFS only
- `pnpm --filter @lifo-sh/node-compat run build` - Build node-compat only
- `pnpm test` - Run all tests (Node)
- `pnpm test:node` - Run tests in Node environment
- `pnpm test:browser` - Run tests in real Chromium via Playwright

## Architecture

```
node-compat/fs  ->  VFS core  ->  Backend (Memory / IndexedDB / NodeFS)
node-compat/path  (pure implementation, no VFS dependency)
```

- `fs` callbacks, sync, and promises all wrap the same VFS instance
- `fs.configure(vfs)` swaps the underlying VFS
- VFS emits events on mutations; `fs.watch` / `fs.watchFile` subscribe to these

## Skill: Implement a new node-compat API

When asked to implement a new Node.js API (e.g., "implement fs.appendFile" or "implement the buffer module"):

### Step 1: Check if VFS needs changes
- Read `packages/vfs/src/types.ts` to see the `VFSBackend` interface
- If the new API needs a new VFS operation (e.g., `appendFile` needs an `appendFile` backend method):
  1. Add the method to the `VFSBackend` interface in `types.ts`
  2. Implement the sync variant in `packages/vfs/src/memory.ts` (MemoryBackend)
  3. Add the async wrapper in `packages/vfs/src/memory.ts`
  4. Wire it through `packages/vfs/src/index.ts` (the `createVFS` function) with event emission
- If the API is pure (like `path` functions), skip this step

### Step 2: Implement in node-compat
- For `fs` APIs: add to `packages/node-compat/src/fs.ts` (callback + sync) and `packages/node-compat/src/fs/promises.ts` (promise)
- For new modules: create `packages/node-compat/src/{module}.ts`, add to `tsup.config.ts` entry points, add to `package.json` exports
- Match Node.js API signatures exactly (check https://nodejs.org/api/)
- The callback style is: `fs.method(args..., callback)` where callback is `(err, result?) => void`
- Sync variants throw on error (matching Node behavior)
- Export from `packages/node-compat/src/index.ts`

### Step 3: Add the story with test to the shared stories package
- Open `packages/stories/src/index.ts`
- Find the `comingSoon(...)` entry for this API
- Replace it with an `implemented(...)` call that includes:
  - Full source code string with import statement at the top
  - A `run` function that exercises the API and returns a descriptive string
  - A `test` function `(output: string) => void` that validates the run output using `assertContains(output, expected)` (throws on failure)
- The `implemented()` signature is: `implemented(name, category, source, run, test)`
- Use the exported `assertContains(output, expected)` helper to check output contains expected substrings
- Use `assert(condition, message)` for boolean assertions
- Test multiple aspects of the output to ensure correctness (e.g., check key values, expected strings)
- Keep the story order consistent (implemented first, then coming-soon within each category)
- Both the Vite app and CLI app consume from this shared package automatically

### Step 4: Build and verify
- Run `pnpm --filter @lifo-sh/vfs run build` (if VFS changed)
- Run `pnpm --filter @lifo-sh/node-compat run build`
- Run `pnpm --filter stories run build`
- Run `pnpm test:node` to verify all tests pass in Node
- Run `pnpm test:browser` to verify all tests pass in Chromium
- Both must pass before considering the implementation complete

### Naming conventions
- Package names: `@lifo-sh/vfs`, `@lifo-sh/node-compat`
- VFS errors use `createENOENT`, `createEEXIST`, etc. from `packages/vfs/src/errors.ts`
- Encoding type is defined locally (not using Node's `BufferEncoding`) to avoid Node type dependencies
- Libraries must work in both browser and Node - no Node-only globals without feature detection
