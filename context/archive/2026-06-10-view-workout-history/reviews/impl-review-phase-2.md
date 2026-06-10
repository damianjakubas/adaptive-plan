<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: View Workout History (S-02)

- **Plan**: context/changes/view-workout-history/plan.md
- **Scope**: Phase 2 of 3
- **Date**: 2026-06-10
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical  2 warnings  1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Mirror implementation in absolute-date assertions

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/tests/components/history/history-list.test.tsx:100-103, 120-123
- **Detail**: The test derives expected absolute-date strings with inline `new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" })` helpers. The component calls `format.dateTime(...)` with exactly the same options (history-list.tsx:35-38). If the options are ever changed in the component (e.g. month: "long"), the test replicates the same change and still passes — it proves "the component uses the options it uses", not "the output matches the mockup spec".
- **Fix**: Replace the inline Intl helpers with hardcoded locale-specific strings derived from the mockup/spec. Run once to get the actual output, then pin it: `// en: "10 Jun 2026"   pl: "10 cze 2026"`. Use describe.each's locale to branch the expected strings.
  - Strength: Hardcoded string is the oracle — a format-option change in the component now fails the test, which is the point.
  - Tradeoff: Locale-specific strings must be maintained if supported locales expand (currently just PL/EN — low risk).
  - Confidence: HIGH — duration assertions (lines 151-154) already use this pattern correctly ("1h 15m", "45m", etc.).
  - Blind spot: None significant.
- **Decision**: FIXED via hardcoded locale-specific strings (en: "Jun 10, 2026" / "Jun 1, 2026" / "Sunday"; pl: "10 cze 2026" / "1 cze 2026" / "niedziela")

### F2 — No timeZone in NextIntlClientProvider test helper

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/tests/components/history/history-list.test.tsx:68
- **Detail**: `renderList` passes no `timeZone` to `NextIntlClientProvider`. `src/i18n/request.ts` also sets no explicit timezone, so both production and tests inherit the system timezone. On a CI server in a different timezone than the developer's machine, the absolute-date assertions (lines 107, 112-113, 120-124) would produce different strings and silently fail. Vercel production runs UTC; a developer in Europe/Warsaw (UTC+2) gets different formatted dates for midnight-adjacent fixtures.
- **Fix**: Add `timeZone="UTC"` to `NextIntlClientProvider` in `renderList`. Also add it to the empty-state test helper for consistency.
- **Decision**: FIXED — added `timeZone="UTC"` to both `renderList` and `renderEmptyState` helpers

### F3 — No test for empty sessions boundary

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/tests/components/history/history-list.test.tsx
- **Detail**: The page guards against passing sessions=[] to HistoryList, but HistoryList itself is never tested with an empty array. If a future caller skips the guard, the component renders an empty `<ul>` with visible headers — not a crash but a broken layout.
- **Fix**: Add a one-liner test: `it("renders no rows when sessions is empty", () => { ... expect(screen.queryAllByRole("listitem")).toHaveLength(0); })`.
- **Decision**: FIXED — test added; 18/18 green
