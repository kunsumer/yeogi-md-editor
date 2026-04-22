import { useEffect, useRef } from "react";
// The `.prompt-*` and `.confirm-*` selectors live in wysiwyg.css (shared
// with PromptDialog). Importing it here guarantees the stylesheet is
// loaded even when the user has never opened the WYSIWYG editor this
// session — otherwise the close-unsaved-changes prompt could render
// unstyled.
import "./WysiwygEditor/wysiwyg.css";

interface Props {
  title: string;
  message: React.ReactNode;
  /** Primary action, framed green/blue. */
  confirmLabel?: string;
  /** Destructive secondary action (e.g. "Don't Save"). Optional. */
  discardLabel?: string;
  cancelLabel?: string;
  tone?: "normal" | "danger";
  onConfirm: () => void;
  onDiscard?: () => void;
  onCancel: () => void;
}

/**
 * Three-button confirmation modal used for unsaved-changes prompts and
 * similar irreversible flows. WKWebView (Tauri's macOS engine) disables
 * window.confirm, so we replace it with this React dialog that mirrors the
 * familiar Save / Don't Save / Cancel shape from native apps.
 *
 * Keyboard wiring:
 *   - Enter  → confirmLabel action (Save)
 *   - Esc    → cancelLabel action  (Cancel)
 *   - Tab    → cycles through the visible buttons
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "OK",
  discardLabel,
  cancelLabel = "Cancel",
  tone = "normal",
  onConfirm,
  onDiscard,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onConfirm();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onConfirm, onCancel]);

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
      <div className="prompt-card confirm-card">
        <div className="prompt-title">{title}</div>
        <div className="confirm-message">{message}</div>
        <div className="prompt-actions">
          {discardLabel && onDiscard && (
            <button
              type="button"
              className="btn-ghost confirm-discard"
              onClick={onDiscard}
            >
              {discardLabel}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button type="button" className="btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={tone === "danger" ? "btn-danger" : "btn-primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
