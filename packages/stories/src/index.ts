import { VFS } from "@lifo-sh/vfs";
import fs from "@lifo-sh/node-compat/fs";
import path from "@lifo-sh/node-compat/path";
import { EventEmitter } from "@lifo-sh/node-compat/events";
import { Buffer } from "@lifo-sh/node-compat/buffer";
import process from "@lifo-sh/node-compat/process";
import util from "@lifo-sh/node-compat/util";
import timers from "@lifo-sh/node-compat/timers";
import assertModule from "@lifo-sh/node-compat/assert";
import os from "@lifo-sh/node-compat/os";
import { Readable, Writable, Transform, pipeline } from "@lifo-sh/node-compat/stream";
import url from "@lifo-sh/node-compat/url";
import crypto from "@lifo-sh/node-compat/crypto";

export interface Story {
  name: string;
  category: string;
  status: "implemented" | "coming-soon";
  source?: string;
  run?: () => Promise<string>;
  test?: (output: string) => void;
}

export function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

export function assertContains(output: string, expected: string): void {
  assert(output.includes(expected), `expected output to contain "${expected}", got:\n${output}`);
}

function implemented(
  name: string,
  category: string,
  source: string,
  run: () => Promise<string>,
  test?: (output: string) => void
): Story {
  return { name, category, status: "implemented", source, run, test };
}

function comingSoon(name: string, category: string): Story {
  return { name, category, status: "coming-soon" };
}

