/**
 * Rollup native bindings shim using @rollup/wasm-node loaded from CDN.
 *
 * When code inside Lifo does `require('@rollup/rollup-linux-x64-gnu')` (or any
 * platform variant), this shim is returned instead of the native .node binary
 * which can't run in the browser.
 *
 * The WASM binary is lazy-loaded on first call to parse/xxhash.
 */

const ROLLUP_WASM_VERSION = '4.59.0';
const WASM_BG_URL = `https://unpkg.com/@rollup/wasm-node@${ROLLUP_WASM_VERSION}/dist/wasm-node/bindings_wasm_bg.wasm`;

// ── WASM state ──────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wasm: any = null;
let initPromise: Promise<void> | null = null;

// ── wasm-bindgen glue (mirrors bindings_wasm.js) ────────────

let heap = new Array(128).fill(undefined);
heap.push(undefined, null, true, false);
let heap_next = heap.length;

function addHeapObject(obj: unknown): number {
  if (heap_next === heap.length) heap.push(heap.length + 1);
  const idx = heap_next;
  heap_next = heap[idx];
  heap[idx] = obj;
  return idx;
}

function getObject(idx: number): unknown {
  return heap[idx];
}

function dropObject(idx: number): void {
  if (idx < 132) return;
  heap[idx] = heap_next;
  heap_next = idx;
}

function takeObject(idx: number): unknown {
  const ret = getObject(idx);
  dropObject(idx);
  return ret;
}

const cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const cachedTextEncoder = new TextEncoder();

let cachedUint8ArrayMemory0: Uint8Array | null = null;
function getUint8ArrayMemory0(): Uint8Array {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}

let cachedDataViewMemory0: DataView | null = null;
function getDataViewMemory0(): DataView {
  if (
    cachedDataViewMemory0 === null ||
    (cachedDataViewMemory0 as any).buffer?.detached === true ||
    ((cachedDataViewMemory0 as any).buffer?.detached === undefined &&
      cachedDataViewMemory0.buffer !== wasm.memory.buffer)
  ) {
    cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
  }
  return cachedDataViewMemory0;
}

function decodeText(ptr: number, len: number): string {
  ptr = ptr >>> 0;
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function getStringFromWasm0(ptr: number, len: number): string {
  ptr = ptr >>> 0;
  return decodeText(ptr, len);
}

function getArrayU8FromWasm0(ptr: number, len: number): Uint8Array {
  ptr = ptr >>> 0;
  return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let WASM_VECTOR_LEN = 0;

function passStringToWasm0(
  arg: string,
  malloc: (len: number, align: number) => number,
  realloc?: (ptr: number, oldLen: number, newLen: number, align: number) => number,
): number {
  if (realloc === undefined) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr = malloc(buf.length, 1) >>> 0;
    getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr;
  }

  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8ArrayMemory0();
  let offset = 0;

  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 0x7f) break;
    mem[ptr + offset] = code;
  }

  if (offset !== len) {
    if (offset !== 0) arg = arg.slice(offset);
    ptr = realloc(ptr, len, (len = offset + arg.length * 3), 1) >>> 0;
    const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
    const ret = cachedTextEncoder.encodeInto(arg, view);
    offset += ret.written!;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }

  WASM_VECTOR_LEN = offset;
  return ptr;
}

function __wbg_get_imports(): Record<string, Record<string, unknown>> {
  const import0: Record<string, unknown> = {
    __proto__: null,
    __wbg___wbindgen_throw_be289d5034ed271b(arg0: number, arg1: number) {
      throw new Error(getStringFromWasm0(arg0, arg1));
    },
    __wbg_error_7534b8e9a36f1ab4(arg0: number, arg1: number) {
      let deferred0_0: number;
      let deferred0_1: number;
      try {
        deferred0_0 = arg0;
        deferred0_1 = arg1;
        console.error(getStringFromWasm0(arg0, arg1));
      } finally {
        wasm.__wbindgen_export(deferred0_0!, deferred0_1!, 1);
      }
    },
    __wbg_length_32ed9a279acd054c(arg0: number) {
      return (getObject(arg0) as Uint8Array).length;
    },
    __wbg_new_8a6f238a6ece86ea() {
      return addHeapObject(new Error());
    },
    __wbg_prototypesetcall_bdcdcc5842e4d77d(arg0: number, arg1: number, arg2: number) {
      Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), getObject(arg2) as Uint8Array);
    },
    __wbg_stack_0ed75d68575b0f3c(arg0: number, arg1: number) {
      const ret = (getObject(arg1) as Error).stack;
      const ptr1 = passStringToWasm0(ret!, wasm.__wbindgen_export2, wasm.__wbindgen_export3);
      const len1 = WASM_VECTOR_LEN;
      getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
      getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    },
    __wbindgen_object_drop_ref(arg0: number) {
      takeObject(arg0);
    },
  };
  return {
    __proto__: null as unknown as Record<string, unknown>,
    './bindings_wasm_bg.js': import0,
  };
}

