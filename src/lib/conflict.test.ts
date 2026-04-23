import { describe, it, expect } from "vitest";
import { decideOnExternalChange } from "./conflict";

describe("decideOnExternalChange", () => {
  it("ignores echoes: diskMtime equals savedMtime", () => {
    expect(decideOnExternalChange({ diskMtime: 5, savedMtime: 5, isDirty: false })).toBe("ignore");
    expect(decideOnExternalChange({ diskMtime: 5, savedMtime: 5, isDirty: true })).toBe("ignore");
  });

  it("silent-reload when disk newer and clean", () => {
    expect(decideOnExternalChange({ diskMtime: 7, savedMtime: 5, isDirty: false })).toBe("silent-reload");
  });

  it("conflict when disk newer and dirty", () => {
    expect(decideOnExternalChange({ diskMtime: 7, savedMtime: 5, isDirty: true })).toBe("conflict");
  });

  it("ignore when disk older than last save", () => {
    expect(decideOnExternalChange({ diskMtime: 3, savedMtime: 5, isDirty: false })).toBe("ignore");
  });
});
