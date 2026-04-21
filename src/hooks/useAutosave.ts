import { useEffect, useRef } from "react";

interface Input {
  enabled: boolean;
  debounceMs: number;
  content: string;
  save: (content: string) => Promise<void>;
}

export function useAutosave({ enabled, debounceMs, content, save }: Input) {
  const latest = useRef(content);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(false);
  latest.current = content;

  useEffect(() => {
    if (!enabled) return;
    if (timer.current) clearTimeout(timer.current);
    pending.current = true;
    timer.current = setTimeout(async () => {
      const value = latest.current;
      pending.current = false;
      await save(value);
    }, debounceMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [content, enabled, debounceMs, save]);

  async function flush() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current) {
      pending.current = false;
      await save(latest.current);
    }
  }
  return { flush };
}