export const stories: Story[] = [
  // ━━━ VFS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  implemented("readFile / writeFile", "VFS", `import { VFS } from "@lifo-sh/vfs";

const vfs = new VFS();
const data = new TextEncoder().encode("Hello from VFS!");
vfs.writeFile("/hello.txt", data);

const result = vfs.readFile("/hello.txt");
console.log(new TextDecoder().decode(result));`,
    async () => {
      const vfs = new VFS();
      const data = new TextEncoder().encode("Hello from VFS!");
      vfs.writeFile("/hello.txt", data);
      const result = vfs.readFile("/hello.txt");
      return `Written & read: "${new TextDecoder().decode(result)}"`;
    },
    (output) => {
      assertContains(output, 'Written & read: "Hello from VFS!"');
    }),

  implemented("mkdir / readdir / stat", "VFS", `import { VFS } from "@lifo-sh/vfs";

const vfs = new VFS();
vfs.mkdir("/src/components", { recursive: true });
vfs.writeFile(
  "/src/components/App.tsx",
  new TextEncoder().encode("<App />")
);
vfs.writeFile(
  "/src/components/Header.tsx",
  new TextEncoder().encode("<Header />")
);

const entries = vfs.readdir("/src/components");
const stat = vfs.stat("/src/components");
console.log(entries.map(d => d.name), stat.type === 'directory');`,
    async () => {
      const vfs = new VFS();
      vfs.mkdir("/src/components", { recursive: true });
      vfs.writeFile("/src/components/App.tsx", new TextEncoder().encode("<App />"));
      vfs.writeFile("/src/components/Header.tsx", new TextEncoder().encode("<Header />"));
      const entries = vfs.readdir("/src/components");
      const stat = vfs.stat("/src/components");
      return `Entries: [${entries.map(d => d.name).join(", ")}]\nIs directory: ${stat.type === 'directory'}`;
    },
    (output) => {
      assertContains(output, "App.tsx");
      assertContains(output, "Header.tsx");
      assertContains(output, "Is directory: true");
    }),

  implemented("watch", "VFS", `import { VFS } from "@lifo-sh/vfs";

const vfs = new VFS();
vfs.mkdir("/watched");

const events: string[] = [];
const unwatch = vfs.watch("/watched", (event) => {
  events.push(\`\${event.type}: \${event.path}\`);
});

vfs.writeFile("/watched/a.txt", encode("a"));
vfs.writeFile("/watched/a.txt", encode("updated"));
vfs.unlink("/watched/a.txt");
unwatch();

console.log(events);`,
    async () => {
      const vfs = new VFS();
      vfs.mkdir("/watched");
      const events: string[] = [];
      const unwatch = vfs.watch("/watched", (event) => {
        events.push(`${event.type}: ${event.path}`);
      });
      vfs.writeFile("/watched/a.txt", new TextEncoder().encode("a"));
      vfs.writeFile("/watched/a.txt", new TextEncoder().encode("updated"));
      vfs.unlink("/watched/a.txt");
      unwatch();
      return `Events:\n${events.map((e) => `  ${e}`).join("\n")}`;
    },
    (output) => {
      assertContains(output, "create: /watched/a.txt");
      assertContains(output, "modify: /watched/a.txt");
      assertContains(output, "delete: /watched/a.txt");
    }),

  implemented("rename", "VFS", `import { VFS } from "@lifo-sh/vfs";

const vfs = new VFS();
vfs.writeFile("/old.txt", new TextEncoder().encode("content"));
vfs.rename("/old.txt", "/new.txt");

console.log(vfs.exists("/old.txt"));  // false
console.log(vfs.exists("/new.txt"));  // true
console.log(new TextDecoder().decode(vfs.readFile("/new.txt")));`,
    async () => {
      const vfs = new VFS();
      vfs.writeFile("/old.txt", new TextEncoder().encode("content"));
      vfs.rename("/old.txt", "/new.txt");
      const content = new TextDecoder().decode(vfs.readFile("/new.txt"));
      return `Exists /old.txt: ${vfs.exists("/old.txt")}\nExists /new.txt: ${vfs.exists("/new.txt")}\nContent: "${content}"`;
    },
    (output) => {
      assertContains(output, "Exists /old.txt: false");
      assertContains(output, "Exists /new.txt: true");
      assertContains(output, 'Content: "content"');
    }),

  implemented("unlink / rmdir", "VFS", `import { VFS } from "@lifo-sh/vfs";

const vfs = new VFS();
vfs.mkdir("/tmp/nested", { recursive: true });
vfs.writeFile("/tmp/nested/file.txt", new TextEncoder().encode("x"));
vfs.unlink("/tmp/nested/file.txt");
vfs.rmdirRecursive("/tmp");

console.log(vfs.exists("/tmp")); // false`,
    async () => {
      const vfs = new VFS();
      vfs.mkdir("/tmp/nested", { recursive: true });
      vfs.writeFile("/tmp/nested/file.txt", new TextEncoder().encode("x"));
      vfs.unlink("/tmp/nested/file.txt");
      vfs.rmdirRecursive("/tmp");
      return `Exists /tmp: ${vfs.exists("/tmp")}`;
    },
    (output) => {
      assertContains(output, "Exists /tmp: false");
    }),

  // ━━━ fs ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  implemented("fs.readFile", "fs", `import fs from "@lifo-sh/node-compat/fs";

fs.readFile("/test.txt", "utf-8", (err, data) => {
  if (err) throw err;
  console.log(data);
});

// Sync
const data = fs.readFileSync("/test.txt", "utf-8");

// Promises
const content = await fs.promises.readFile("/test.txt", "utf-8");`,
    async () => {
      fs.mkdirSync("/rd-test", { recursive: true });
      fs.writeFileSync("/rd-test/file.txt", "hello world", "utf-8");
      const sync = fs.readFileSync("/rd-test/file.txt", "utf-8");
      const promise = await fs.promises.readFile("/rd-test/file.txt", "utf-8");
      return `readFileSync: "${sync}"\nfs.promises.readFile: "${promise}"`;
    },
    (output) => {
      assertContains(output, 'readFileSync: "hello world"');
      assertContains(output, 'fs.promises.readFile: "hello world"');
    }),

  implemented("fs.writeFile", "fs", `import fs from "@lifo-sh/node-compat/fs";

fs.writeFile("/out.txt", "Hello!", (err) => {
  if (err) throw err;
});

// Sync
fs.writeFileSync("/out.txt", "Hello!", "utf-8");

// Promises
await fs.promises.writeFile("/out.txt", "Hello!", "utf-8");`,
    async () => {
      return new Promise<string>((resolve) => {
        fs.writeFile("/wr-cb.txt", "callback write", (err) => {
          if (err) { resolve(`Error: ${err.message}`); return; }
          fs.readFile("/wr-cb.txt", "utf-8", (_err, data) => {
            resolve(`Callback write then read: "${data}"`);
          });
        });
      });
    },
    (output) => {
      assertContains(output, 'Callback write then read: "callback write"');
    }),

  implemented("fs.appendFile", "fs", `import fs from "@lifo-sh/node-compat/fs";

fs.appendFileSync("/log.txt", "line 1\\n", "utf-8");
fs.appendFileSync("/log.txt", "line 2\\n", "utf-8");
console.log(fs.readFileSync("/log.txt", "utf-8"));

// Promises
await fs.promises.appendFile("/log.txt", "line 3\\n");`,
    async () => {
      fs.mkdirSync("/ap-test", { recursive: true });
      fs.writeFileSync("/ap-test/log.txt", "first\n", "utf-8");
      fs.appendFileSync("/ap-test/log.txt", "second\n", "utf-8");
      fs.appendFileSync("/ap-test/log.txt", "third\n", "utf-8");
      const content = fs.readFileSync("/ap-test/log.txt", "utf-8");
      return `Content:\n${content}`;
    },
    (output) => {
      assertContains(output, "first");
      assertContains(output, "second");
      assertContains(output, "third");
    }),

  implemented("fs.copyFile", "fs", `import fs from "@lifo-sh/node-compat/fs";

fs.writeFileSync("/src.txt", "original content", "utf-8");
fs.copyFileSync("/src.txt", "/dest.txt");
console.log(fs.readFileSync("/dest.txt", "utf-8"));

// Promises
await fs.promises.copyFile("/src.txt", "/dest2.txt");`,
    async () => {
      fs.mkdirSync("/cp-test", { recursive: true });
      fs.writeFileSync("/cp-test/src.txt", "copied content", "utf-8");
      fs.copyFileSync("/cp-test/src.txt", "/cp-test/dest.txt");
      const content = fs.readFileSync("/cp-test/dest.txt", "utf-8");
      return `Copied: "${content}"`;
    },
    (output) => {
      assertContains(output, 'Copied: "copied content"');
    }),

  implemented("fs.cp", "fs", `import fs from "@lifo-sh/node-compat/fs";

fs.mkdirSync("/src-dir/sub", { recursive: true });
fs.writeFileSync("/src-dir/a.txt", "a", "utf-8");
fs.writeFileSync("/src-dir/sub/b.txt", "b", "utf-8");
fs.cpSync("/src-dir", "/dest-dir", { recursive: true });

console.log(fs.readdirSync("/dest-dir"));
console.log(fs.readFileSync("/dest-dir/sub/b.txt", "utf-8"));`,
    async () => {
      fs.mkdirSync("/cpr-src/sub", { recursive: true });
      fs.writeFileSync("/cpr-src/a.txt", "aaa", "utf-8");
      fs.writeFileSync("/cpr-src/sub/b.txt", "bbb", "utf-8");
      fs.cpSync("/cpr-src", "/cpr-dest", { recursive: true });
      const entries = fs.readdirSync("/cpr-dest");
      const deep = fs.readFileSync("/cpr-dest/sub/b.txt", "utf-8");
      return `Entries: [${entries.join(", ")}]\nDeep copy: "${deep}"`;
    },
    (output) => {
      assertContains(output, "a.txt");
      assertContains(output, "sub");
      assertContains(output, 'Deep copy: "bbb"');
    }),

  implemented("fs.rm", "fs", `import fs from "@lifo-sh/node-compat/fs";

fs.mkdirSync("/rm-dir/sub", { recursive: true });
fs.writeFileSync("/rm-dir/sub/f.txt", "data", "utf-8");
fs.rmSync("/rm-dir", { recursive: true });
console.log(fs.existsSync("/rm-dir")); // false

// Force: no error if missing
fs.rmSync("/nonexistent", { force: true });`,
    async () => {
      fs.mkdirSync("/rm-t/sub", { recursive: true });
      fs.writeFileSync("/rm-t/sub/f.txt", "x", "utf-8");
      fs.rmSync("/rm-t", { recursive: true });
      let forceOk = false;
      try { fs.rmSync("/rm-t/nonexistent", { force: true }); forceOk = true; } catch {}
      return `Exists /rm-t: ${fs.existsSync("/rm-t")}\nForce no error: ${forceOk}`;
    },
    (output) => {
      assertContains(output, "Exists /rm-t: false");
      assertContains(output, "Force no error: true");
    }),

  implemented("fs.readdir", "fs", `import fs from "@lifo-sh/node-compat/fs";

fs.readdir("/mydir", (err, files) => {
  console.log(files);
});

const files = fs.readdirSync("/mydir");
const entries = await fs.promises.readdir("/mydir");`,
    async () => {
      fs.mkdirSync("/ls-test/sub", { recursive: true });
      fs.writeFileSync("/ls-test/a.txt", "a", "utf-8");
      fs.writeFileSync("/ls-test/b.txt", "b", "utf-8");
      const entries = fs.readdirSync("/ls-test");
      return `readdirSync("/ls-test"): [${entries.join(", ")}]`;
    },
    (output) => {
      assertContains(output, "a.txt");
      assertContains(output, "b.txt");
      assertContains(output, "sub");
    }),

  implemented("fs.mkdir", "fs", `import fs from "@lifo-sh/node-compat/fs";

fs.mkdir("/deep/nested/dir", { recursive: true }, (err) => {
  if (err) throw err;
});

fs.mkdirSync("/deep/nested/dir", { recursive: true });
await fs.promises.mkdir("/deep/nested/dir", { recursive: true });`,
    async () => {
      fs.mkdirSync("/mk-test/a/b/c", { recursive: true });
      const exists = fs.existsSync("/mk-test/a/b/c");
      const entries = fs.readdirSync("/mk-test/a/b");
      return `Created /mk-test/a/b/c: ${exists}\nreaddir /mk-test/a/b: [${entries.join(", ")}]`;
    },
    (output) => {
      assertContains(output, "Created /mk-test/a/b/c: true");
      assertContains(output, "c");
    }),

  implemented("fs.stat", "fs", `import fs from "@lifo-sh/node-compat/fs";

fs.stat("/file.txt", (err, stats) => {
  console.log(stats.isFile());
  console.log(stats.size);
});

const stats = fs.statSync("/file.txt");
const s = await fs.promises.stat("/file.txt");`,
    async () => {
      fs.mkdirSync("/stat-test", { recursive: true });
      fs.writeFileSync("/stat-test/data.bin", "12345", "utf-8");
      const stat = fs.statSync("/stat-test/data.bin");
      const dirStat = fs.statSync("/stat-test");
      return `isFile: ${stat.isFile()}, size: ${stat.size}\nisDirectory: ${dirStat.isDirectory()}`;
    },
    (output) => {
      assertContains(output, "isFile: true");
      assertContains(output, "size: 5");
      assertContains(output, "isDirectory: true");
    }),

  implemented("fs.lstat", "fs", `import fs from "@lifo-sh/node-compat/fs";

fs.symlinkSync("/target.txt", "/link.txt");
const lstat = fs.lstatSync("/link.txt");
console.log(lstat.isSymbolicLink()); // true

const stat = fs.statSync("/target.txt");
console.log(stat.isSymbolicLink()); // false`,
    async () => {
      fs.mkdirSync("/lst-test", { recursive: true });
      fs.writeFileSync("/lst-test/target.txt", "data", "utf-8");
      fs.symlinkSync("/lst-test/target.txt", "/lst-test/link.txt");
      const lst = fs.lstatSync("/lst-test/link.txt");
      const st = fs.statSync("/lst-test/target.txt");
      return `lstat isSymbolicLink: ${lst.isSymbolicLink()}\nstat isSymbolicLink: ${st.isSymbolicLink()}\nstat isFile: ${st.isFile()}`;
    },
    (output) => {
      assertContains(output, "lstat isSymbolicLink: true");
      assertContains(output, "stat isSymbolicLink: false");
      assertContains(output, "stat isFile: true");
    }),

  implemented("fs.fstat", "fs", `import fs from "@lifo-sh/node-compat/fs";

const fd = fs.openSync("/file.txt", "r");
const stat = fs.fstatSync(fd);
console.log(stat.isFile(), stat.size);
fs.closeSync(fd);`,
    async () => {
      fs.mkdirSync("/fst-test", { recursive: true });
      fs.writeFileSync("/fst-test/f.txt", "hello", "utf-8");
      const fd = fs.openSync("/fst-test/f.txt", "r");
      const stat = fs.fstatSync(fd);
      fs.closeSync(fd);
      return `isFile: ${stat.isFile()}, size: ${stat.size}`;
    },
    (output) => {
      assertContains(output, "isFile: true");
      assertContains(output, "size: 5");
    }),

  implemented("fs.unlink", "fs", `import fs from "@lifo-sh/node-compat/fs";

fs.unlink("/file.txt", (err) => {
  if (err) throw err;
});

fs.unlinkSync("/file.txt");
await fs.promises.unlink("/file.txt");`,
    async () => {
      fs.mkdirSync("/ul-test", { recursive: true });
      fs.writeFileSync("/ul-test/tmp.txt", "temp", "utf-8");
      const before = fs.existsSync("/ul-test/tmp.txt");
      fs.unlinkSync("/ul-test/tmp.txt");
      const after = fs.existsSync("/ul-test/tmp.txt");
      return `Before unlink: ${before}\nAfter unlink: ${after}`;
    },
    (output) => {
      assertContains(output, "Before unlink: true");
      assertContains(output, "After unlink: false");
    }),

  implemented("fs.rmdir", "fs", `import fs from "@lifo-sh/node-compat/fs";

fs.rmdir("/dir", { recursive: true }, (err) => {
  if (err) throw err;
});

fs.rmdirSync("/dir", { recursive: true });
await fs.promises.rmdir("/dir", { recursive: true });`,
    async () => {
      fs.mkdirSync("/rm-test/sub", { recursive: true });
      fs.writeFileSync("/rm-test/sub/f.txt", "x", "utf-8");
      fs.rmdirSync("/rm-test", { recursive: true });
      return `Exists /rm-test: ${fs.existsSync("/rm-test")}`;
    },
    (output) => {
      assertContains(output, "Exists /rm-test: false");
    }),

  implemented("fs.rename", "fs", `import fs from "@lifo-sh/node-compat/fs";

fs.rename("/old.txt", "/new.txt", (err) => {
  if (err) throw err;
});

fs.renameSync("/old.txt", "/new.txt");
await fs.promises.rename("/old.txt", "/new.txt");`,
    async () => {
      fs.mkdirSync("/ren-test", { recursive: true });
      fs.writeFileSync("/ren-test/before.txt", "content", "utf-8");
      fs.renameSync("/ren-test/before.txt", "/ren-test/after.txt");
      const content = fs.readFileSync("/ren-test/after.txt", "utf-8");
      return `Renamed. Content of after.txt: "${content}"\nOld exists: ${fs.existsSync("/ren-test/before.txt")}`;
    },
    (output) => {
      assertContains(output, 'Content of after.txt: "content"');
      assertContains(output, "Old exists: false");
    }),

  implemented("fs.existsSync", "fs", `import fs from "@lifo-sh/node-compat/fs";

if (fs.existsSync("/config.json")) {
  const config = fs.readFileSync("/config.json", "utf-8");
  console.log(config);
}`,
    async () => {
      fs.mkdirSync("/ex-test", { recursive: true });
      fs.writeFileSync("/ex-test/yes.txt", "here", "utf-8");
      return `existsSync("/ex-test/yes.txt"): ${fs.existsSync("/ex-test/yes.txt")}\nexistsSync("/ex-test/no.txt"): ${fs.existsSync("/ex-test/no.txt")}`;
    },
    (output) => {
      assertContains(output, 'existsSync("/ex-test/yes.txt"): true');
      assertContains(output, 'existsSync("/ex-test/no.txt"): false');
    }),

  implemented("fs.access", "fs", `import fs from "@lifo-sh/node-compat/fs";

fs.access("/file.txt", (err) => {
  if (err) console.log("does not exist");
  else console.log("exists");
});

await fs.promises.access("/file.txt");`,
    async () => {
      fs.mkdirSync("/acc-test", { recursive: true });
      fs.writeFileSync("/acc-test/present.txt", "x", "utf-8");
      let present = "";
      let absent = "";
      await new Promise<void>((resolve) => {
        fs.access("/acc-test/present.txt", (err) => { present = err ? "error" : "ok"; resolve(); });
      });
      await new Promise<void>((resolve) => {
        fs.access("/acc-test/missing.txt", (err) => { absent = err ? "not found" : "ok"; resolve(); });
      });
      return `access("/acc-test/present.txt"): ${present}\naccess("/acc-test/missing.txt"): ${absent}`;
    },
    (output) => {
      assertContains(output, 'access("/acc-test/present.txt"): ok');
      assertContains(output, 'access("/acc-test/missing.txt"): not found');
    }),

  implemented("fs.chmod", "fs", `import fs from "@lifo-sh/node-compat/fs";

// VFS does not enforce permissions - chmod is a no-op
fs.chmodSync("/file.txt", 0o755);
await fs.promises.chmod("/file.txt", 0o644);`,
    async () => {
      fs.mkdirSync("/chmod-test", { recursive: true });
      fs.writeFileSync("/chmod-test/f.txt", "x", "utf-8");
      fs.chmodSync("/chmod-test/f.txt", 0o755);
      let ok = false;
      try { await fs.promises.chmod("/chmod-test/f.txt", 0o644); ok = true; } catch {}
      return `chmodSync: no error\npromises.chmod: ${ok ? "no error" : "error"}`;
    },
    (output) => {
      assertContains(output, "chmodSync: no error");
      assertContains(output, "promises.chmod: no error");
    }),

  implemented("fs.chown", "fs", `import fs from "@lifo-sh/node-compat/fs";

// VFS does not enforce ownership - chown is a no-op
fs.chownSync("/file.txt", 1000, 1000);
await fs.promises.chown("/file.txt", 1000, 1000);`,
    async () => {
      fs.mkdirSync("/chown-test", { recursive: true });
      fs.writeFileSync("/chown-test/f.txt", "x", "utf-8");
      fs.chownSync("/chown-test/f.txt", 1000, 1000);
      let ok = false;
      try { await fs.promises.chown("/chown-test/f.txt", 1000, 1000); ok = true; } catch {}
      return `chownSync: no error\npromises.chown: ${ok ? "no error" : "error"}`;
    },
    (output) => {
      assertContains(output, "chownSync: no error");
      assertContains(output, "promises.chown: no error");
    }),

  implemented("fs.link", "fs", `import fs from "@lifo-sh/node-compat/fs";

fs.writeFileSync("/original.txt", "data", "utf-8");
fs.linkSync("/original.txt", "/linked.txt");
console.log(fs.readFileSync("/linked.txt", "utf-8")); // "data"`,
    async () => {
      fs.mkdirSync("/lnk-test", { recursive: true });
      fs.writeFileSync("/lnk-test/orig.txt", "linked data", "utf-8");
      fs.linkSync("/lnk-test/orig.txt", "/lnk-test/link.txt");
      const content = fs.readFileSync("/lnk-test/link.txt", "utf-8");
      return `Linked content: "${content}"`;
    },
    (output) => {
      assertContains(output, 'Linked content: "linked data"');
    }),

  implemented("fs.symlink", "fs", `import fs from "@lifo-sh/node-compat/fs";

fs.writeFileSync("/target.txt", "target data", "utf-8");
fs.symlinkSync("/target.txt", "/sym.txt");
console.log(fs.readlinkSync("/sym.txt")); // "/target.txt"`,
    async () => {
      fs.mkdirSync("/sym-test", { recursive: true });
      fs.writeFileSync("/sym-test/target.txt", "sym data", "utf-8");
      fs.symlinkSync("/sym-test/target.txt", "/sym-test/sym.txt");
      const target = fs.readlinkSync("/sym-test/sym.txt");
      return `Symlink target: "${target}"`;
    },
    (output) => {
      assertContains(output, 'Symlink target: "/sym-test/target.txt"');
    }),

  implemented("fs.readlink", "fs", `import fs from "@lifo-sh/node-compat/fs";

fs.symlinkSync("/real/path", "/link");
const target = fs.readlinkSync("/link");
console.log(target); // "/real/path"

const t = await fs.promises.readlink("/link");`,
    async () => {
      fs.mkdirSync("/rl-test", { recursive: true });
      fs.writeFileSync("/rl-test/file.txt", "x", "utf-8");
      fs.symlinkSync("/rl-test/file.txt", "/rl-test/lnk");
      const sync = fs.readlinkSync("/rl-test/lnk");
      const promise = await fs.promises.readlink("/rl-test/lnk");
      return `readlinkSync: "${sync}"\npromises.readlink: "${promise}"`;
    },
    (output) => {
      assertContains(output, 'readlinkSync: "/rl-test/file.txt"');
      assertContains(output, 'promises.readlink: "/rl-test/file.txt"');
    }),

  implemented("fs.realpath", "fs", `import fs from "@lifo-sh/node-compat/fs";

const real = fs.realpathSync("/some/../normalized/path");
console.log(real);

const r = await fs.promises.realpath("/some/../normalized/path");`,
    async () => {
      fs.mkdirSync("/rp-test/sub", { recursive: true });
      fs.writeFileSync("/rp-test/sub/file.txt", "x", "utf-8");
      const real = fs.realpathSync("/rp-test/sub/../sub/file.txt");
      return `realpath: "${real}"`;
    },
    (output) => {
      assertContains(output, 'realpath: "/rp-test/sub/file.txt"');
    }),

  implemented("fs.mkdtemp", "fs", `import fs from "@lifo-sh/node-compat/fs";

const dir = fs.mkdtempSync("/tmp/prefix-");
console.log(dir); // "/tmp/prefix-a1b2c3"

const d = await fs.promises.mkdtemp("/tmp/prefix-");`,
    async () => {
      fs.mkdirSync("/tmp", { recursive: true });
      const dir = fs.mkdtempSync("/tmp/test-");
      const exists = fs.existsSync(dir);
      return `Created: "${dir}"\nStarts with /tmp/test-: ${dir.startsWith("/tmp/test-")}\nExists: ${exists}`;
    },
    (output) => {
      assertContains(output, "Starts with /tmp/test-: true");
      assertContains(output, "Exists: true");
    }),

  implemented("fs.truncate", "fs", `import fs from "@lifo-sh/node-compat/fs";

fs.writeFileSync("/file.txt", "Hello, World!", "utf-8");
fs.truncateSync("/file.txt", 5);
console.log(fs.readFileSync("/file.txt", "utf-8")); // "Hello"`,
    async () => {
      fs.mkdirSync("/tr-test", { recursive: true });
      fs.writeFileSync("/tr-test/f.txt", "Hello, World!", "utf-8");
      fs.truncateSync("/tr-test/f.txt", 5);
      const content = fs.readFileSync("/tr-test/f.txt", "utf-8");
      return `Truncated: "${content}" (length: ${content.length})`;
    },
    (output) => {
      assertContains(output, 'Truncated: "Hello"');
      assertContains(output, "length: 5");
    }),

  implemented("fs.open", "fs", `import fs from "@lifo-sh/node-compat/fs";

const fd = fs.openSync("/file.txt", "w");
fs.writeSync(fd, "Hello from fd!");
fs.closeSync(fd);

const content = fs.readFileSync("/file.txt", "utf-8");`,
    async () => {
      fs.mkdirSync("/op-test", { recursive: true });
      const fd = fs.openSync("/op-test/fd.txt", "w");
      fs.writeSync(fd, "written via fd");
      fs.closeSync(fd);
      const content = fs.readFileSync("/op-test/fd.txt", "utf-8");
      return `Content: "${content}"`;
    },
    (output) => {
      assertContains(output, 'Content: "written via fd"');
    }),

  implemented("fs.close", "fs", `import fs from "@lifo-sh/node-compat/fs";

const fd = fs.openSync("/file.txt", "r");
// ... do work ...
fs.closeSync(fd);

// Async:
fs.close(fd, (err) => { /* handle error */ });`,
    async () => {
      fs.mkdirSync("/cl-test", { recursive: true });
      fs.writeFileSync("/cl-test/f.txt", "x", "utf-8");
      const fd = fs.openSync("/cl-test/f.txt", "r");
      fs.closeSync(fd);
      let errAfterClose = false;
      try { fs.closeSync(fd); } catch { errAfterClose = true; }
      return `Closed successfully\nError on double close: ${errAfterClose}`;
    },
    (output) => {
      assertContains(output, "Closed successfully");
      assertContains(output, "Error on double close: true");
    }),

  implemented("fs.read", "fs", `import fs from "@lifo-sh/node-compat/fs";

const fd = fs.openSync("/file.txt", "r");
const buf = new Uint8Array(10);
const bytesRead = fs.readSync(fd, buf, 0, 10, 0);
fs.closeSync(fd);`,
    async () => {
      fs.mkdirSync("/frd-test", { recursive: true });
      fs.writeFileSync("/frd-test/f.txt", "Hello, World!", "utf-8");
      const fd = fs.openSync("/frd-test/f.txt", "r");
      const buf = new Uint8Array(5);
      const bytesRead = fs.readSync(fd, buf, 0, 5, 0);
      fs.closeSync(fd);
      const text = new TextDecoder().decode(buf);
      return `Read ${bytesRead} bytes: "${text}"`;
    },
    (output) => {
      assertContains(output, "Read 5 bytes");
      assertContains(output, '"Hello"');
    }),

  implemented("fs.write", "fs", `import fs from "@lifo-sh/node-compat/fs";

const fd = fs.openSync("/file.txt", "w");
const written = fs.writeSync(fd, "Hello!");
fs.closeSync(fd);
console.log(\`Wrote \${written} bytes\`);`,
    async () => {
      fs.mkdirSync("/fwr-test", { recursive: true });
      const fd = fs.openSync("/fwr-test/f.txt", "w");
      const written = fs.writeSync(fd, "Hi there!");
      fs.closeSync(fd);
      const content = fs.readFileSync("/fwr-test/f.txt", "utf-8");
      return `Wrote ${written} bytes\nContent: "${content}"`;
    },
    (output) => {
      assertContains(output, "Wrote 9 bytes");
      assertContains(output, 'Content: "Hi there!"');
    }),

  implemented("fs.createReadStream", "fs", `import fs from "@lifo-sh/node-compat/fs";

const stream = fs.createReadStream("/file.txt", { encoding: "utf-8" });
stream.on("data", (chunk) => console.log(chunk));
stream.on("end", () => console.log("done"));`,
    async () => {
      fs.mkdirSync("/crs-test", { recursive: true });
      fs.writeFileSync("/crs-test/f.txt", "streamed content", "utf-8");
      return new Promise<string>((resolve) => {
        const chunks: string[] = [];
        const stream = fs.createReadStream("/crs-test/f.txt", { encoding: "utf-8" });
        stream.on("data", (chunk: string) => chunks.push(chunk));
        stream.on("end", () => resolve(`Chunks: ${chunks.length}\nData: "${chunks.join("")}"`));
      });
    },
    (output) => {
      assertContains(output, "Chunks: 1");
      assertContains(output, 'Data: "streamed content"');
    }),

  implemented("fs.createWriteStream", "fs", `import fs from "@lifo-sh/node-compat/fs";

const stream = fs.createWriteStream("/file.txt");
stream.write("Hello ");
stream.end("World!");
stream.on("finish", () => console.log("done"));`,
    async () => {
      fs.mkdirSync("/cws-test", { recursive: true });
      return new Promise<string>((resolve) => {
        const stream = fs.createWriteStream("/cws-test/f.txt");
        stream.write("Hello ");
        stream.end("World!");
        stream.on("finish", () => {
          const content = fs.readFileSync("/cws-test/f.txt", "utf-8");
          resolve(`Written: "${content}"`);
        });
      });
    },
    (output) => {
      assertContains(output, 'Written: "Hello World!"');
    }),

  implemented("fs.opendir", "fs", `import fs from "@lifo-sh/node-compat/fs";

const dir = await fs.promises.opendir("/mydir");
for await (const dirent of dir) {
  console.log(dirent.name, dirent.isFile());
}`,
    async () => {
      fs.mkdirSync("/od-test/sub", { recursive: true });
      fs.writeFileSync("/od-test/a.txt", "a", "utf-8");
      fs.writeFileSync("/od-test/b.txt", "b", "utf-8");
      const dir = await fs.promises.opendir("/od-test");
      const entries: string[] = [];
      for await (const dirent of dir) {
        entries.push(`${dirent.name} (file: ${dirent.isFile()}, dir: ${dirent.isDirectory()})`);
      }
      return `Entries:\n${entries.map(e => `  ${e}`).join("\n")}`;
    },
    (output) => {
      assertContains(output, "a.txt (file: true, dir: false)");
      assertContains(output, "sub (file: false, dir: true)");
    }),

  implemented("fs.glob", "fs", `import fs from "@lifo-sh/node-compat/fs";

const matches = await fs.promises.glob("/**/*.txt");
console.log(matches);`,
    async () => {
      fs.mkdirSync("/gl-test/sub", { recursive: true });
      fs.writeFileSync("/gl-test/a.txt", "a", "utf-8");
      fs.writeFileSync("/gl-test/b.js", "b", "utf-8");
      fs.writeFileSync("/gl-test/sub/c.txt", "c", "utf-8");
      const matches = fs.globSync("/**/*.txt");
      const txtOnly = matches.filter(m => m.includes("gl-test"));
      return `Matches: [${txtOnly.join(", ")}]`;
    },
    (output) => {
      assertContains(output, "a.txt");
      assertContains(output, "c.txt");
      assert(!output.includes("b.js"), "should not match .js files");
    }),

  implemented("fs.statfs", "fs", `import fs from "@lifo-sh/node-compat/fs";

const stats = fs.statfsSync("/");
console.log(stats.bsize); // 4096`,
    async () => {
      const stats = fs.statfsSync("/");
      return `bsize: ${stats.bsize}\nblocks: ${stats.blocks}\nbfree: ${stats.bfree}`;
    },
    (output) => {
      assertContains(output, "bsize: 4096");
      assertContains(output, "blocks:");
    }),

  implemented("fs.utimes", "fs", `import fs from "@lifo-sh/node-compat/fs";

fs.writeFileSync("/file.txt", "data", "utf-8");
fs.utimesSync("/file.txt", 1000, 2000);
const stat = fs.statSync("/file.txt");
console.log(stat.mtimeMs); // updated`,
    async () => {
      fs.mkdirSync("/ut-test", { recursive: true });
      fs.writeFileSync("/ut-test/f.txt", "data", "utf-8");
      const before = fs.statSync("/ut-test/f.txt").mtimeMs;
      fs.utimesSync("/ut-test/f.txt", 1000, 2000);
      const after = fs.statSync("/ut-test/f.txt").mtimeMs;
      return `Before: ${before}\nAfter: ${after}\nChanged: ${before !== after}`;
    },
    (output) => {
      assertContains(output, "Changed: true");
    }),

  implemented("fs.lutimes", "fs", `import fs from "@lifo-sh/node-compat/fs";

fs.lutimesSync("/file.txt", 1000, 2000);
await fs.promises.lutimes("/file.txt", 1000, 2000);`,
    async () => {
      fs.mkdirSync("/lut-test", { recursive: true });
      fs.writeFileSync("/lut-test/f.txt", "data", "utf-8");
      fs.lutimesSync("/lut-test/f.txt", 1000, 2000);
      const stat = fs.statSync("/lut-test/f.txt");
      return `mtimeMs after lutimes: ${stat.mtimeMs}\nUpdated: ${stat.mtimeMs === 2000000}`;
    },
    (output) => {
      assertContains(output, "Updated: true");
    }),

  implemented("fs.unwatchFile", "fs", `import fs from "@lifo-sh/node-compat/fs";

// unwatchFile is a no-op stub (VFS watchers use handle.close())
fs.unwatchFile("/file.txt");`,
    async () => {
      fs.unwatchFile("/nonexistent");
      return `unwatchFile: no error (no-op stub)`;
    },
    (output) => {
      assertContains(output, "no error");
    }),

  implemented("fs.watch", "fs", `import fs from "@lifo-sh/node-compat/fs";

const watcher = fs.watch("/dir", (eventType, filename) => {
  console.log(eventType, filename);
});

// Later:
watcher.close();`,
    async () => {
      fs.mkdirSync("/w-test", { recursive: true });
      const events: string[] = [];
      const watcher = fs.watch("/w-test", (eventType, filename) => {
        events.push(`${eventType}: ${filename}`);
      });
      fs.writeFileSync("/w-test/a.txt", "a", "utf-8");
      fs.writeFileSync("/w-test/a.txt", "b", "utf-8");
      watcher.close();
      return `Events: ${JSON.stringify(events)}`;
    },
    (output) => {
      assertContains(output, "change:");
    }),

  implemented("fs.watchFile", "fs", `import fs from "@lifo-sh/node-compat/fs";

const handle = fs.watchFile("/file.txt", (curr, prev) => {
  console.log("size changed:", prev.size, "=>", curr.size);
});

handle.close();`,
    async () => {
      fs.mkdirSync("/wf-test", { recursive: true });
      fs.writeFileSync("/wf-test/f.txt", "initial", "utf-8");
      const sizes: string[] = [];
      const handle = fs.watchFile("/wf-test/f.txt", (curr, prev) => {
        sizes.push(`${prev.size} => ${curr.size}`);
      });
      fs.writeFileSync("/wf-test/f.txt", "updated content!!", "utf-8");
      handle.close();
      return `Size changes: [${sizes.join(", ")}]`;
    },
    (output) => {
      assertContains(output, "=>");
    }),

  // ━━━ path ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  implemented("path.join", "path", `import path from "@lifo-sh/node-compat/path";

path.join("/home", "user", "docs");
// => "/home/user/docs"

path.join("foo", "..", "bar", "baz");
// => "bar/baz"`,
    async () => {
      return [
        `path.join("/home", "user", "docs")`,
        `  => "${path.join("/home", "user", "docs")}"`,
        ``,
        `path.join("foo", "..", "bar", "baz")`,
        `  => "${path.join("foo", "..", "bar", "baz")}"`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "/home/user/docs");
      assertContains(output, "bar/baz");
    }),

  implemented("path.resolve", "path", `import path from "@lifo-sh/node-compat/path";

path.resolve("foo", "bar");
// => "/foo/bar"

path.resolve("/a", "b", "../c");
// => "/a/c"`,
    async () => {
      return [
        `path.resolve("foo", "bar")`,
        `  => "${path.resolve("foo", "bar")}"`,
        ``,
        `path.resolve("/a", "b", "../c")`,
        `  => "${path.resolve("/a", "b", "../c")}"`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "/foo/bar");
      assertContains(output, "/a/c");
    }),

  implemented("path.normalize", "path", `import path from "@lifo-sh/node-compat/path";

path.normalize("/foo/bar//baz/asdf/quux/..");
// => "/foo/bar/baz/asdf"`,
    async () => {
      return [
        `path.normalize("/foo/bar//baz/asdf/quux/..")`,
        `  => "${path.normalize("/foo/bar//baz/asdf/quux/..")}"`,
        ``,
        `path.normalize("foo/./bar/../baz")`,
        `  => "${path.normalize("foo/./bar/../baz")}"`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "/foo/bar/baz/asdf");
      assertContains(output, "foo/baz");
    }),

  implemented("path.isAbsolute", "path", `import path from "@lifo-sh/node-compat/path";

path.isAbsolute("/foo/bar"); // true
path.isAbsolute("foo/bar");  // false`,
    async () => {
      return [
        `path.isAbsolute("/foo/bar"): ${path.isAbsolute("/foo/bar")}`,
        `path.isAbsolute("foo/bar"): ${path.isAbsolute("foo/bar")}`,
        `path.isAbsolute("."): ${path.isAbsolute(".")}`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, 'isAbsolute("/foo/bar"): true');
      assertContains(output, 'isAbsolute("foo/bar"): false');
    }),

  implemented("path.dirname", "path", `import path from "@lifo-sh/node-compat/path";

path.dirname("/home/user/file.txt");
// => "/home/user"`,
    async () => {
      return [
        `path.dirname("/home/user/file.txt")`,
        `  => "${path.dirname("/home/user/file.txt")}"`,
        ``,
        `path.dirname("/root")`,
        `  => "${path.dirname("/root")}"`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "/home/user");
    }),

  implemented("path.basename", "path", `import path from "@lifo-sh/node-compat/path";

path.basename("/home/user/file.txt");
// => "file.txt"

path.basename("/home/user/file.txt", ".txt");
// => "file"`,
    async () => {
      return [
        `path.basename("/home/user/file.txt")`,
        `  => "${path.basename("/home/user/file.txt")}"`,
        ``,
        `path.basename("/home/user/file.txt", ".txt")`,
        `  => "${path.basename("/home/user/file.txt", ".txt")}"`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "file.txt");
      assertContains(output, '"file"');
    }),

  implemented("path.extname", "path", `import path from "@lifo-sh/node-compat/path";

path.extname("index.html");  // => ".html"
path.extname("index.");      // => "."
path.extname("index");       // => ""
path.extname(".hidden");     // => ""`,
    async () => {
      return [
        `path.extname("index.html"): "${path.extname("index.html")}"`,
        `path.extname("index."): "${path.extname("index.")}"`,
        `path.extname("index"): "${path.extname("index")}"`,
        `path.extname(".hidden"): "${path.extname(".hidden")}"`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, '".html"');
      assertContains(output, '"."');
      assertContains(output, '""');
    }),

  implemented("path.parse", "path", `import path from "@lifo-sh/node-compat/path";

const parsed = path.parse("/home/user/file.txt");
// => { root: "/", dir: "/home/user", base: "file.txt",
//      ext: ".txt", name: "file" }`,
    async () => {
      const parsed = path.parse("/home/user/file.txt");
      return `path.parse("/home/user/file.txt")\n${JSON.stringify(parsed, null, 2)}`;
    },
    (output) => {
      assertContains(output, '"root": "/"');
      assertContains(output, '"dir": "/home/user"');
      assertContains(output, '"base": "file.txt"');
      assertContains(output, '"ext": ".txt"');
      assertContains(output, '"name": "file"');
    }),

  implemented("path.format", "path", `import path from "@lifo-sh/node-compat/path";

path.format({
  root: "/",
  dir: "/home/user",
  base: "file.txt",
});
// => "/home/user/file.txt"`,
    async () => {
      const result = path.format({ root: "/", dir: "/home/user", base: "file.txt" });
      return `path.format({ root: "/", dir: "/home/user", base: "file.txt" })\n  => "${result}"`;
    },
    (output) => {
      assertContains(output, "/home/user/file.txt");
    }),

  implemented("path.relative", "path", `import path from "@lifo-sh/node-compat/path";

path.relative("/a/b/c", "/a/d");
// => "../../d"

path.relative("/a/b", "/a/b/c/d");
// => "c/d"`,
    async () => {
      return [
        `path.relative("/a/b/c", "/a/d")`,
        `  => "${path.relative("/a/b/c", "/a/d")}"`,
        ``,
        `path.relative("/a/b", "/a/b/c/d")`,
        `  => "${path.relative("/a/b", "/a/b/c/d")}"`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "../../d");
      assertContains(output, "c/d");
    }),

  implemented("path.sep / path.delimiter", "path", `import path from "@lifo-sh/node-compat/path";

path.sep;       // => "/"
path.delimiter; // => ":"`,
    async () => {
      return `path.sep: "${path.sep}"\npath.delimiter: "${path.delimiter}"`;
    },
    (output) => {
      assertContains(output, 'path.sep: "/"');
      assertContains(output, 'path.delimiter: ":"');
    }),

  implemented("path.posix", "path", `import path from "@lifo-sh/node-compat/path";

// path.posix is the same as path (posix-only implementation)
path.posix.join("/home", "user");
// => "/home/user"

path.posix.sep; // => "/"`,
    async () => {
      const joined = path.posix.join("/home", "user");
      return `path.posix.join: "${joined}"\npath.posix.sep: "${path.posix.sep}"\nSame as path: ${path.posix === path}`;
    },
    (output) => {
      assertContains(output, 'path.posix.join: "/home/user"');
      assertContains(output, 'path.posix.sep: "/"');
      assertContains(output, "Same as path: true");
    }),

  implemented("path.win32", "path", `import path from "@lifo-sh/node-compat/path";

// path.win32 mirrors posix in this browser polyfill
path.win32.join("/home", "user");
// => "/home/user"`,
    async () => {
      const joined = path.win32.join("/home", "user");
      return `path.win32.join: "${joined}"\npath.win32.sep: "${path.win32.sep}"`;
    },
    (output) => {
      assertContains(output, 'path.win32.join: "/home/user"');
      assertContains(output, 'path.win32.sep: "/"');
    }),

  implemented("path.toNamespacedPath", "path", `import path from "@lifo-sh/node-compat/path";

// On posix, toNamespacedPath returns the path unchanged
path.toNamespacedPath("/home/user");
// => "/home/user"`,
    async () => {
      const result = path.toNamespacedPath("/home/user");
      return `toNamespacedPath("/home/user"): "${result}"`;
    },
    (output) => {
      assertContains(output, 'toNamespacedPath("/home/user"): "/home/user"');
    }),

  // ━━━ events ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  implemented("EventEmitter", "events", `import { EventEmitter } from "@lifo-sh/node-compat/events";

const ee = new EventEmitter();
ee.on("hello", (name) => console.log("Hello " + name));
ee.emit("hello", "world");`,
    async () => {
      const ee = new EventEmitter();
      const results: string[] = [];
      ee.on("hello", (name: string) => results.push(`Hello ${name}`));
      ee.emit("hello", "world");
      ee.emit("hello", "browser");
      return results.join("\n");
    },
    (output) => {
      assertContains(output, "Hello world");
      assertContains(output, "Hello browser");
    }),

  implemented("once (EventEmitter)", "events", `import { EventEmitter } from "@lifo-sh/node-compat/events";

const ee = new EventEmitter();
ee.once("init", () => console.log("initialized"));
ee.emit("init"); // fires
ee.emit("init"); // does not fire`,
    async () => {
      const ee = new EventEmitter();
      let count = 0;
      ee.once("init", () => count++);
      ee.emit("init");
      ee.emit("init");
      return `once listener fired: ${count} time(s)`;
    },
    (output) => {
      assertContains(output, "1 time(s)");
    }),

  implemented("removeListener / off", "events", `import { EventEmitter } from "@lifo-sh/node-compat/events";

const ee = new EventEmitter();
const fn = () => console.log("tick");
ee.on("tick", fn);
ee.off("tick", fn);
ee.emit("tick"); // does not fire`,
    async () => {
      const ee = new EventEmitter();
      let fired = false;
      const fn = () => { fired = true; };
      ee.on("tick", fn);
      ee.off("tick", fn);
      ee.emit("tick");
      return `Listener fired after off: ${fired}\nlistenerCount: ${ee.listenerCount("tick")}`;
    },
    (output) => {
      assertContains(output, "Listener fired after off: false");
      assertContains(output, "listenerCount: 0");
    }),

  // ━━━ buffer ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  implemented("Buffer.from", "buffer", `import { Buffer } from "@lifo-sh/node-compat/buffer";

