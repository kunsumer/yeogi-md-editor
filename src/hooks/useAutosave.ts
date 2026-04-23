import { useEffect, useRef } from "react";

interface Input {
  enabled: boolean;
  /**
   * Idle debounce: save this long after the last keystroke. Kept short so
   * saves feel immediate while still coalescing a burst of typing.
   */
  debounceMs: number;
  /**
   * Upper bound: during a continuous stream of typing (where each keystroke
   * resets the idle debounce), force a save once this much time has passed
   * since the change queue first became dirty. Prevents the "typing for 30s
   * → nothing saved" trap without falling back to fixed-interval polling.
   */
  maxWaitMs?: number;
  content: string;
  /** When false (clean buffer) we skip scheduling — no save when nothing changed. */
  isDirty: boolean;
  save: (content: string) => Promise<void>;
}

export function useAutosave({
  enabled,
  debounceMs,
  maxWaitMs = 2000,
  content,
  isDirty,
  save,
}: Input) {
  const latest = useRef(content);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(false);
  // When the buffer first became dirty in this scheduling cycle — lets us
  // honor `maxWaitMs` as a hard ceiling on save latency.
  const firstPendingAt = useRef<number | null>(null);
  latest.current = content;

  useEffect(() => {
    if (!enabled) return;
    // Nothing to save — don't arm a timer that would no-op on the disk.
    if (!isDirty) {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      pending.current = false;
      firstPendingAt.current = null;
      return;
    }
    if (firstPendingAt.current === null) firstPendingAt.current = Date.now();
    pending.current = true;
    if (timer.current) clearTimeout(timer.current);
    const elapsed = Date.now() - firstPendingAt.current;
    const remainingToCap = Math.max(0, maxWaitMs - elapsed);
    const delay = Math.min(debounceMs, remainingToCap);
    timer.current = setTimeout(async () => {
      const value = latest.current;
      pending.current = false;
      firstPendingAt.current = null;
      timer.current = null;
      await save(value);
    }, delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [content, enabled, debounceMs, maxWaitMs, isDirty, save]);

  async function flush() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current) {
      pending.current = false;
      firstPendingAt.current = null;
      await save(latest.current);
    }
  }
  return { flush };
}
