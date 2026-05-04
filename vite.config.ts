import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    // Default 500 kB warning threshold fires on our vendor chunks (mermaid,
    // shiki, katex) even after splitting — they're genuinely large libraries
    // and we accept that cost. Bumped to 800 kB to only flag unexpected
    // regressions without losing the signal entirely.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        preview: resolve(__dirname, "preview.html"),
      },
      output: {
        // Split heavy vendor libraries into dedicated chunks so (a) the
        // main entry stays small enough for a snappy first paint and (b)
        // individual libraries can be cached independently across releases.
        //
        // Pragmatic grouping: keep React tight (used everywhere), split
        // editor stacks (Tiptap, CodeMirror) since they're large, and
        // isolate each syntax-highlighting / diagramming library. Shiki's
        // per-language grammars already split automatically — no help
        // needed there.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // Stable libraries that benefit from grouping: small enough to
          // bundle as one chunk, and frequently changed together. Mermaid
          // and Shiki are INTENTIONALLY not grouped here — Rollup's default
          // splitting gives them per-diagram-type and per-grammar chunks
          // that dynamic-import on demand, which we want to keep.
          if (id.includes("/katex/")) return "vendor-katex";
          if (id.includes("/@tiptap/") || id.includes("/tiptap-markdown/") || id.includes("/prosemirror"))
            return "vendor-tiptap";
          if (id.includes("/@codemirror/") || id.includes("/codemirror/"))
            return "vendor-codemirror";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/"))
            return "vendor-react";
          return undefined;
        },
      },
    },
  },
}));