const buf = Buffer.from("Hello, Buffer!");
console.log(buf.toString());
console.log(buf.toString("hex"));`,
    async () => {
      const buf = Buffer.from("Hello, Buffer!");
      return [
        `toString(): ${buf.toString()}`,
        `toString("hex"): ${buf.toString("hex")}`,
        `length: ${buf.length}`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "Hello, Buffer!");
      assertContains(output, "toString(\"hex\"):");
      assertContains(output, "length: 14");
    }),

  implemented("Buffer.alloc", "buffer", `import { Buffer } from "@lifo-sh/node-compat/buffer";

const buf = Buffer.alloc(10, 0xff);
console.log(buf.length); // 10`,
    async () => {
      const buf = Buffer.alloc(10, 0xff);
      return [
        `length: ${buf.length}`,
        `first byte: ${buf[0]}`,
        `last byte: ${buf[9]}`,
        `hex: ${buf.toString("hex")}`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "length: 10");
      assertContains(output, "first byte: 255");
      assertContains(output, "ffffffffffffffffffff");
    }),

  implemented("Buffer.concat", "buffer", `import { Buffer } from "@lifo-sh/node-compat/buffer";

const a = Buffer.from("Hello ");
const b = Buffer.from("World");
const c = Buffer.concat([a, b]);
console.log(c.toString()); // "Hello World"`,
    async () => {
      const a = Buffer.from("Hello ");
      const b = Buffer.from("World");
      const c = Buffer.concat([a, b]);
      return [
        `concat: ${c.toString()}`,
        `length: ${c.length}`,
        `isBuffer: ${Buffer.isBuffer(c)}`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "concat: Hello World");
      assertContains(output, "length: 11");
      assertContains(output, "isBuffer: true");
    }),

  implemented("Buffer.isBuffer", "buffer", `import { Buffer } from "@lifo-sh/node-compat/buffer";

Buffer.isBuffer(Buffer.from("x")); // true
Buffer.isBuffer(new Uint8Array(1)); // false
Buffer.isBuffer("string");         // false`,
    async () => {
      return [
        `Buffer.from("x"): ${Buffer.isBuffer(Buffer.from("x"))}`,
        `Uint8Array: ${Buffer.isBuffer(new Uint8Array(1))}`,
        `string: ${Buffer.isBuffer("string")}`,
        `null: ${Buffer.isBuffer(null)}`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, 'Buffer.from("x"): true');
      assertContains(output, "Uint8Array: false");
      assertContains(output, "string: false");
    }),

  // ━━━ process ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  implemented("process.env / cwd / argv", "process", `import process from "@lifo-sh/node-compat/process";

