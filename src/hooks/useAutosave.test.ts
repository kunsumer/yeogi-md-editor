import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutosave } from "./useAutosave";

describe("useAutosave", () => {
  it("calls saver after debounce when content changes", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ content, isDirty }) =>
        useAutosave({ enabled: true, debounceMs: 2000, content, isDirty, save }),
      { initialProps: { content: "a", isDirty: false } },
    );
    rerender({ content: "b", isDirty: true });
    await act(async () => {
      vi.advanceTimersByTime(1999);
    });
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(save).toHaveBeenCalledWith("b");
    vi.useRealTimers();
  });

  it("does not save when disabled", async () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const { rerender } = renderHook(
      ({ content, isDirty }) =>
        useAutosave({ enabled: false, debounceMs: 2000, content, isDirty, save }),
      { initialProps: { content: "a", isDirty: false } },
    );
    rerender({ content: "b", isDirty: true });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(save).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("does not save when buffer is clean", async () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const { rerender } = renderHook(
      ({ content, isDirty }) =>
        useAutosave({ enabled: true, debounceMs: 500, content, isDirty, save }),
      { initialProps: { content: "a", isDirty: false } },
    );
    // Content change flows in, but the doc is reported clean (e.g. external
    // reload). Autosave should not fire.
    rerender({ content: "b", isDirty: false });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(save).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("respects the maxWaitMs ceiling during continuous typing", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ content, isDirty }) =>
        useAutosave({
          enabled: true,
          debounceMs: 500,
          maxWaitMs: 2000,
          content,
          isDirty,
          save,
        }),
      { initialProps: { content: "a", isDirty: false } },
    );
    // Simulate rapid typing: every 300ms a new keystroke before the 500ms
    // idle debounce can land. Without maxWait, save would never fire.
    rerender({ content: "ab", isDirty: true });
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      rerender({ content: "ab" + "x".repeat(i + 1), isDirty: true });
    }
    // Within ~2s of the first dirty tick, save must have fired at least once.
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(save).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("flush() saves the latest content", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ content, isDirty }) =>
        useAutosave({ enabled: true, debounceMs: 2000, content, isDirty, save }),
      { initialProps: { content: "a", isDirty: false } },
    );
    rerender({ content: "b", isDirty: true });
    await act(async () => {
      await result.current.flush();
    });
    expect(save).toHaveBeenCalledWith("b");
    vi.useRealTimers();
  });
});
