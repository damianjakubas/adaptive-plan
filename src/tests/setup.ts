import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// React Testing Library does not auto-unmount between tests under Vitest;
// clear the rendered tree after each test to keep them isolated.
afterEach(() => {
  cleanup();
});