console.log(process.platform); // "browser"
console.log(process.cwd());    // "/"
console.log(process.argv);     // ["node", "script.js"]`,
    async () => {
      return [
        `platform: ${process.platform}`,
        `arch: ${process.arch}`,
        `cwd: ${process.cwd()}`,
        `argv: ${JSON.stringify(process.argv)}`,
        `pid: ${process.pid}`,
        `version: ${process.version}`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "platform: browser");
      assertContains(output, "cwd: /");
      assertContains(output, "argv:");
    }),

  implemented("process.nextTick", "process", `import process from "@lifo-sh/node-compat/process";

process.nextTick(() => console.log("tick!"));`,
    async () => {
      return await new Promise<string>((resolve) => {
        const order: string[] = [];
        order.push("1:before");
        process.nextTick(() => {
          order.push("3:nextTick");
          resolve(order.join("\n"));
        });
        order.push("2:after");
      });
    },
    (output) => {
      assertContains(output, "1:before");
      assertContains(output, "2:after");
      assertContains(output, "3:nextTick");
    }),

  implemented("process.hrtime / uptime", "process", `import process from "@lifo-sh/node-compat/process";

const start = process.hrtime();
// ... do work ...
const diff = process.hrtime(start);
console.log(diff); // [seconds, nanoseconds]`,
    async () => {
      const start = process.hrtime();
      const up = process.uptime();
      const diff = process.hrtime(start);
      return [
        `hrtime: [${start[0]}, ${start[1]}]`,
        `diff: [${diff[0]}, ${diff[1]}]`,
        `uptime: ${typeof up === "number" && up >= 0 ? "valid" : "invalid"}`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "hrtime: [");
      assertContains(output, "diff: [");
      assertContains(output, "uptime: valid");
    }),

  // ━━━ util ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  implemented("util.promisify", "util", `import util from "@lifo-sh/node-compat/util";

