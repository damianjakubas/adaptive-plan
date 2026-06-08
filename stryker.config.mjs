/** @type {import('@stryker-mutator/core').PartialStrykerOptions} */
const config = {
  coverageAnalysis: "perTest",
  ignorePatterns: [".gemini"],
  reporters: ["html", "clear-text"],
  testRunner: "vitest",
};

export default config;
