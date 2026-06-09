import { describe, expect, it } from "vitest";

import enMessages from "@/i18n/messages/en.json";
import plMessages from "@/i18n/messages/pl.json";

type Catalog = Record<string, unknown>;

function collectPaths(obj: unknown, prefix = ""): Map<string, unknown> {
  const result = new Map<string, unknown>();
  if (typeof obj !== "object" || obj === null) {
    result.set(prefix, obj);
    return result;
  }
  for (const [key, value] of Object.entries(obj as Catalog)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value) || typeof value !== "object" || value === null) {
      result.set(path, value);
    } else {
      for (const [subPath, subValue] of collectPaths(value, path)) {
        result.set(subPath, subValue);
      }
    }
  }
  return result;
}

describe("i18n catalog parity — pl vs en", () => {
  const plPaths = collectPaths(plMessages);
  const enPaths = collectPaths(enMessages);

  it("pl and en have identical key sets (no missing keys in either direction)", () => {
    const plKeys = new Set(plPaths.keys());
    const enKeys = new Set(enPaths.keys());

    const missingInEn = [...plKeys].filter((k) => !enKeys.has(k));
    const missingInPl = [...enKeys].filter((k) => !plKeys.has(k));

    expect(missingInEn, "Keys present in pl but missing in en").toEqual([]);
    expect(missingInPl, "Keys present in en but missing in pl").toEqual([]);
  });

  it("leaf value types match at every path (string↔string, array↔array, etc.)", () => {
    const mismatches: string[] = [];
    for (const [path, plValue] of plPaths) {
      const enValue = enPaths.get(path);
      const plType = Array.isArray(plValue) ? "array" : typeof plValue;
      const enType = Array.isArray(enValue) ? "array" : typeof enValue;
      if (plType !== enType) {
        mismatches.push(`${path}: pl=${plType}, en=${enType}`);
      }
    }
    expect(mismatches, "Type mismatches between pl and en").toEqual([]);
  });

  it("array lengths match at every path", () => {
    const mismatches: string[] = [];
    for (const [path, plValue] of plPaths) {
      if (!Array.isArray(plValue)) continue;
      const enValue = enPaths.get(path);
      if (!Array.isArray(enValue) || plValue.length !== enValue.length) {
        mismatches.push(
          `${path}: pl.length=${Array.isArray(plValue) ? plValue.length : "n/a"}, en.length=${Array.isArray(enValue) ? enValue.length : "n/a"}`,
        );
      }
    }
    expect(mismatches, "Array length mismatches between pl and en").toEqual([]);
  });

  // Explicitly pin the two arrays consumed by generation-loader.tsx via t.raw(...)
  // so a length change is caught even if the general array-length test above passes.
  it("Plan.loaderStatuses has length 6 in both catalogs (consumed by generation-loader via t.raw)", () => {
    expect(plMessages.Plan.loaderStatuses).toHaveLength(6);
    expect(enMessages.Plan.loaderStatuses).toHaveLength(6);
  });

  it("Plan.loaderQuotes has length 5 in both catalogs (consumed by generation-loader via t.raw)", () => {
    expect(plMessages.Plan.loaderQuotes).toHaveLength(5);
    expect(enMessages.Plan.loaderQuotes).toHaveLength(5);
  });
});