function asyncOp(x, cb) { cb(null, x * 2); }
const promiseOp = util.promisify(asyncOp);
const result = await promiseOp(21);
console.log(result); // 42`,
    async () => {
      function asyncOp(x: number, cb: (err: Error | null, result?: number) => void) {
        cb(null, x * 2);
      }
      const promiseOp = util.promisify(asyncOp as any);
      const result = await promiseOp(21);
      return `promisify result: ${result}`;
    },
    (output) => {
      assertContains(output, "promisify result: 42");
    }),

  implemented("util.inspect", "util", `import util from "@lifo-sh/node-compat/util";

console.log(util.inspect({ a: 1, b: [2, 3] }));
// => "{ a: 1, b: [ 2, 3 ] }"`,
    async () => {
      return [
        `object: ${util.inspect({ a: 1, b: [2, 3] })}`,
        `string: ${util.inspect("hello")}`,
        `array: ${util.inspect([1, "two", true])}`,
        `null: ${util.inspect(null)}`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "a: 1");
      assertContains(output, "'hello'");
      assertContains(output, "null: null");
    }),

  implemented("util.format", "util", `import util from "@lifo-sh/node-compat/util";

util.format("%s has %d items", "list", 3);
// => "list has 3 items"`,
    async () => {
      return [
        util.format("%s has %d items", "list", 3),
        util.format("hello %s", "world"),
        util.format("pi is %f", 3.14),
        util.format("json: %j", { x: 1 }),
        util.format("100%%"),
      ].join("\n");
    },
    (output) => {
      assertContains(output, "list has 3 items");
      assertContains(output, "hello world");
      assertContains(output, "100%");
    }),

  implemented("util.isDeepStrictEqual", "util", `import util from "@lifo-sh/node-compat/util";

util.isDeepStrictEqual({ a: 1 }, { a: 1 }); // true
util.isDeepStrictEqual({ a: 1 }, { a: 2 }); // false`,
    async () => {
      return [
        `{a:1} === {a:1}: ${util.isDeepStrictEqual({ a: 1 }, { a: 1 })}`,
        `{a:1} === {a:2}: ${util.isDeepStrictEqual({ a: 1 }, { a: 2 })}`,
        `[1,2] === [1,2]: ${util.isDeepStrictEqual([1, 2], [1, 2])}`,
        `[1,2] === [1,3]: ${util.isDeepStrictEqual([1, 2], [1, 3])}`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "{a:1} === {a:1}: true");
      assertContains(output, "{a:1} === {a:2}: false");
      assertContains(output, "[1,2] === [1,2]: true");
      assertContains(output, "[1,2] === [1,3]: false");
    }),

  implemented("TextEncoder / TextDecoder", "util", `import { TextEncoder, TextDecoder } from "@lifo-sh/node-compat/util";

const encoded = new TextEncoder().encode("Hello");
const decoded = new TextDecoder().decode(encoded);`,
    async () => {
      const { TextEncoder, TextDecoder } = util;
      const encoded = new TextEncoder().encode("Hello");
      const decoded = new TextDecoder().decode(encoded);
      return [
        `encoded length: ${encoded.length}`,
        `decoded: ${decoded}`,
        `roundtrip: ${decoded === "Hello"}`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "encoded length: 5");
      assertContains(output, "decoded: Hello");
      assertContains(output, "roundtrip: true");
    }),

  // ━━━ timers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  implemented("setTimeout / setInterval", "timers", `import { setTimeout, clearTimeout } from "@lifo-sh/node-compat/timers";

