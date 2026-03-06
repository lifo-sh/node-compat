function getRandomValues(array: Uint8Array): Uint8Array {
  return globalThis.crypto.getRandomValues(array);
}

export function randomBytes(size: number): Uint8Array {
  const buf = new Uint8Array(size);
  // crypto.getRandomValues has a 65536-byte limit per call
  for (let offset = 0; offset < size; offset += 65536) {
    const len = Math.min(65536, size - offset);
    getRandomValues(buf.subarray(offset, offset + len));
  }
  return buf;
}

export function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}

export function randomInt(min: number, max?: number): number {
  if (max === undefined) { max = min; min = 0; }
  const range = max - min;
  const array = new Uint32Array(1);
  globalThis.crypto.getRandomValues(array);
  return min + (array[0] % range);
}

function toHex(data: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < data.length; i++) {
    hex += data[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function toBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

type DigestEncoding = "hex" | "base64";

export class Hash {
  private _algorithm: string;
  private _data: Uint8Array[] = [];

  constructor(algorithm: string) {
    this._algorithm = algorithm.toLowerCase().replace("-", "");
  }

  update(data: string | Uint8Array, _encoding?: string): this {
    if (typeof data === "string") {
      this._data.push(new TextEncoder().encode(data));
    } else {
      this._data.push(data);
    }
    return this;
  }

  async digest(encoding?: DigestEncoding): Promise<string | Uint8Array> {
    const algorithmMap: Record<string, string> = {
      sha1: "SHA-1",
      sha256: "SHA-256",
      sha384: "SHA-384",
      sha512: "SHA-512",
    };
    const algo = algorithmMap[this._algorithm];
    if (!algo) throw new Error(`Digest method not supported: ${this._algorithm}`);

    const totalLength = this._data.reduce((sum, d) => sum + d.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const d of this._data) {
      combined.set(d, offset);
      offset += d.length;
    }

    const hashBuffer = await globalThis.crypto.subtle.digest(algo, combined);
    const result = new Uint8Array(hashBuffer);

    if (encoding === "hex") return toHex(result);
    if (encoding === "base64") return toBase64(result);
    return result;
  }
}

export function createHash(algorithm: string): Hash {
  return new Hash(algorithm);
}

export class Hmac {
  private _algorithm: string;
  private _key: string | Uint8Array;
  private _data: Uint8Array[] = [];

  constructor(algorithm: string, key: string | Uint8Array) {
    this._algorithm = algorithm.toLowerCase().replace("-", "");
    this._key = key;
  }

  update(data: string | Uint8Array, _encoding?: string): this {
    if (typeof data === "string") {
      this._data.push(new TextEncoder().encode(data));
    } else {
      this._data.push(data);
    }
    return this;
  }

  async digest(encoding?: DigestEncoding): Promise<string | Uint8Array> {
    const algorithmMap: Record<string, { name: string; hash: string }> = {
      sha1: { name: "HMAC", hash: "SHA-1" },
      sha256: { name: "HMAC", hash: "SHA-256" },
      sha384: { name: "HMAC", hash: "SHA-384" },
      sha512: { name: "HMAC", hash: "SHA-512" },
    };
    const algo = algorithmMap[this._algorithm];
    if (!algo) throw new Error(`Digest method not supported: ${this._algorithm}`);

    const keyBytes = typeof this._key === "string" ? new TextEncoder().encode(this._key) : this._key;
    const keyBuffer = keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer;
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      "raw", keyBuffer, { name: algo.name, hash: algo.hash }, false, ["sign"]
    );

    const totalLength = this._data.reduce((sum, d) => sum + d.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const d of this._data) {
      combined.set(d, offset);
      offset += d.length;
    }

    const sig = await globalThis.crypto.subtle.sign("HMAC", cryptoKey, combined);
    const result = new Uint8Array(sig);

    if (encoding === "hex") return toHex(result);
    if (encoding === "base64") return toBase64(result);
    return result;
  }
}

export function createHmac(algorithm: string, key: string | Uint8Array): Hmac {
  return new Hmac(algorithm, key);
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) throw new RangeError("Input buffers must have the same byte length");
  let result = 0;
  for (let i = 0; i < a.byteLength; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

const crypto = {
  randomBytes, randomUUID, randomInt, createHash, createHmac, timingSafeEqual, Hash, Hmac,
};

export default crypto;
