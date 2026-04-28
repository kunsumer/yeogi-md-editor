import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement window.matchMedia — App.tsx uses it to resolve
// theme preference (system / light / dark). Stub with a minimal
// MediaQueryList shim so the theme-apply effect doesn't crash in tests.
// Default to "not matching" (i.e., light OS appearance).
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