// ── Initialization ──────────────────────────────────────────

async function ensureWasm(): Promise<void> {
  if (wasm) return;

  if (!initPromise) {
    initPromise = (async () => {
      const response = await fetch(WASM_BG_URL);
      const bytes = await response.arrayBuffer();
      const wasmModule = new WebAssembly.Module(bytes);
      const instance = new WebAssembly.Instance(wasmModule, __wbg_get_imports() as any);
      wasm = instance.exports;

      // Reset memory caches after WASM init
      cachedUint8ArrayMemory0 = null;
      cachedDataViewMemory0 = null;
    })();
  }

  await initPromise;
}

// Synchronous init — called once before first sync use
function ensureWasmSync(): void {
  if (!wasm) {
    throw new Error(
      '[lifo] Rollup WASM not initialized. Call ensureInit() first.',
    );
  }
}

// ── Exported functions ──────────────────────────────────────

function parse(code: string, allowReturnOutsideFunction: boolean, jsx: boolean): Uint8Array {
  ensureWasmSync();
  const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
  try {
    const ptr0 = passStringToWasm0(code, wasm.__wbindgen_export2, wasm.__wbindgen_export3);
    const len0 = WASM_VECTOR_LEN;
    wasm.parse(retptr, ptr0, len0, allowReturnOutsideFunction, jsx);
    const r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    const r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    const v2 = getArrayU8FromWasm0(r0, r1).slice();
    wasm.__wbindgen_export(r0, r1 * 1, 1);
    return v2;
  } finally {
    wasm.__wbindgen_add_to_stack_pointer(16);
  }
}

async function parseAsync(
  code: string,
  allowReturnOutsideFunction: boolean,
  jsx: boolean,
  _signal?: AbortSignal,
): Promise<Uint8Array> {
  await ensureWasm();
  return parse(code, allowReturnOutsideFunction, jsx);
}

function xxhashBase16(input: Uint8Array): string {
  ensureWasmSync();
  let deferred0 = 0;
  let deferred1 = 0;
  const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
  try {
    wasm.xxhashBase16(retptr, addHeapObject(input));
    const r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    const r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    deferred0 = r0;
    deferred1 = r1;
    return getStringFromWasm0(r0, r1);
  } finally {
    wasm.__wbindgen_add_to_stack_pointer(16);
    wasm.__wbindgen_export(deferred0, deferred1, 1);
  }
}

function xxhashBase36(input: Uint8Array): string {
  ensureWasmSync();
  let deferred0 = 0;
  let deferred1 = 0;
  const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
  try {
    wasm.xxhashBase36(retptr, addHeapObject(input));
    const r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    const r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    deferred0 = r0;
    deferred1 = r1;
    return getStringFromWasm0(r0, r1);
  } finally {
    wasm.__wbindgen_add_to_stack_pointer(16);
    wasm.__wbindgen_export(deferred0, deferred1, 1);
  }
}

function xxhashBase64Url(input: Uint8Array): string {
  ensureWasmSync();
  let deferred0 = 0;
  let deferred1 = 0;
  const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
  try {
    wasm.xxhashBase64Url(retptr, addHeapObject(input));
    const r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    const r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    deferred0 = r0;
    deferred1 = r1;
    return getStringFromWasm0(r0, r1);
  } finally {
    wasm.__wbindgen_add_to_stack_pointer(16);
    wasm.__wbindgen_export(deferred0, deferred1, 1);
  }
}

// ── Public API ──────────────────────────────────────────────

export function createRollupNative(): Record<string, unknown> {
  // Eagerly start WASM download so it's ready by the time parse/xxhash
  // are actually called (rollup only destructures at require-time, doesn't
  // call functions until later, after async code has had time to run).
  ensureWasm();

  return {
    parse,
    parseAsync,
    xxhashBase64Url,
    xxhashBase36,
    xxhashBase16,
    ensureInit: ensureWasm,
  };
}
