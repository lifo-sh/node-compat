export const EOL = "\n";

export function platform(): string {
  return "browser";
}

export function arch(): string {
  return "wasm";
}

export function type(): string {
  return "Browser";
}

export function release(): string {
  return "1.0.0";
}

export function homedir(): string {
  return "/";
}

export function tmpdir(): string {
  return "/tmp";
}

export function hostname(): string {
  try {
    return globalThis.location?.hostname ?? "localhost";
  } catch {
    return "localhost";
  }
}

export function cpus(): { model: string; speed: number; times: { user: number; nice: number; sys: number; idle: number; irq: number } }[] {
  const count = typeof navigator !== "undefined" ? (navigator.hardwareConcurrency ?? 1) : 1;
  return Array.from({ length: count }, () => ({
    model: "Browser CPU",
    speed: 0,
    times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 },
  }));
}

export function totalmem(): number {
  if (typeof navigator !== "undefined" && "deviceMemory" in navigator) {
    return ((navigator as any).deviceMemory ?? 4) * 1024 * 1024 * 1024;
  }
  return 4 * 1024 * 1024 * 1024;
}

export function freemem(): number {
  return totalmem() / 2;
}

export function uptime(): number {
  return performance.now() / 1000;
}

export function loadavg(): [number, number, number] {
  return [0, 0, 0];
}

export function networkInterfaces(): Record<string, any[]> {
  return {};
}

export function userInfo(): { username: string; uid: number; gid: number; shell: string; homedir: string } {
  return { username: "browser", uid: 1000, gid: 1000, shell: "/bin/sh", homedir: "/" };
}

export function endianness(): "BE" | "LE" {
  const buf = new ArrayBuffer(2);
  new DataView(buf).setInt16(0, 256, true);
  return new Int16Array(buf)[0] === 256 ? "LE" : "BE";
}

const os = {
  EOL, platform, arch, type, release, homedir, tmpdir, hostname,
  cpus, totalmem, freemem, uptime, loadavg, networkInterfaces,
  userInfo, endianness,
};

export default os;