const id = setTimeout(() => console.log("done"), 100);
clearTimeout(id);`,
    async () => {
      return await new Promise<string>((resolve) => {
        const results: string[] = [];
        timers.setTimeout(() => {
          results.push("setTimeout fired");
          resolve(results.join("\n"));
        }, 10);
        results.push("scheduled");
      });
    },
    (output) => {
      assertContains(output, "scheduled");
      assertContains(output, "setTimeout fired");
    }),

  implemented("setImmediate", "timers", `import { setImmediate } from "@lifo-sh/node-compat/timers";

setImmediate(() => console.log("immediate!"));`,
    async () => {
      return await new Promise<string>((resolve) => {
        const order: string[] = [];
        order.push("1:before");
        timers.setImmediate(() => {
          order.push("3:immediate");
          resolve(order.join("\n"));
        });
        order.push("2:after");
      });
    },
    (output) => {
      assertContains(output, "1:before");
      assertContains(output, "2:after");
      assertContains(output, "3:immediate");
    }),

  // ━━━ assert ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  implemented("assert / assert.ok", "assert", `import assert from "@lifo-sh/node-compat/assert";

assert(true);       // passes
assert.ok(1);       // passes
assert.ok(0);       // throws AssertionError`,
    async () => {
      const results: string[] = [];
      try { assertModule(true); results.push("assert(true): pass"); } catch { results.push("assert(true): fail"); }
      try { assertModule.ok(1); results.push("ok(1): pass"); } catch { results.push("ok(1): fail"); }
      try { assertModule.ok(0); results.push("ok(0): pass"); } catch { results.push("ok(0): throws"); }
      return results.join("\n");
    },
    (output) => {
      assertContains(output, "assert(true): pass");
      assertContains(output, "ok(1): pass");
      assertContains(output, "ok(0): throws");
    }),

  implemented("assert.strictEqual / notStrictEqual", "assert", `import assert from "@lifo-sh/node-compat/assert";

assert.strictEqual(1, 1);     // passes
assert.strictEqual(1, "1");   // throws`,
    async () => {
      const results: string[] = [];
      try { assertModule.strictEqual(1, 1); results.push("strictEqual(1,1): pass"); } catch { results.push("strictEqual(1,1): fail"); }
      try { assertModule.strictEqual(1, "1" as any); results.push("strictEqual(1,'1'): pass"); } catch { results.push("strictEqual(1,'1'): throws"); }
      try { assertModule.notStrictEqual(1, 2); results.push("notStrictEqual(1,2): pass"); } catch { results.push("notStrictEqual(1,2): fail"); }
      return results.join("\n");
    },
    (output) => {
      assertContains(output, "strictEqual(1,1): pass");
      assertContains(output, "strictEqual(1,'1'): throws");
      assertContains(output, "notStrictEqual(1,2): pass");
    }),

  implemented("assert.deepStrictEqual", "assert", `import assert from "@lifo-sh/node-compat/assert";

assert.deepStrictEqual({a: 1}, {a: 1}); // passes
assert.deepStrictEqual({a: 1}, {a: 2}); // throws`,
    async () => {
      const results: string[] = [];
      try { assertModule.deepStrictEqual({ a: 1 }, { a: 1 }); results.push("deep({a:1},{a:1}): pass"); } catch { results.push("deep({a:1},{a:1}): fail"); }
      try { assertModule.deepStrictEqual({ a: 1 }, { a: 2 }); results.push("deep({a:1},{a:2}): pass"); } catch { results.push("deep({a:1},{a:2}): throws"); }
      try { assertModule.deepStrictEqual([1, 2], [1, 2]); results.push("deep([1,2],[1,2]): pass"); } catch { results.push("deep([1,2],[1,2]): fail"); }
      return results.join("\n");
    },
    (output) => {
      assertContains(output, "deep({a:1},{a:1}): pass");
      assertContains(output, "deep({a:1},{a:2}): throws");
      assertContains(output, "deep([1,2],[1,2]): pass");
    }),

  implemented("assert.throws", "assert", `import assert from "@lifo-sh/node-compat/assert";

assert.throws(() => { throw new Error("boom"); });
assert.doesNotThrow(() => 42);`,
    async () => {
      const results: string[] = [];
      try { assertModule.throws(() => { throw new Error("boom"); }); results.push("throws(error): pass"); } catch { results.push("throws(error): fail"); }
      try { assertModule.throws(() => 42); results.push("throws(noop): pass"); } catch { results.push("throws(noop): throws"); }
      try { assertModule.doesNotThrow(() => 42); results.push("doesNotThrow(ok): pass"); } catch { results.push("doesNotThrow(ok): fail"); }
      return results.join("\n");
    },
    (output) => {
      assertContains(output, "throws(error): pass");
      assertContains(output, "throws(noop): throws");
      assertContains(output, "doesNotThrow(ok): pass");
    }),

  // ━━━ os ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  implemented("os.platform / arch / type", "os", `import os from "@lifo-sh/node-compat/os";

