const _setTimeout = globalThis.setTimeout.bind(globalThis);
const _setInterval = globalThis.setInterval.bind(globalThis);
const _clearTimeout = globalThis.clearTimeout.bind(globalThis);
const _clearInterval = globalThis.clearInterval.bind(globalThis);

export { _setTimeout as setTimeout, _setInterval as setInterval, _clearTimeout as clearTimeout, _clearInterval as clearInterval };

export function setImmediate(callback: (...args: any[]) => void, ...args: any[]): ReturnType<typeof _setTimeout> {
  return _setTimeout(() => callback(...args), 0);
}

export function clearImmediate(id: ReturnType<typeof _setTimeout>): void {
  _clearTimeout(id);
}

const timers = {
  setTimeout: _setTimeout,
  setInterval: _setInterval,
  clearTimeout: _clearTimeout,
  clearInterval: _clearInterval,
  setImmediate,
  clearImmediate,
};

export default timers;
