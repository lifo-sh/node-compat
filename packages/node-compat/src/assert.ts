export class AssertionError extends Error {
  actual: unknown;
  expected: unknown;
  operator: string;

  constructor(options: { message?: string; actual?: unknown; expected?: unknown; operator?: string }) {
    const msg = options.message ?? `${options.actual} ${options.operator} ${options.expected}`;
    super(msg);
    this.name = "AssertionError";
    this.actual = options.actual;
    this.expected = options.expected;
    this.operator = options.operator ?? "";
  }
}

function fail(actual?: unknown, expected?: unknown, message?: string, operator?: string): never {
  throw new AssertionError({ message, actual, expected, operator: operator ?? "fail" });
}

function ok(value: unknown, message?: string): void {
  if (!value) {
    throw new AssertionError({ message: message ?? `Expected truthy value, got ${value}`, actual: value, expected: true, operator: "ok" });
  }
}

function equal(actual: unknown, expected: unknown, message?: string): void {
  if (actual != expected) {
    throw new AssertionError({ message, actual, expected, operator: "==" });
  }
}

function notEqual(actual: unknown, expected: unknown, message?: string): void {
  if (actual == expected) {
    throw new AssertionError({ message, actual, expected, operator: "!=" });
  }
}

function strictEqual(actual: unknown, expected: unknown, message?: string): void {
  if (!Object.is(actual, expected)) {
    throw new AssertionError({ message, actual, expected, operator: "===" });
  }
}

function notStrictEqual(actual: unknown, expected: unknown, message?: string): void {
  if (Object.is(actual, expected)) {
    throw new AssertionError({ message, actual, expected, operator: "!==" });
  }
}

function isDeepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== "object") return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => isDeepEqual(v, b[i]));
  }
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp) return a.toString() === b.toString();
  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => isDeepEqual((a as any)[key], (b as any)[key]));
}

function deepEqual(actual: unknown, expected: unknown, message?: string): void {
  if (!isDeepEqual(actual, expected)) {
    throw new AssertionError({ message, actual, expected, operator: "deepEqual" });
  }
}

function notDeepEqual(actual: unknown, expected: unknown, message?: string): void {
  if (isDeepEqual(actual, expected)) {
    throw new AssertionError({ message, actual, expected, operator: "notDeepEqual" });
  }
}

function deepStrictEqual(actual: unknown, expected: unknown, message?: string): void {
  deepEqual(actual, expected, message);
}

function notDeepStrictEqual(actual: unknown, expected: unknown, message?: string): void {
  notDeepEqual(actual, expected, message);
}

function throws(block: () => void, errorOrMessage?: Function | RegExp | string, message?: string): void {
  let threw = false;
  try {
    block();
  } catch (err: unknown) {
    threw = true;
    if (typeof errorOrMessage === "function" && !(err instanceof errorOrMessage)) {
      throw new AssertionError({ message: message ?? `Expected error to be instance of ${errorOrMessage.name}`, actual: err, expected: errorOrMessage, operator: "throws" });
    }
    if (errorOrMessage instanceof RegExp && !errorOrMessage.test(String(err))) {
      throw new AssertionError({ message: message ?? `Expected error to match ${errorOrMessage}`, actual: err, expected: errorOrMessage, operator: "throws" });
    }
  }
  if (!threw) {
    throw new AssertionError({ message: message ?? (typeof errorOrMessage === "string" ? errorOrMessage : "Expected function to throw"), operator: "throws" });
  }
}

function doesNotThrow(block: () => void, errorOrMessage?: Function | string, message?: string): void {
  try {
    block();
  } catch (err: unknown) {
    const msg = message ?? (typeof errorOrMessage === "string" ? errorOrMessage : "Expected function not to throw");
    throw new AssertionError({ message: msg, actual: err, operator: "doesNotThrow" });
  }
}

function ifError(value: unknown): void {
  if (value) {
    throw value instanceof Error ? value : new AssertionError({ message: `ifError got unwanted exception: ${value}`, actual: value, operator: "ifError" });
  }
}

function assert(value: unknown, message?: string): void {
  ok(value, message);
}

assert.ok = ok;
assert.equal = equal;
assert.notEqual = notEqual;
assert.strictEqual = strictEqual;
assert.notStrictEqual = notStrictEqual;
assert.deepEqual = deepEqual;
assert.notDeepEqual = notDeepEqual;
assert.deepStrictEqual = deepStrictEqual;
assert.notDeepStrictEqual = notDeepStrictEqual;
assert.throws = throws;
assert.doesNotThrow = doesNotThrow;
assert.ifError = ifError;
assert.fail = fail;
assert.AssertionError = AssertionError;

// strict mode is just the same with strict variants as default
assert.strict = assert;

export {
  ok, equal, notEqual, strictEqual, notStrictEqual,
  deepEqual, notDeepEqual, deepStrictEqual, notDeepStrictEqual,
  throws, doesNotThrow, ifError, fail,
};

export default assert;
