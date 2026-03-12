/**
 * Node.js assert compatibility module.
 */

type AssertFn = {
  (value: unknown, message?: string): void;
  ok: (value: unknown, message?: string) => void;
  equal: (a: unknown, b: unknown, msg?: string) => void;
  strictEqual: (a: unknown, b: unknown, msg?: string) => void;
  notEqual: (a: unknown, b: unknown, msg?: string) => void;
  notStrictEqual: (a: unknown, b: unknown, msg?: string) => void;
  deepStrictEqual: (a: unknown, b: unknown, msg?: string) => void;
  throws: (fn: () => void, msg?: string) => void;
};

const assert: AssertFn = (value: unknown, message?: string) => {
  if (!value) throw new Error(message || 'AssertionError');
};

assert.ok = assert;

assert.equal = (a: unknown, b: unknown, msg?: string) => {
  if (a != b) throw new Error(msg || `${a} != ${b}`);
};

assert.strictEqual = (a: unknown, b: unknown, msg?: string) => {
  if (a !== b) throw new Error(msg || `${a} !== ${b}`);
};

assert.notEqual = (a: unknown, b: unknown, msg?: string) => {
  if (a == b) throw new Error(msg || `${a} == ${b}`);
};

assert.notStrictEqual = (a: unknown, b: unknown, msg?: string) => {
  if (a === b) throw new Error(msg || `${a} === ${b}`);
};

assert.deepStrictEqual = (a: unknown, b: unknown, msg?: string) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(msg || 'deepStrictEqual failed');
};

assert.throws = (fn: () => void, msg?: string) => {
  try {
    fn();
    throw new Error(msg || 'Expected function to throw');
  } catch (e) {
    if (e instanceof Error && e.message === (msg || 'Expected function to throw')) throw e;
  }
};

export default assert;
