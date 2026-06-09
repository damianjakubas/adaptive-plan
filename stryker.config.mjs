/** @type {import('@stryker-mutator/core').PartialStrykerOptions} */
const config = {
  coverageAnalysis: "perTest",
  ignorePatterns: [".gemini"],
  mutate: [
    "src/app/api/plan/generate/route.ts",
    "src/components/plan/plan-generator.tsx",
  ],
  reporters: ["html", "clear-text"],
  testRunner: "vitest",
};

export default config;
