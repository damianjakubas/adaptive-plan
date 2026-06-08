/** @type {import('@stryker-mutator/core').PartialStrykerOptions} */
const config = {
  coverageAnalysis: "perTest",
  mutate: ["src/lib/plan/errors.ts"],
  reporters: ["html", "clear-text"],
  testRunner: "vitest",
};

export default config;
