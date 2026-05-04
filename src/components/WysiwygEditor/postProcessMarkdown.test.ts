import { describe, it, expect } from "vitest";
import { postProcessMarkdown } from "./postProcessMarkdown";

describe("postProcessMarkdown", () => {
  describe("wiki-link collapse", () => {
    it("collapses [[X|X]] to [[X]]", () => {
      expect(postProcessMarkdown("See [[Note|Note]] for details.")).toBe(
        "See [[Note]] for details.",
      );
    });

    it("leaves [[X|Y]] alone when target !== alias", () => {
      expect(postProcessMarkdown("[[Note|display text]]")).toBe(
        "[[Note|display text]]",
      );
    });

    it("is idempotent", () => {
      const once = postProcessMarkdown("[[Foo|Foo]]");
      const twice = postProcessMarkdown(once);
      expect(twice).toBe(once);
      expect(twice).toBe("[[Foo]]");
    });
  });

  describe("email autolink restore", () => {
    it("collapses [x@y](mailto:x@y) to <x@y>", () => {
      expect(postProcessMarkdown("Email: [hello@yeogi.com](mailto:hello@yeogi.com)")).toBe(
        "Email: <hello@yeogi.com>",
      );
    });

    it("leaves inline form alone when display text differs from address", () => {
      expect(
        postProcessMarkdown("[Say hi](mailto:hello@yeogi.com)"),
      ).toBe("[Say hi](mailto:hello@yeogi.com)");
    });

    it("restores multiple email autolinks in one pass", () => {
      expect(
        postProcessMarkdown(
          "Write to [a@x.com](mailto:a@x.com) or [b@y.com](mailto:b@y.com).",
        ),
      ).toBe("Write to <a@x.com> or <b@y.com>.");
    });

    it("is idempotent", () => {
      const input = "[me@x.com](mailto:me@x.com)";
      const once = postProcessMarkdown(input);
      const twice = postProcessMarkdown(once);
      expect(twice).toBe(once);
      expect(twice).toBe("<me@x.com>");
    });

    it("does not affect URL links that happen to start with mailto: in text", () => {
      // Display text has a space so can't match the strict address regex.
      expect(
        postProcessMarkdown("[mailto: deprecated](https://x.com)"),
      ).toBe("[mailto: deprecated](https://x.com)");
    });
  });
});
