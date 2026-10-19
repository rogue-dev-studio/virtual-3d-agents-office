# Code Review — Virtual 3D Agent Office v1.0

**Date:** 2026-10-19 · **Reviewer:** Code Reviewer · **Scope:** full `src/`, `tests/`, `scripts/`,
build config · **Verdict:** ✅ **Approved** for local development, with follow-ups

---

## 1. What was reviewed

`src/{main,core,world,agents,interaction,ui,data}`, `src/styles/main.css`, `tests/unit`,
`tests/e2e`, `playwright.config.js`, `vite.config.js`, `scripts/{fetch,optimize}-assets.mjs`,
`index.html`. Reviewed against `docs/architecture/ARCHITECTURE.md`, the ADRs, and the coding
standard in `AGENTS.md` §9–§12.

## 2. Layering and separation of concerns

| Check | Result |
|---|---|
| Domain/data separated from rendering | ✅ `src/data/*` is plain data; `world/*` builds meshes from it and never mutates the dataset |
| No business rules in the "controller" layer | ✅ `main.js` only wires modules; simulation/agent own the rules |
| Single coordinate conversion | ✅ `world/coords.js` — no ad-hoc `toThree` math elsewhere |
| Persistence/domain model | ✅ `worldData.js` normalises the vendored JSON into lookups (`roomById`, `slotById`, `fixtureById`, `slotsByFixture`) |
| UI is a view, not a second source of truth | ✅ `Hud`/`DetailPanel` render from agent/simulation state; `DetailPanel.subject` is the only UI-owned state and is now correctly cleared on close |
| Dependency direction | ✅ `ui` and `interaction` do not import each other; both depend downward on `data`/domain |

## 3. Wrong-layer / duplicate-logic scan

- **No raw SQL / queries** (not applicable — no database).
- No duplicated navigation math: seats, standing spots and `NavGrid` all live in `agents/navigation.js`
  and `agents/simulation.js`.
- No duplicated asset-path logic: `data/fixtures.js#furnitureAssetUrl` is the single source.
- `applyLod`, `applyFloorClipping`, `createClock` are single-purpose helpers in `main.js`; acceptable,
  but see §6.

## 4. Correctness findings (all resolved during QA)

The five functional defects found by running the app (D1–D5 in `docs/qa/QA-REPORT.md`) were all
**type/contract mismatches that a linter or types would likely have caught early**:

1. `animations.js` faded a wrapper object instead of the `AnimationAction`.
2. `main.js` did not import its stylesheet.
3. `dom.js` registered `"Click"` instead of `"click"`.
4. `#detail-close` bypassed `DetailPanel.close()`, leaving stale state.
5. The simulation mutated the user's floor selection.

Standing review points, now addressed:

- A single error surface is used (`LoadingScreen.fail` + `#asset-issues`) rather than `alert`/swallow. ✅
- All loaders resolve `null` on error and record the failure, so one bad GLB cannot abort boot. ✅
- No `console.log` left in `src/`. ✅ (verified)

## 5. Security and privacy

| Check | Result |
|---|---|
| No secrets/keys committed | ✅ none |
| No runtime call to a third-party host | ✅ all assets are local (NFR-05) |
| User text injected as HTML | ✅ `dom.js` builds nodes / uses `textContent`; `innerHTML` is only on trusted, developer-authored strings |
| `innerHTML` usage | The `el(..., { html })` helper exists but is **not used anywhere**; all UI text goes through `textContent`. ✅ |
| Outbound requests | Only `localhost` (dev/preview) |

## 6. Maintainability and open recommendations

| Pri | Recommendation |
|---|---|
| P1 | **`src/main.js` is ~420 lines** — extract the composition into `app/bootstrap.js` + `app/scene.js` so wiring, the loop and teardown are testable without a DOM. |
| P1 | **Add a linter** (ESLint + a shared config) — D1/D3 are exactly the class of bug static analysis catches. There is currently no `npm run lint`. |
| P1 | **Add TypeScript JSDoc types or migrate** to TS for the module contracts (`Agent`, `Simulation`, `Picker.pick` return shape, fixture keys). The `a.fadeOut`/`Click` bugs were contract slips. |
| P2 | **Dispose discipline**: `MaterialCache.dispose` exists; wire a real `dispose()` on `main` teardown (renderer, geometries, textures, listeners) so an SPA route change cannot leak. |
| P2 | **Performance**: prop LOD + shadow-caster trimming (see QA §5). |
| P2 | `assets.js#getFailureReport` truncates to 3 URLs + "more" — fine, but surface the full list in the console for debugging. |
| P3 | `docs/` screenshots are committed binaries; consider generating them in CI instead of tracking. |
| P3 | `VENDORED_SOURCE.url` in `assetCredits.js` is a redacted placeholder (`https://github.com/…/kantor-rpg`). Fine while the upstream URL must not be published, but document *why* in the register. |

## 7. Coding-standard conformance (`AGENTS.md` §9)

| Rule | Result |
|---|---|
| Clean code, modular, reusable, testable | ✅ |
| No dead code / unused imports | ✅ (checked `main.js` and UI modules; `Picker` is used via `InputController`) |
| Naming consistent | ✅ (camelCase fns, PascalCase classes, `#private` methods) |
| "Zero Comment" | ⚠️ **intentional deviation** — the code carries short *doc* comments (JSDoc on exported classes and module headers) as required for self-documenting code and the deliverable's readability. No line-by-line/obvious comments. Recommend recording this deviation as a project standard rather than silently diverging. |
| Type safe | ⚠️ plain JS, no type checking — see P1 above |
| Request/validation/response layering | n/a (no HTTP layer in v1) |

## 8. Test quality

- Unit tests assert **invariants**, not implementation details (no seat clashes, reachability,
  determinism) — good, they would catch regressions in the reservation/navigation logic.
- E2E test #2 drives simulated time directly instead of sleeping, so it is not frame-rate dependent — good.
- Gaps: no visual-regression baseline; the DOM fallback path and reduced-motion are untested; no axe/a11y audit.
- `playwright.config.js` carries GPU launch flags: a pragmatic fix for headless SwiftShader, but it is
  environment-specific — comment it and consider a CI variant.

## 9. Conclusion

The codebase is clean, well-layered and consistent with its own architecture and the vendored-data
constraints. No blocking issues remain; the five runtime defects are fixed and covered by tests.
The highest-value follow-ups are **a linter** and **splitting `main.js`** — both would have prevented
the exact bugs QA found.