console.log(os.platform()); // "browser"
console.log(os.arch());     // "wasm"
console.log(os.type());     // "Browser"`,
    async () => {
      return [
        `platform: ${os.platform()}`,
        `arch: ${os.arch()}`,
        `type: ${os.type()}`,
        `release: ${os.release()}`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "platform: browser");
      assertContains(output, "arch: wasm");
      assertContains(output, "type: Browser");
    }),

  implemented("os.homedir / tmpdir / hostname", "os", `import os from "@lifo-sh/node-compat/os";

console.log(os.homedir());  // "/"
console.log(os.tmpdir());   // "/tmp"
console.log(os.hostname()); // "localhost"`,
    async () => {
      return [
        `homedir: ${os.homedir()}`,
        `tmpdir: ${os.tmpdir()}`,
        `hostname: ${os.hostname()}`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "homedir: /");
      assertContains(output, "tmpdir: /tmp");
      assertContains(output, "hostname:");
    }),

  implemented("os.cpus / totalmem / freemem", "os", `import os from "@lifo-sh/node-compat/os";

console.log(os.cpus().length);
console.log(os.totalmem());
console.log(os.freemem());`,
    async () => {
      const cpus = os.cpus();
      return [
        `cpus: ${cpus.length} core(s)`,
        `totalmem: ${typeof os.totalmem() === "number" ? "valid" : "invalid"}`,
        `freemem: ${typeof os.freemem() === "number" ? "valid" : "invalid"}`,
        `endianness: ${os.endianness()}`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "core(s)");
      assertContains(output, "totalmem: valid");
      assertContains(output, "freemem: valid");
    }),

  implemented("os.EOL", "os", `import os from "@lifo-sh/node-compat/os";

console.log(JSON.stringify(os.EOL)); // "\\n"`,
    async () => {
      return [
        `EOL: ${JSON.stringify(os.EOL)}`,
        `loadavg: [${os.loadavg().join(", ")}]`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, 'EOL: "\\n"');
      assertContains(output, "loadavg:");
    }),

  // ━━━ stream ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  implemented("Readable", "stream", `import { Readable } from "@lifo-sh/node-compat/stream";

