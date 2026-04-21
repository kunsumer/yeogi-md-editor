import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutosave } from "./useAutosave";

describe("useAutosave", () => {
  it("calls saver after debounce when content changes", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ content }) => useAutosave({ enabled: true, debounceMs: 2000, content, save }),
      { initialProps: { content: "a" } },
    );
    rerender({ content: "b" });
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
      ({ content }) => useAutosave({ enabled: false, debounceMs: 2000, content, save }),
      { initialProps: { content: "a" } },
    );
    rerender({ content: "b" });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(save).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("flush() saves the latest content", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ content }) => useAutosave({ enabled: true, debounceMs: 2000, content, save }),
      { initialProps: { content: "a" } },
    );
    rerender({ content: "b" });
    await act(async () => {
      await result.current.flush();
    });
    expect(save).toHaveBeenCalledWith("b");
    vi.useRealTimers();
  });
});
