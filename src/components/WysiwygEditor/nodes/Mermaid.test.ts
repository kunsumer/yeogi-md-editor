import { describe, it, expect } from "vitest";
import { autoQuoteQuadrantLabels } from "./Mermaid";

describe("autoQuoteQuadrantLabels", () => {
  it("is a no-op for non-quadrantChart diagrams", () => {
    const flowchart = "flowchart TD\n  A --> B\n  B: [0, 0]";
    expect(autoQuoteQuadrantLabels(flowchart)).toBe(flowchart);
  });

  it("quotes a multi-word label that contains -> (real-world failure case)", () => {
    const input = [
      "quadrantChart",
      "    title Quick wins",
      "    KR->JP pilot: [0.45, 0.72]",
    ].join("\n");
    const output = autoQuoteQuadrantLabels(input);
    expect(output).toContain('"KR->JP pilot": [0.45, 0.72]');
  });

  it("quotes labels with hyphens and spaces", () => {
    const input = [
      "quadrantChart",
      "    Price-gap fill: [0.40, 0.68]",
      "    IT carve-out: [0.20, 0.90]",
    ].join("\n");
    const output = autoQuoteQuadrantLabels(input);
    expect(output).toContain('"Price-gap fill": [0.40, 0.68]');
    expect(output).toContain('"IT carve-out": [0.20, 0.90]');
  });

  it("does NOT requote labels that are already quoted", () => {
    const input = [
      "quadrantChart",
      '    "Already quoted": [0.5, 0.5]',
    ].join("\n");
    const output = autoQuoteQuadrantLabels(input);
    // Should pass through unchanged (no double-quoting).
    expect(output).toContain('"Already quoted": [0.5, 0.5]');
    expect(output).not.toContain('""Already');
  });

  it("leaves directive lines alone (title, x-axis, y-axis, quadrant-N)", () => {
    const input = [
      "quadrantChart",
      "    title Quick wins impact versus effort",
      "    x-axis Low effort --> High effort",
      "    y-axis Low impact --> High impact",
      "    quadrant-1 Deprioritize",
      "    quadrant-2 Invest now",
      "    quadrant-3 Avoid for now",
      "    quadrant-4 Sequence after stabilization",
    ].join("\n");
    const output = autoQuoteQuadrantLabels(input);
    expect(output).toBe(input);
  });

  it("preserves indentation", () => {
    const input = "quadrantChart\n        Deep indent: [0.1, 0.1]";
    const output = autoQuoteQuadrantLabels(input);
    expect(output).toContain('        "Deep indent": [0.1, 0.1]');
  });

  it("handles the full real-world failing input", () => {
    const input = [
      "quadrantChart",
      "    title Quick wins impact versus effort",
      "    x-axis Low effort --> High effort",
      "    y-axis Low impact --> High impact",
      "    quadrant-1 Deprioritize",
      "    quadrant-2 Invest now",
      "    quadrant-3 Avoid for now",
      "    quadrant-4 Sequence after stabilization",
      "    Scope reset: [0.08, 0.95]",
      "    IT carve-out: [0.20, 0.90]",
      "    Wholesale API: [0.35, 0.92]",
      "    CRM reactivation: [0.30, 0.78]",
      "    Price-gap fill: [0.40, 0.68]",
      "    Top-200 supply: [0.55, 0.82]",
      "    KR->JP pilot: [0.45, 0.72]",
      "    Privacy foundation: [0.35, 0.58]",
      "    Hotel ads pilot: [0.50, 0.38]",
      "    Full front-end cutover: [0.85, 0.42]",
    ].join("\n");
    const output = autoQuoteQuadrantLabels(input);
    // All ten data points should be quoted; all six directive lines should not.
    const quotedCount = (output.match(/"[^"]+":\s*\[/g) || []).length;
    expect(quotedCount).toBe(10);
    expect(output).toContain('"KR->JP pilot": [0.45, 0.72]');
    expect(output).toContain("    title Quick wins impact versus effort");
    expect(output).toContain("    quadrant-1 Deprioritize");
  });
});
