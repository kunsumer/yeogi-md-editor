export type ConflictDecision = "ignore" | "silent-reload" | "conflict";

export function decideOnExternalChange(input: {
  diskMtime: number;
  savedMtime: number;
  isDirty: boolean;
}): ConflictDecision {
  if (input.diskMtime <= input.savedMtime) return "ignore";
  return input.isDirty ? "conflict" : "silent-reload";
}
