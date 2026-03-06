const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function toHex(data: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < data.length; i++) {
    hex += data[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

function encodeString(str: string, encoding: string): Uint8Array {
  const enc = encoding.toLowerCase().replace("-", "");
  if (enc === "utf8") return textEncoder.encode(str);
  if (enc === "hex") return fromHex(str);
  if (enc === "base64") return fromBase64(str);
  if (enc === "ascii" || enc === "latin1" || enc === "binary") {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xff;
    return bytes;
  }
  return textEncoder.encode(str);
}

function decodeBytes(data: Uint8Array, encoding: string): string {
  const enc = encoding.toLowerCase().replace("-", "");
  if (enc === "utf8") return textDecoder.decode(data);
  if (enc === "hex") return toHex(data);
  if (enc === "base64") return toBase64(data);
  if (enc === "ascii" || enc === "latin1" || enc === "binary") {
    let str = "";
    for (let i = 0; i < data.length; i++) str += String.fromCharCode(data[i]);
    return str;
  }
  return textDecoder.decode(data);
}

/** Tag to identify Buffer instances */
const BUFFER_TAG = Symbol("Buffer");

export interface Buffer extends Uint8Array {
  [BUFFER_TAG]: true;
  toString(encoding?: string, start?: number, end?: number): string;
  write(string: string, offset?: number, length?: number, encoding?: string): number;
  copy(target: Uint8Array, targetStart?: number, sourceStart?: number, sourceEnd?: number): number;
  equals(other: Uint8Array): boolean;
  compare(other: Uint8Array): number;
  toJSON(): { type: "Buffer"; data: number[] };
  readUInt8(offset?: number): number;
  readUInt16BE(offset?: number): number;
  readUInt16LE(offset?: number): number;
  readUInt32BE(offset?: number): number;
  readUInt32LE(offset?: number): number;
  readInt8(offset?: number): number;
  readInt16BE(offset?: number): number;
  readInt16LE(offset?: number): number;
  readInt32BE(offset?: number): number;
  readInt32LE(offset?: number): number;
  writeUInt8(value: number, offset?: number): number;
  writeUInt16BE(value: number, offset?: number): number;
  writeUInt16LE(value: number, offset?: number): number;
  writeUInt32BE(value: number, offset?: number): number;
  writeUInt32LE(value: number, offset?: number): number;
  writeInt8(value: number, offset?: number): number;
  writeInt16BE(value: number, offset?: number): number;
  writeInt16LE(value: number, offset?: number): number;
  writeInt32BE(value: number, offset?: number): number;
  writeInt32LE(value: number, offset?: number): number;
}

function augment(arr: Uint8Array): Buffer {
  const buf = arr as Buffer;
  (buf as any)[BUFFER_TAG] = true;

  buf.toString = function (encoding = "utf-8", start = 0, end?: number): string {
    return decodeBytes(this.subarray(start, end), encoding);
  };

  buf.write = function (string: string, offset = 0, length?: number, encoding = "utf-8"): number {
    const bytes = encodeString(string, encoding);
    const len = Math.min(bytes.byteLength, length ?? (this.byteLength - offset), this.byteLength - offset);
    this.set(bytes.subarray(0, len), offset);
    return len;
  };

  buf.copy = function (target: Uint8Array, targetStart = 0, sourceStart = 0, sourceEnd?: number): number {
    const source = this.subarray(sourceStart, sourceEnd);
    const len = Math.min(source.byteLength, target.byteLength - targetStart);
    target.set(source.subarray(0, len), targetStart);
    return len;
  };

  buf.equals = function (other: Uint8Array): boolean {
    if (this.byteLength !== other.byteLength) return false;
    for (let i = 0; i < this.byteLength; i++) {
      if (this[i] !== other[i]) return false;
    }
    return true;
  };

  buf.compare = function (other: Uint8Array): number {
    const len = Math.min(this.byteLength, other.byteLength);
    for (let i = 0; i < len; i++) {
      if (this[i] < other[i]) return -1;
      if (this[i] > other[i]) return 1;
    }
    return this.byteLength < other.byteLength ? -1 : this.byteLength > other.byteLength ? 1 : 0;
  };

  buf.toJSON = function (): { type: "Buffer"; data: number[] } {
    return { type: "Buffer", data: Array.from(this) };
  };

  // Read methods
  buf.readUInt8 = function (offset = 0) { return this[offset]; };
  buf.readUInt16BE = function (offset = 0) { return (this[offset] << 8) | this[offset + 1]; };
  buf.readUInt16LE = function (offset = 0) { return this[offset] | (this[offset + 1] << 8); };
  buf.readUInt32BE = function (offset = 0) { return ((this[offset] << 24) | (this[offset + 1] << 16) | (this[offset + 2] << 8) | this[offset + 3]) >>> 0; };
  buf.readUInt32LE = function (offset = 0) { return (this[offset] | (this[offset + 1] << 8) | (this[offset + 2] << 16) | (this[offset + 3] << 24)) >>> 0; };
  buf.readInt8 = function (offset = 0) { const v = this[offset]; return v > 127 ? v - 256 : v; };
  buf.readInt16BE = function (offset = 0) { const v = this.readUInt16BE(offset); return v > 32767 ? v - 65536 : v; };
  buf.readInt16LE = function (offset = 0) { const v = this.readUInt16LE(offset); return v > 32767 ? v - 65536 : v; };
  buf.readInt32BE = function (offset = 0) { return (this[offset] << 24) | (this[offset + 1] << 16) | (this[offset + 2] << 8) | this[offset + 3]; };
  buf.readInt32LE = function (offset = 0) { return this[offset] | (this[offset + 1] << 8) | (this[offset + 2] << 16) | (this[offset + 3] << 24); };

  // Write methods
  buf.writeUInt8 = function (value: number, offset = 0) { this[offset] = value & 0xff; return offset + 1; };
  buf.writeUInt16BE = function (value: number, offset = 0) { this[offset] = (value >> 8) & 0xff; this[offset + 1] = value & 0xff; return offset + 2; };
  buf.writeUInt16LE = function (value: number, offset = 0) { this[offset] = value & 0xff; this[offset + 1] = (value >> 8) & 0xff; return offset + 2; };
  buf.writeUInt32BE = function (value: number, offset = 0) { this[offset] = (value >>> 24) & 0xff; this[offset + 1] = (value >>> 16) & 0xff; this[offset + 2] = (value >>> 8) & 0xff; this[offset + 3] = value & 0xff; return offset + 4; };
  buf.writeUInt32LE = function (value: number, offset = 0) { this[offset] = value & 0xff; this[offset + 1] = (value >>> 8) & 0xff; this[offset + 2] = (value >>> 16) & 0xff; this[offset + 3] = (value >>> 24) & 0xff; return offset + 4; };
  buf.writeInt8 = function (value: number, offset = 0) { this[offset] = value < 0 ? value + 256 : value; return offset + 1; };
  buf.writeInt16BE = function (value: number, offset = 0) { return this.writeUInt16BE(value < 0 ? value + 65536 : value, offset); };
  buf.writeInt16LE = function (value: number, offset = 0) { return this.writeUInt16LE(value < 0 ? value + 65536 : value, offset); };
  buf.writeInt32BE = function (value: number, offset = 0) { return this.writeUInt32BE(value < 0 ? value + 4294967296 : value, offset); };
  buf.writeInt32LE = function (value: number, offset = 0) { return this.writeUInt32LE(value < 0 ? value + 4294967296 : value, offset); };

  return buf;
}

export const Buffer = {
  from(
    input: string | ArrayLike<number> | ArrayBuffer | Uint8Array,
    encodingOrOffset?: string | number,
    length?: number
  ): Buffer {
    if (typeof input === "string") {
      const encoding = (typeof encodingOrOffset === "string" ? encodingOrOffset : "utf-8");
      return augment(encodeString(input, encoding));
    }
    if (input instanceof ArrayBuffer) {
      const offset = typeof encodingOrOffset === "number" ? encodingOrOffset : 0;
      const len = length ?? (input.byteLength - offset);
      return augment(new Uint8Array(input, offset, len));
    }
    if (input instanceof Uint8Array) {
      return augment(new Uint8Array(input));
    }
    return augment(Uint8Array.from(input as ArrayLike<number>));
  },

  alloc(size: number, fill?: number | string | Uint8Array, encoding?: string): Buffer {
    const buf = augment(new Uint8Array(size));
    if (fill !== undefined) {
      if (typeof fill === "number") {
        buf.fill(fill);
      } else if (typeof fill === "string") {
        const bytes = encodeString(fill, encoding ?? "utf-8");
        for (let i = 0; i < size; i++) buf[i] = bytes[i % bytes.length];
      } else {
        for (let i = 0; i < size; i++) buf[i] = fill[i % fill.length];
      }
    }
    return buf;
  },

  allocUnsafe(size: number): Buffer {
    return augment(new Uint8Array(size));
  },

  concat(list: (Uint8Array | Buffer)[], totalLength?: number): Buffer {
    const len = totalLength ?? list.reduce((sum, b) => sum + b.byteLength, 0);
    const result = Buffer.alloc(len);
    let offset = 0;
    for (const buf of list) {
      const copyLen = Math.min(buf.byteLength, len - offset);
      result.set(buf.subarray(0, copyLen), offset);
      offset += copyLen;
      if (offset >= len) break;
    }
    return result;
  },

  isBuffer(obj: unknown): obj is Buffer {
    return obj != null && typeof obj === "object" && (obj as any)[BUFFER_TAG] === true;
  },

  byteLength(string: string, encoding = "utf-8"): number {
    return encodeString(string, encoding).byteLength;
  },

  isEncoding(encoding: string): boolean {
    return ["utf-8", "utf8", "ascii", "latin1", "binary", "hex", "base64", "ucs2", "ucs-2", "utf16le"].includes(
      encoding.toLowerCase().replace("-", "")
    );
  },
};

export default Buffer;