const r = new Readable({ read() { this.push("hello"); this.push(null); } });
r.on("data", (chunk) => console.log(chunk));`,
    async () => {
      return await new Promise<string>((resolve) => {
        const chunks: string[] = [];
        const r = new Readable({
          read() {
            this.push("hello ");
            this.push("world");
            this.push(null);
          },
        });
        r.on("data", (chunk: string) => chunks.push(chunk));
        r.on("end", () => resolve(`chunks: [${chunks.join(", ")}]\ncount: ${chunks.length}`));
        r.resume();
      });
    },
    (output) => {
      assertContains(output, "hello");
      assertContains(output, "world");
      assertContains(output, "count: 2");
    }),

  implemented("Writable", "stream", `import { Writable } from "@lifo-sh/node-compat/stream";

const chunks = [];
const w = new Writable({ write(chunk, enc, cb) { chunks.push(chunk); cb(); } });
w.write("hello");
w.end();`,
    async () => {
      return await new Promise<string>((resolve) => {
        const chunks: string[] = [];
        const w = new Writable({
          write(chunk: string, _enc: string, cb: (err?: Error | null) => void) {
            chunks.push(chunk);
            cb();
          },
        });
        w.write("hello");
        w.write("world");
        w.on("finish", () => resolve(`chunks: [${chunks.join(", ")}]\nfinished: true`));
        w.end();
      });
    },
    (output) => {
      assertContains(output, "hello");
      assertContains(output, "world");
      assertContains(output, "finished: true");
    }),

  implemented("Transform", "stream", `import { Transform } from "@lifo-sh/node-compat/stream";

const upper = new Transform({
  transform(chunk, enc, cb) { cb(null, chunk.toUpperCase()); }
});`,
    async () => {
      return await new Promise<string>((resolve) => {
        const results: string[] = [];
        const upper = new Transform({
          objectMode: true,
          transform(chunk: string, _enc: string, cb: (err: Error | null, data?: any) => void) {
            cb(null, chunk.toUpperCase());
          },
        });
        upper.on("data", (chunk: string) => results.push(chunk));
        upper.on("end", () => resolve(`results: [${results.join(", ")}]`));
        upper.write("hello");
        upper.write("world");
        upper.end();
        upper.resume();
      });
    },
    (output) => {
      assertContains(output, "HELLO");
      assertContains(output, "WORLD");
    }),

  implemented("pipeline", "stream", `import { Readable, Writable, pipeline } from "@lifo-sh/node-compat/stream";

pipeline(source, transform, destination, (err) => {
  if (err) console.error(err);
  else console.log("done");
});`,
    async () => {
      return await new Promise<string>((resolve) => {
        const collected: string[] = [];
        const source = new Readable({
          objectMode: true,
          read() { this.push("data1"); this.push("data2"); this.push(null); },
        });
        const dest = new Writable({
          objectMode: true,
          write(chunk: string, _enc: string, cb: (err?: Error | null) => void) {
            collected.push(chunk);
            cb();
          },
        });
        pipeline(source, dest, (err: Error | null | undefined) => {
          resolve(`collected: [${collected.join(", ")}]\nerror: ${err ?? "none"}`);
        });
      });
    },
    (output) => {
      assertContains(output, "data1");
      assertContains(output, "data2");
      assertContains(output, "error: none");
    }),

  // ━━━ url ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  implemented("URL", "url", `import { URL } from "@lifo-sh/node-compat/url";

const u = new URL("https://example.com:8080/path?q=1#hash");
console.log(u.hostname, u.port, u.pathname);`,
    async () => {
      const u = new url.URL("https://example.com:8080/path?q=1#hash");
      return [
        `hostname: ${u.hostname}`,
        `port: ${u.port}`,
        `pathname: ${u.pathname}`,
        `search: ${u.search}`,
        `hash: ${u.hash}`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "hostname: example.com");
      assertContains(output, "port: 8080");
      assertContains(output, "pathname: /path");
      assertContains(output, "search: ?q=1");
      assertContains(output, "hash: #hash");
    }),

  implemented("URLSearchParams", "url", `import { URLSearchParams } from "@lifo-sh/node-compat/url";

const params = new URLSearchParams("a=1&b=2");
params.set("c", "3");
console.log(params.toString());`,
    async () => {
      const params = new url.URLSearchParams("a=1&b=2");
      params.set("c", "3");
      return [
        `toString: ${params.toString()}`,
        `get a: ${params.get("a")}`,
        `get c: ${params.get("c")}`,
        `has b: ${params.has("b")}`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "get a: 1");
      assertContains(output, "get c: 3");
      assertContains(output, "has b: true");
    }),

  implemented("url.parse", "url", `import url from "@lifo-sh/node-compat/url";

const parsed = url.parse("https://user:pass@example.com/path?q=1");
console.log(parsed.hostname, parsed.pathname);`,
    async () => {
      const parsed = url.parse("https://user:pass@example.com/path?q=1");
      return [
        `hostname: ${parsed.hostname}`,
        `pathname: ${parsed.pathname}`,
        `auth: ${parsed.auth}`,
        `protocol: ${parsed.protocol}`,
        `search: ${parsed.search}`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "hostname: example.com");
      assertContains(output, "pathname: /path");
      assertContains(output, "protocol: https:");
    }),

  implemented("url.format", "url", `import url from "@lifo-sh/node-compat/url";

url.format({ protocol: "https:", hostname: "example.com", pathname: "/path" });
// => "https://example.com/path"`,
    async () => {
      const result = url.format({ protocol: "https:", slashes: true, hostname: "example.com", pathname: "/path", search: "?q=1" });
      return `format: ${result}`;
    },
    (output) => {
      assertContains(output, "https://example.com/path");
      assertContains(output, "q=1");
    }),

  // ━━━ crypto ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  implemented("randomBytes", "crypto", `import crypto from "@lifo-sh/node-compat/crypto";

const bytes = crypto.randomBytes(16);
console.log(bytes.length); // 16`,
    async () => {
      const bytes = crypto.randomBytes(16);
      return [
        `length: ${bytes.length}`,
        `type: ${bytes.constructor.name}`,
        `nonzero: ${Array.from(bytes).some(b => b !== 0)}`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "length: 16");
      assertContains(output, "Uint8Array");
    }),

  implemented("randomUUID", "crypto", `import crypto from "@lifo-sh/node-compat/crypto";

const id = crypto.randomUUID();
console.log(id); // e.g. "550e8400-e29b-41d4-a716-446655440000"`,
    async () => {
      const id = crypto.randomUUID();
      const isValid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
      return [
        `uuid: ${id}`,
        `valid: ${isValid}`,
        `length: ${id.length}`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "valid: true");
      assertContains(output, "length: 36");
    }),

  implemented("createHash", "crypto", `import crypto from "@lifo-sh/node-compat/crypto";

const hash = crypto.createHash("sha256");
hash.update("hello");
const hex = await hash.digest("hex");`,
    async () => {
      const hash = crypto.createHash("sha256");
      hash.update("hello");
      const hex = await hash.digest("hex");
      return [
        `sha256("hello"): ${hex}`,
        `length: ${(hex as string).length}`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
      assertContains(output, "length: 64");
    }),

  implemented("createHmac", "crypto", `import crypto from "@lifo-sh/node-compat/crypto";

const hmac = crypto.createHmac("sha256", "secret");
hmac.update("message");
const hex = await hmac.digest("hex");`,
    async () => {
      const hmac = crypto.createHmac("sha256", "secret");
      hmac.update("message");
      const hex = await hmac.digest("hex");
      return [
        `hmac-sha256: ${hex}`,
        `length: ${(hex as string).length}`,
      ].join("\n");
    },
    (output) => {
      assertContains(output, "8b5f48702995c1598c573db1e21866a9b825d4a794d169d7060a03605796360b");
      assertContains(output, "length: 64");
    }),
];

export const categories = [
  { key: "VFS", label: "VFS", description: "Virtual File System" },
  { key: "fs", label: "fs", description: "File System" },
  { key: "path", label: "path", description: "Path utilities" },
  { key: "events", label: "events", description: "Event Emitter" },
  { key: "buffer", label: "buffer", description: "Buffer" },
  { key: "stream", label: "stream", description: "Streams" },
  { key: "url", label: "url", description: "URL" },
  { key: "process", label: "process", description: "Process" },
  { key: "crypto", label: "crypto", description: "Crypto" },
  { key: "os", label: "os", description: "OS" },
  { key: "util", label: "util", description: "Utilities" },
  { key: "timers", label: "timers", description: "Timers" },
  { key: "assert", label: "assert", description: "Assert" },
];
