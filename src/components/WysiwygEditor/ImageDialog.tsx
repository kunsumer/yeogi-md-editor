import { useEffect, useRef, useState } from "react";

interface Props {
  onInsert: (src: string) => void;
  onCancel: () => void;
}

// 20 MB guard — data URLs embed the bytes verbatim into the markdown, so a
// huge photo would bloat the saved document. We warn at this threshold
// rather than hard-blocking, since users may intentionally want the
// self-contained embed.
const SOFT_LIMIT_BYTES = 20 * 1024 * 1024;

const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif",
  "image/bmp",
];

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Insert-image dialog with two paths:
 *   1. Paste an http(s) URL in the text field.
 *   2. Click "Choose file…" to pick a local image; read it as a data URL
 *      and embed it inline. Keeps the markdown self-contained at the cost
 *      of file size (warned above SOFT_LIMIT_BYTES).
 *
 * Uses a standard <input type="file"> so WKWebView opens the macOS native
 * file picker — no Tauri dialog plugin round-trip needed.
 */
export function ImageDialog({ onInsert, onCancel }: Props) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    urlInputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function submitUrl() {
    const v = url.trim();
    if (!v) return;
    onInsert(v);
  }

  function openPicker() {
    setError(null);
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Clear the input value so re-picking the same file re-fires change.
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file doesn't look like an image.");
      return;
    }
    if (file.size > SOFT_LIMIT_BYTES) {
      setError(
        `That file is ${formatBytes(file.size)} — embedded images this large can make the document slow. Try a smaller image or host it externally.`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setBusy(false);
      const result = reader.result;
      if (typeof result === "string") {
        onInsert(result);
      } else {
        setError("Couldn't read that file.");
      }
    };
    reader.onerror = () => {
      setBusy(false);
      setError("Couldn't read that file.");
    };
    reader.readAsDataURL(file);
  }

  return (
    <div
      className="prompt-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Insert image"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="prompt-card image-dialog">
        <div className="prompt-title">Insert image</div>

        <label className="image-dialog-label" htmlFor="image-dialog-url">
          Image URL
        </label>
        <input
          id="image-dialog-url"
          ref={urlInputRef}
          type="text"
          className="prompt-input"
          value={url}
          placeholder="https://example.com/image.png"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitUrl();
            }
          }}
          disabled={busy}
        />

        <div className="image-dialog-divider" aria-hidden="true">
          <span>or</span>
        </div>

        <button
          type="button"
          className="btn-ghost image-dialog-file-btn"
          onClick={openPicker}
          disabled={busy}
        >
          {busy ? "Reading file…" : "Choose file from your computer…"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="image-dialog-file-input"
          onChange={onFileChange}
          aria-hidden="true"
          tabIndex={-1}
        />
        <div className="image-dialog-hint">
          Local images are embedded in the document.
        </div>

        {error && (
          <div className="image-dialog-error" role="alert">
            {error}
          </div>
        )}

        <div className="prompt-actions">
          <div style={{ flex: 1 }} />
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={submitUrl}
            disabled={busy || !url.trim()}
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}
