interface Tab {
  id: string;
  title: string;
  isDirty: boolean;
}

interface Props {
  docs: Tab[];
  activeId: string | null;
  onActivate(id: string): void;
  onClose(id: string): void;
}

export function TabBar({ docs, activeId, onActivate, onClose }: Props) {
  return (
    <div role="tablist" style={{ display: "flex", gap: 2, borderBottom: "1px solid #ccc" }}>
      {docs.map((d) => (
        <div
          key={d.id}
          role="tab"
          aria-selected={d.id === activeId}
          data-dirty={d.isDirty ? "true" : "false"}
          onMouseDown={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              onClose(d.id);
            }
          }}
          onClick={() => onActivate(d.id)}
          style={{
            padding: "4px 8px",
            background: d.id === activeId ? "#f0f0f0" : "transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {d.isDirty && <span aria-hidden="true">•</span>}
          <span>{d.title}</span>
          <button
            aria-label={`Close ${d.title}`}
            onClick={(e) => {
              e.stopPropagation();
              onClose(d.id);
            }}
            style={{ border: 0, background: "transparent", cursor: "pointer" }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
