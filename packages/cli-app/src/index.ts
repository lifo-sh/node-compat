import { stories, categories } from "stories";
import * as readline from "node:readline";

// ─── Runner ──────────────────────────────────────────────────────

function printSource(source: string) {
  console.log("\n  \x1b[90m┌─ Source ─────────────────────────────\x1b[0m");
  for (const line of source.split("\n")) {
    console.log(`  \x1b[90m│\x1b[0m \x1b[36m${line}\x1b[0m`);
  }
  console.log("  \x1b[90m└─────────────────────────────────────\x1b[0m");
}

async function runAndPrint(run: () => Promise<string>) {
  console.log("\n  \x1b[32m── Output ──\x1b[0m");
  try {
    const output = await run();
    for (const line of output.split("\n")) {
      console.log(`  ${line}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  \x1b[31mError: ${message}\x1b[0m`);
  }
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, resolve));

  while (true) {
    // Main menu: pick a module
    console.log("\n\x1b[1m── node-compat ──────────────────────\x1b[0m");
    categories.forEach((cat, i) => {
      const catStories = stories.filter((s) => s.category === cat.key);
      const implCount = catStories.filter((s) => s.status === "implemented").length;
      const total = catStories.length;
      const suffix = implCount > 0
        ? `\x1b[90m(${implCount}/${total} implemented)\x1b[0m`
        : `\x1b[90m(coming soon)\x1b[0m`;
      console.log(`  ${i + 1}. \x1b[1m${cat.label}\x1b[0m ${suffix}`);
    });
    console.log(`  q. Quit`);

    const moduleInput = await ask("\nSelect a module: ");

    if (moduleInput.trim() === "q") {
      rl.close();
      break;
    }

    const moduleIdx = parseInt(moduleInput, 10) - 1;
    if (moduleIdx < 0 || moduleIdx >= categories.length) {
      console.log("Invalid selection.");
      continue;
    }

    const cat = categories[moduleIdx];
    const catStories = stories.filter(
      (s) => s.category === cat.key && s.status === "implemented"
    );
    const comingSoonStories = stories.filter(
      (s) => s.category === cat.key && s.status === "coming-soon"
    );

    if (catStories.length === 0) {
      console.log(`\n  \x1b[33m${cat.label}\x1b[0m \x1b[90m- ${cat.description} (coming soon)\x1b[0m`);
      continue;
    }

    // Sub menu: pick a story within the module
    while (true) {
      console.log(`\n\x1b[1m── ${cat.label} ──────────────────────────────\x1b[0m`);
      console.log(`  \x1b[90m${cat.description}\x1b[0m\n`);
      catStories.forEach((s, i) => console.log(`  ${i + 1}. ${s.name}`));
      if (comingSoonStories.length > 0) {
        console.log(`\n  \x1b[90mComing soon: ${comingSoonStories.map((s) => s.name).join(", ")}\x1b[0m`);
      }
      console.log(`\n  0. Run all`);
      console.log(`  b. Back`);

      const storyInput = await ask("\nPick a story: ");

      if (storyInput.trim() === "b") break;

      if (storyInput.trim() === "0") {
        for (const s of catStories) {
          console.log(`\n\x1b[1m▸ ${s.name}\x1b[0m`);
          printSource(s.source!);
          await runAndPrint(s.run!);
        }
        continue;
      }

      const storyIdx = parseInt(storyInput, 10) - 1;
      if (storyIdx >= 0 && storyIdx < catStories.length) {
        console.log(`\n\x1b[1m▸ ${catStories[storyIdx].name}\x1b[0m`);
        printSource(catStories[storyIdx].source!);
        await runAndPrint(catStories[storyIdx].run!);
      } else {
        console.log("Invalid selection.");
      }
    }
  }
}

main();
