import { useEffect, useRef, useState } from "react";

interface Props {
  title: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  allowRemove?: boolean;
  onSubmit: (value: string) => void;
  onRemove?: () => void;
  onCancel: () => void;
}

/**
 * Lightweight modal for text input. Replaces window.prompt(), which
 * WKWebView (Tauri's macOS engine) disables by default, so the native
 * prompt call returns null and feels "dead".
 */
export function PromptDialog({
  title,
  placeholder,
  initialValue = "",
  submitLabel = "OK",
  allowRemove,
  onSubmit,
  onRemove,
  onCancel,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function submit() {
    onSubmit(value.trim());
  }

  return (
    <div
      className="prompt-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="prompt-card">
        <div className="prompt-title">{title}</div>
        <input
          ref={inputRef}
          type="text"
          className="prompt-input"
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="prompt-actions">
          {allowRemove && onRemove && (
            <button type="button" className="btn-ghost" onClick={onRemove}>
              Remove
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={submit}>
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
