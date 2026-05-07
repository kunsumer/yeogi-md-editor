import { useEffect, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import mermaid from "mermaid";

interface Props {
  kind: "mermaid" | "math";
  initialValue?: string;
  onInsert: (source: string) => void;
  onCancel: () => void;
}

const PLACEHOLDERS: Record<Props["kind"], string> = {
  mermaid: `flowchart TD
  A[Start] --> B{Is it working?}
  B -->|Yes| C[Ship it]
  B -->|No| D[Debug]`,
  math: "\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}",
};

const TITLES: Record<Props["kind"], string> = {
  mermaid: "Insert Mermaid diagram",
  math: "Insert LaTeX math",
};

interface Template {
  name: string;
  source: string;
}

// Mermaid templates cover one representative per diagram type so users
// can browse by shape and pick a starting point. Sources are the minimal
// valid mermaid for each syntax — adapted from mermaid.js.org/syntax/examples.
const MERMAID_TEMPLATES: Template[] = [
  {
    name: "Flowchart",
    source: `flowchart TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Continue]
  B -->|No| D[Stop]
  C --> E[End]
  D --> E`,
  },
  {
    name: "Sequence diagram",
    source: `sequenceDiagram
    participant Alice
    participant Bob
    Alice->>John: Hello John, how are you?
    loop Healthcheck
        John->>John: Fight against hypochondria
    end
    Note right of John: Rational thoughts<br/>prevail!
    John-->>Alice: Great!
    John->>Bob: How about you?
    Bob-->>John: Jolly good!`,
  },
  {
    name: "Class diagram",
    source: `classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal <|-- Zebra
    Animal : +int age
    Animal : +String gender
    Animal: +isMammal()
    Animal: +mate()
    class Duck{
      +String beakColor
      +swim()
      +quack()
    }
    class Fish{
      -int sizeInFeet
      -canEat()
    }`,
  },
  {
    name: "State diagram",
    source: `stateDiagram-v2
    [*] --> Still
    Still --> [*]
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]`,
  },
  {
    name: "Entity-relationship",
    source: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses
    CUSTOMER {
        string name
        string email
    }
    ORDER {
        int orderNumber
        date orderDate
    }`,
  },
  {
    name: "Gantt chart",
    source: `gantt
    title Project timeline
    dateFormat  YYYY-MM-DD
    section Design
    Draft             :a1, 2026-05-01, 5d
    Review            :a2, after a1, 3d
    section Build
    Implement         :b1, after a2, 10d
    Test              :b2, after b1, 4d
    section Launch
    Deploy            :c1, after b2, 2d`,
  },
  {
    name: "Pie chart",
    source: `pie title Key lime pie composition
    "Lime" : 40
    "Sugar" : 30
    "Butter" : 20
    "Crust" : 10`,
  },
  {
    name: "User journey",
    source: `journey
    title My working day
    section Go to work
      Make tea: 5: Me
      Go upstairs: 3: Me
      Do work: 1: Me, Cat
    section Go home
      Go downstairs: 5: Me
      Sit down: 5: Me`,
  },
  {
    name: "Git graph",
    source: `gitGraph
    commit
    commit
    branch develop
    checkout develop
    commit
    commit
    checkout main
    merge develop
    commit`,
  },
  {
    name: "Mindmap",
    source: `mindmap
  root((Markdown))
    Syntax
      Headings
      Lists
      Links
    Tools
      Editors
      Parsers
    Extensions
      Math
      Diagrams`,
  },
  {
    name: "Timeline",
    source: `timeline
    title History of markup
    1960 : Ted Nelson coins "hypertext"
    1991 : Tim Berners-Lee creates HTML
    2004 : John Gruber publishes Markdown
    2012 : CommonMark effort begins`,
  },
  {
    name: "Quadrant chart",
    source: `quadrantChart
    title Reach vs engagement
    x-axis Low reach --> High reach
    y-axis Low engagement --> High engagement
    quadrant-1 Expand
    quadrant-2 Invest
    quadrant-3 Review
    quadrant-4 Promote
    Campaign A: [0.3, 0.6]
    Campaign B: [0.45, 0.23]
    Campaign C: [0.57, 0.69]
    Campaign D: [0.78, 0.34]`,
  },
];

// LaTeX templates cover the most frequently requested shapes for technical
// writing. All examples are KaTeX-compatible.
const MATH_TEMPLATES: Template[] = [
  {
    name: "Gaussian integral",
    source: "\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}",
  },
  {
    name: "Quadratic formula",
    source: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
  },
  {
    name: "Basel sum",
    source: "\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}",
  },
  {
    name: "Fraction",
    source: "\\frac{a + b}{c - d}",
  },
  {
    name: "2x2 matrix",
    source:
      "A = \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}",
  },
  {
    name: "Piecewise function",
    source:
      "f(x) = \\begin{cases} x^2 & \\text{if } x \\ge 0 \\\\ -x & \\text{if } x < 0 \\end{cases}",
  },
  {
    name: "Limit",
    source: "\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1",
  },
  {
    name: "Partial derivative",
    source:
      "\\frac{\\partial f}{\\partial x} = \\lim_{h \\to 0} \\frac{f(x+h, y) - f(x, y)}{h}",
  },
  {
    name: "Binomial coefficient",
    source: "\\binom{n}{k} = \\frac{n!}{k!\\,(n-k)!}",
  },
  {
    name: "Vector",
    source:
      "\\vec{v} = \\begin{pmatrix} v_1 \\\\ v_2 \\\\ v_3 \\end{pmatrix}",
  },
  {
    name: "Taylor series",
    source:
      "f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!} (x-a)^n",
  },
  {
    name: "Euclidean norm",
    source:
      "\\| \\mathbf{x} \\| = \\sqrt{x_1^2 + x_2^2 + \\cdots + x_n^2}",
  },
  {
    name: "Greek letters",
    source:
      "\\alpha, \\beta, \\gamma, \\delta, \\epsilon, \\theta, \\lambda, \\mu, \\pi, \\sigma, \\Delta, \\Sigma, \\Omega",
  },
];

const TEMPLATES: Record<Props["kind"], Template[]> = {
  mermaid: MERMAID_TEMPLATES,
  math: MATH_TEMPLATES,
};

// Math symbol palette modeled on the Word Equation Editor reference
// (rti.etf.bg.ac.rs/rti/si1pkr/materijali/lab/word/EquationEditor.pdf).
// Each entry is inserted into the source at the caret as a bare LaTeX
// token — users can type literal spaces/operators between them.
interface MathSymbol {
  tex: string; // what to render in the button
  insert?: string; // what to put into the source (defaults to tex)
  label?: string; // tooltip
}

interface SymbolGroup {
  name: string;
  symbols: MathSymbol[];
}

const MATH_SYMBOLS: SymbolGroup[] = [
  {
    name: "Greek lowercase",
    symbols: [
      { tex: "\\alpha" },
      { tex: "\\beta" },
      { tex: "\\gamma" },
      { tex: "\\delta" },
      { tex: "\\epsilon" },
      { tex: "\\varepsilon" },
      { tex: "\\zeta" },
      { tex: "\\eta" },
      { tex: "\\theta" },
      { tex: "\\vartheta" },
      { tex: "\\iota" },
      { tex: "\\kappa" },
      { tex: "\\lambda" },
      { tex: "\\mu" },
      { tex: "\\nu" },
      { tex: "\\xi" },
      { tex: "\\pi" },
      { tex: "\\rho" },
      { tex: "\\sigma" },
      { tex: "\\tau" },
      { tex: "\\upsilon" },
      { tex: "\\phi" },
      { tex: "\\varphi" },
      { tex: "\\chi" },
      { tex: "\\psi" },
      { tex: "\\omega" },
    ],
  },
  {
    name: "Greek uppercase",
    symbols: [
      { tex: "\\Gamma" },
      { tex: "\\Delta" },
      { tex: "\\Theta" },
      { tex: "\\Lambda" },
      { tex: "\\Xi" },
      { tex: "\\Pi" },
      { tex: "\\Sigma" },
      { tex: "\\Upsilon" },
      { tex: "\\Phi" },
      { tex: "\\Psi" },
      { tex: "\\Omega" },
    ],
  },
  {
    name: "Binary operators",
    symbols: [
      { tex: "+" },
      { tex: "-" },
      { tex: "\\pm" },
      { tex: "\\mp" },
      { tex: "\\times" },
      { tex: "\\div" },
      { tex: "\\cdot" },
      { tex: "\\ast" },
      { tex: "\\star" },
      { tex: "\\circ" },
      { tex: "\\bullet" },
      { tex: "\\oplus" },
      { tex: "\\ominus" },
      { tex: "\\otimes" },
      { tex: "\\oslash" },
      { tex: "\\odot" },
    ],
  },
  {
    name: "Relations",
    symbols: [
      { tex: "=" },
      { tex: "\\neq" },
      { tex: "<" },
      { tex: ">" },
      { tex: "\\leq" },
      { tex: "\\geq" },
      { tex: "\\ll" },
      { tex: "\\gg" },
      { tex: "\\approx" },
      { tex: "\\equiv" },
      { tex: "\\sim" },
      { tex: "\\simeq" },
      { tex: "\\cong" },
      { tex: "\\propto" },
      { tex: "\\parallel" },
      { tex: "\\perp" },
    ],
  },
  {
    name: "Sets & logic",
    symbols: [
      { tex: "\\in" },
      { tex: "\\notin" },
      { tex: "\\ni" },
      { tex: "\\subset" },
      { tex: "\\supset" },
      { tex: "\\subseteq" },
      { tex: "\\supseteq" },
      { tex: "\\cup" },
      { tex: "\\cap" },
      { tex: "\\setminus" },
      { tex: "\\emptyset" },
      { tex: "\\forall" },
      { tex: "\\exists" },
      { tex: "\\nexists" },
      { tex: "\\land" },
      { tex: "\\lor" },
      { tex: "\\lnot" },
      { tex: "\\vdash" },
      { tex: "\\models" },
      { tex: "\\top" },
      { tex: "\\bot" },
    ],
  },
  {
    name: "Number sets",
    symbols: [
      { tex: "\\mathbb{R}", label: "Reals" },
      { tex: "\\mathbb{N}", label: "Naturals" },
      { tex: "\\mathbb{Z}", label: "Integers" },
      { tex: "\\mathbb{Q}", label: "Rationals" },
      { tex: "\\mathbb{C}", label: "Complex" },
      { tex: "\\mathbb{P}", label: "Primes" },
    ],
  },
  {
    name: "Arrows",
    symbols: [
      { tex: "\\to" },
      { tex: "\\leftarrow" },
      { tex: "\\leftrightarrow" },
      { tex: "\\Rightarrow" },
      { tex: "\\Leftarrow" },
      { tex: "\\Leftrightarrow" },
      { tex: "\\mapsto" },
      { tex: "\\longrightarrow" },
      { tex: "\\longleftarrow" },
      { tex: "\\longleftrightarrow" },
      { tex: "\\uparrow" },
      { tex: "\\downarrow" },
      { tex: "\\updownarrow" },
      { tex: "\\nearrow" },
      { tex: "\\searrow" },
      { tex: "\\swarrow" },
      { tex: "\\nwarrow" },
    ],
  },
  {
    name: "Calculus & operators",
    symbols: [
      { tex: "\\int", label: "Integral" },
      { tex: "\\iint" },
      { tex: "\\iiint" },
      { tex: "\\oint" },
      { tex: "\\partial" },
      { tex: "\\nabla" },
      { tex: "\\sum" },
      { tex: "\\prod" },
      { tex: "\\coprod" },
      { tex: "\\bigcup" },
      { tex: "\\bigcap" },
      { tex: "\\lim" },
      { tex: "\\infty" },
    ],
  },
  {
    name: "Structures",
    symbols: [
      { tex: "\\frac{a}{b}", insert: "\\frac{}{}", label: "Fraction" },
      { tex: "\\sqrt{x}", insert: "\\sqrt{}", label: "Square root" },
      { tex: "\\sqrt[n]{x}", insert: "\\sqrt[]{}", label: "nth root" },
      { tex: "x^{n}", insert: "^{}", label: "Superscript" },
      { tex: "x_{i}", insert: "_{}", label: "Subscript" },
      { tex: "\\vec{v}", insert: "\\vec{}" },
      { tex: "\\hat{x}", insert: "\\hat{}" },
      { tex: "\\bar{x}", insert: "\\bar{}" },
      { tex: "\\overline{abc}", insert: "\\overline{}" },
      { tex: "\\underline{abc}", insert: "\\underline{}" },
      { tex: "\\binom{n}{k}", insert: "\\binom{}{}", label: "Binomial" },
    ],
  },
  {
    name: "Delimiters & misc",
    symbols: [
      { tex: "\\langle x \\rangle", insert: "\\langle  \\rangle" },
      { tex: "| x |", insert: "|  |" },
      { tex: "\\| x \\|", insert: "\\|  \\|" },
      { tex: "\\lfloor x \\rfloor", insert: "\\lfloor  \\rfloor" },
      { tex: "\\lceil x \\rceil", insert: "\\lceil  \\rceil" },
      { tex: "\\cdots" },
      { tex: "\\ldots" },
      { tex: "\\vdots" },
      { tex: "\\ddots" },
      { tex: "\\aleph" },
      { tex: "\\hbar" },
      { tex: "\\ell" },
    ],
  },
];

/**
 * Small inline KaTeX renderer used for dropdown item previews. KaTeX is
 * fast enough that we can render an entire grid of symbols on open without
 * a noticeable stall (~1–3 ms per glyph).
 */
function KatexPreview({
  tex,
  displayMode = false,
}: {
  tex: string;
  displayMode?: boolean;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    try {
      katex.render(tex, host, {
        throwOnError: false,
        displayMode,
        output: "html",
      });
    } catch {
      host.textContent = tex;
    }
  }, [tex, displayMode]);
  return <span ref={ref} aria-hidden="true" />;
}

let mermaidInitialized = false;
function ensureMermaid() {
  if (mermaidInitialized) return;
  mermaidInitialized = true;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "default",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  });
}

let previewIdSeq = 0;
let mermaidPreviewQueue: Promise<unknown> = Promise.resolve();

/**
 * Side-by-side source + live preview dialog for inserting Mermaid diagrams
 * or LaTeX math. Debounces preview on type so rendering stays snappy.
 */
export function InsertCodeDialog({ kind, initialValue = "", onInsert, onCancel }: Props) {
  const [source, setSource] = useState(initialValue);
  const [deferred, setDeferred] = useState(initialValue);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [symbolsOpen, setSymbolsOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const templatesBtnRef = useRef<HTMLButtonElement | null>(null);
  const templatesMenuRef = useRef<HTMLDivElement | null>(null);
  const symbolsBtnRef = useRef<HTMLButtonElement | null>(null);
  const symbolsMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Close the templates popover on outside click or Escape.
  useEffect(() => {
    if (!templatesOpen) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (templatesBtnRef.current?.contains(t)) return;
      if (templatesMenuRef.current?.contains(t)) return;
      setTemplatesOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Swallow so the outer dialog doesn't also close.
        e.stopPropagation();
        setTemplatesOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [templatesOpen]);

  // Same outside-click/Escape handling for the symbols popover.
  useEffect(() => {
    if (!symbolsOpen) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (symbolsBtnRef.current?.contains(t)) return;
      if (symbolsMenuRef.current?.contains(t)) return;
      setSymbolsOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setSymbolsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [symbolsOpen]);

  // Insert a snippet at the current caret position (or append if the
  // textarea isn't focused). Updates state via functional setters so we
  // read the freshest source — important because the dropdown button
  // briefly pulls focus away from the textarea between clicks.
  function insertAtCursor(snippet: string) {
    const el = textareaRef.current;
    const hadFocus = el != null && document.activeElement === el;
    // Prefer the latest selection when the textarea still held focus;
    // otherwise append to the end of the current source.
    setSource((prev) => {
      const start = hadFocus && el ? el.selectionStart : prev.length;
      const end = hadFocus && el ? el.selectionEnd : prev.length;
      const next = prev.slice(0, start) + snippet + prev.slice(end);
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        // Place caret after the inserted snippet. If the snippet contains
        // empty braces (structure templates like \frac{}{}), position the
        // caret inside the first pair so the user can type the numerator.
        const firstEmpty = snippet.indexOf("{}");
        const caret =
          firstEmpty >= 0 ? start + firstEmpty + 1 : start + snippet.length;
        el.selectionStart = el.selectionEnd = caret;
      });
      return next;
    });
  }

  function replaceAll(snippet: string) {
    setSource(snippet);
    setDeferred(snippet);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.selectionStart = el.selectionEnd = snippet.length;
    });
  }

  function applyTemplate(tpl: Template) {
    // Mermaid diagrams are whole documents (one type header per block),
    // so picking a template replaces. LaTeX templates are free-standing
    // snippets that compose, so they insert at the caret instead.
    if (kind === "math") insertAtCursor(tpl.source);
    else replaceAll(tpl.source);
    setTemplatesOpen(false);
  }

  function applySymbol(sym: MathSymbol) {
    insertAtCursor(sym.insert ?? sym.tex);
    setSymbolsOpen(false);
  }

  useEffect(() => {
    const t = window.setTimeout(() => setDeferred(source), 200);
    return () => window.clearTimeout(t);
  }, [source]);

  // Render preview whenever the debounced source changes.
  useEffect(() => {
    let cancelled = false;
    const host = previewRef.current;
    if (!host) return;
    if (!deferred.trim()) {
      host.replaceChildren();
      return;
    }
    if (kind === "math") {
      try {
        host.replaceChildren();
        katex.render(deferred, host, {
          throwOnError: false,
          displayMode: true,
        });
      } catch (err) {
        host.textContent = String(err);
      }
    } else {
      ensureMermaid();
      const runTask = async () => {
        if (cancelled || !host) return;
        const placeholder = document.createElement("div");
        placeholder.className = "mermaid";
        placeholder.id = `mermaid-preview-${++previewIdSeq}`;
        placeholder.textContent = deferred;
        host.replaceChildren(placeholder);
        try {
          await mermaid.run({ nodes: [placeholder], suppressErrors: false });
        } catch (err) {
          if (cancelled) return;
          host.textContent = String(err);
        }
      };
      mermaidPreviewQueue = mermaidPreviewQueue.then(runTask, runTask);
    }
    return () => {
      cancelled = true;
    };
  }, [deferred, kind]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function submit() {
    if (!source.trim()) return;
    onInsert(source);
  }

  return (
    <div
      className="insert-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={TITLES[kind]}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="insert-card">
        <div className="insert-title">{TITLES[kind]}</div>
        <div className="insert-body">
          <div className="insert-source-pane">
            <div className="insert-source-header">
              <label className="insert-pane-label" htmlFor="insert-source">
                Source
              </label>
              <div className="insert-source-actions">
                {kind === "math" && (
                  <div className="insert-templates-wrap">
                    <button
                      ref={symbolsBtnRef}
                      type="button"
                      className="insert-templates-btn"
                      onClick={() => {
                        setSymbolsOpen((v) => !v);
                        setTemplatesOpen(false);
                      }}
                      aria-haspopup="menu"
                      aria-expanded={symbolsOpen}
                    >
                      Symbols <span aria-hidden="true">▾</span>
                    </button>
                    {symbolsOpen && (
                      <div
                        ref={symbolsMenuRef}
                        className="insert-symbols-menu"
                        role="menu"
                        aria-label="LaTeX symbols"
                      >
                        {MATH_SYMBOLS.map((group) => (
                          <div key={group.name} className="insert-symbols-group">
                            <div className="insert-symbols-group-name">{group.name}</div>
                            <div className="insert-symbols-grid">
                              {group.symbols.map((sym, i) => (
                                <button
                                  key={`${group.name}-${i}`}
                                  type="button"
                                  role="menuitem"
                                  className="insert-symbols-item"
                                  title={sym.label ?? sym.insert ?? sym.tex}
                                  onClick={() => applySymbol(sym)}
                                >
                                  <KatexPreview tex={sym.tex} />
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="insert-templates-wrap">
                  <button
                    ref={templatesBtnRef}
                    type="button"
                    className="insert-templates-btn"
                    onClick={() => {
                      setTemplatesOpen((v) => !v);
                      setSymbolsOpen(false);
                    }}
                    aria-haspopup="menu"
                    aria-expanded={templatesOpen}
                  >
                    Templates <span aria-hidden="true">▾</span>
                  </button>
                  {templatesOpen && (
                    <div
                      ref={templatesMenuRef}
                      className={`insert-templates-menu${kind === "math" ? " with-preview" : ""}`}
                      role="menu"
                      aria-label={`${kind === "mermaid" ? "Mermaid" : "LaTeX"} templates`}
                    >
                      {TEMPLATES[kind].map((tpl) =>
                        kind === "math" ? (
                          <button
                            key={tpl.name}
                            type="button"
                            role="menuitem"
                            className="insert-templates-item-row"
                            onClick={() => applyTemplate(tpl)}
                          >
                            <span className="tpl-name">{tpl.name}</span>
                            <span className="tpl-preview">
                              <KatexPreview tex={tpl.source} />
                            </span>
                          </button>
                        ) : (
                          <button
                            key={tpl.name}
                            type="button"
                            role="menuitem"
                            className="insert-templates-item"
                            onClick={() => applyTemplate(tpl)}
                          >
                            {tpl.name}
                          </button>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <textarea
              id="insert-source"
              ref={textareaRef}
              value={source}
              placeholder={PLACEHOLDERS[kind]}
              onChange={(e) => setSource(e.target.value)}
              onKeyDown={(e) => {
                // Tab inserts a tab instead of moving focus.
                if (e.key === "Tab") {
                  e.preventDefault();
                  const el = e.currentTarget;
                  const start = el.selectionStart;
                  const end = el.selectionEnd;
                  const next = source.slice(0, start) + "  " + source.slice(end);
                  setSource(next);
                  requestAnimationFrame(() => {
                    el.selectionStart = el.selectionEnd = start + 2;
                  });
                }
                // Cmd/Ctrl+Enter submits.
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              spellCheck={false}
            />
          </div>
          <div className="insert-preview-pane">
            <div className="insert-pane-label">Preview</div>
            <div ref={previewRef} className="insert-preview preview-content" />
          </div>
        </div>
        <div className="insert-actions">
          <div style={{ flex: 1, color: "var(--text-faint)", fontSize: 11 }}>
            {kind === "mermaid" ? "Mermaid syntax" : "LaTeX (KaTeX subset)"} · ⌘⏎ to insert
          </div>
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={submit}
            disabled={!source.trim()}
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}
