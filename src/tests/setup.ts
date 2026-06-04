import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom lacks ResizeObserver, which Radix primitives (e.g. Slider) touch on mount.
// Provide a no-op stub so component tests rendering those primitives can run.
vi.stubGlobal(
  "ResizeObserver",
  class {
    disconnect() {}
    observe() {}
    unobserve() {}
  },
);

// React Testing Library does not auto-unmount between tests under Vitest;
// clear the rendered tree after each test to keep them isolated.
afterEach(() => {
  cleanup();
});
