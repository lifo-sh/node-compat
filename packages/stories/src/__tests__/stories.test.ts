import { describe, it, expect } from "vitest";
import { stories } from "../index";

const implemented = stories.filter((s) => s.status === "implemented");

describe("stories", () => {
  for (const story of implemented) {
    it(`${story.category} > ${story.name}`, async () => {
      expect(story.run).toBeDefined();
      const output = await story.run!();
      expect(typeof output).toBe("string");
      expect(output.length).toBeGreaterThan(0);

      if (story.test) {
        story.test(output);
      }
    });
  }
});
