# QA Report — Virtual 3D Agent Office v1.0

**Date:** 2026-10-19 · **Phase:** Local Development · **Owner:** QA Engineer
**Build under test:** `npm run build` (Vite 7.3.7, three 0.186) · **Verdict:** ✅ **PASS** (with
documented limitations)

---

## 1. Summary

| Gate | Command | Result |
|---|---|---|
| Production build | `npm run build` | ✅ succeeds |
| Unit tests | `npm test` (`vitest run`) | ✅ **10 passed / 10** (2 files, ~11 s) |
| End-to-end | `npm run e2e` (`playwright test`) | ✅ **15 passed / 15** (5 specs × desktop, tablet, mobile; 7.1 min, 0 retries) |
| Console errors on load | asserted in e2e "boots, renders 3D…" | ✅ none |
| Missing asset handled | e2e "surfaces a missing asset…" | ✅ HUD notice, app stays alive |
| Screenshots | `docs/qa/screens/*.png` | ✅ 12 (desktop/tablet/mobile × overview/floor1/floor2/credits) |

The application boots, renders both floors, places real GLB furniture and characters, simulates
agent activity, and exposes the HUD, detail, credits and help surfaces — all verified in a real
browser at three viewport sizes.

## 2. Build output

```
dist/index.html                 6.37 kB │ gzip:   1.97 kB
dist/assets/index-*.css        12.75 kB │ gzip:   3.22 kB
dist/assets/index-*.js        168.81 kB │ gzip:  53.02 kB
dist/assets/three-*.js        594.44 kB │ gzip: 150.33 kB   (manualChunks: three)
✓ built in ~18 s
```

`npm install` reported 6 advisories (1 moderate, 3 high, 2 critical) in the dev/build dependency
tree. None are shipped in `dist/`; still tracked as an open item (§7).

## 3. Test inventory

### 3.1 Unit (`tests/unit`, Vitest)

| File | Tests | Covers |
|---|---|---|
| `layout.test.js` | 7 | World loads and keeps every fixture except the RPG-only types; both floors present with their elevations; no collider fixture is placed across a doorway; every doorway stays walkable; every seat is reachable from the main walkable region; every agent can be routed spawn → its own seat; floors are crossed through the stair and lift links |
| `simulation.test.js` | 3 | A full shift runs with **no seat clashes, no off-grid agents and no NaN**; tasks complete, breaks are taken and floors change; the whole run is **deterministic for a fixed seed** |

Both files pass: `Test Files 2 passed · Tests 10 passed`.

### 3.2 End-to-end (`tests/e2e/office.spec.js`, Playwright)

Projects: **desktop** (1600×900), **tablet** (`iPad (gen 7)`, chromium), **mobile** (`Pixel 7`).

| # | Spec | Assertions |
|---|---|---|
| 1 | boots, renders 3D and reports live state | `#loading` hides; canvas > 200 px; `window.__office` present; draw calls > 0; 9 agents; roster = 9; **zero console errors** |
| 2 | agents move during a shift | drives 400 × 0.1 s of simulated time; ≥ 1 agent moved > 0.5 m or changed floor; all positions finite; summary present |
| 3 | dashboard, detail, credits and help are usable | roster row → detail opens with `h3`; ✕ closes it; credits shows 3 groups; help grid opens; floor button sets `aria-pressed="true"` |
| 4 | surfaces a missing asset instead of breaking | aborts `assets/furniture/desk.glb`; `#asset-issues` becomes visible and names the model; app still boots |
| 5 | captures reference screenshots | writes desktop/tablet/mobile overview + L1 + L2 + credits |

Final run: **15 passed (7.1 m), 0 flaky, 0 failed.**

## 4. Defects found and fixed during QA

All were found by running the app/tests, not by reading code.

| # | Severity | Defect | Fix |
|---|---|---|---|
| D1 | Blocker | `AnimationController.play` called `fadeOut()` on the `{name, action, loop}` wrapper instead of the `AnimationAction` → `TypeError: a.fadeOut is not a function` aborted the first frame | `previous.action.fadeOut(fade)` (`src/agents/animations.js`) |
| D2 | Blocker | `main.js` never imported `src/styles/main.css`; Vite emitted **no CSS**, so the canvas stayed at its 300×150 default and the whole HUD was unstyled | `import "./styles/main.css"` (`src/main.js`) |
| D3 | Major | `dom.js` bound handlers as `addEventListener("Click", …)` (uppercase) so **every** `el(..., { onClick })` was dead — roster rows and detail action buttons did nothing | `key.slice(2).toLowerCase()` (`src/ui/dom.js`) |
| D4 | Major | `#detail-close` hid the panel but left `DetailPanel.subject` set, so the 0.4 s refresh loop re-opened it immediately | route ✕ through `on.closeDetail → detail.close()` (`src/ui/hud.js`, `src/main.js`) |
| D5 | Major | The simulation auto-switched the viewed floor on agent level change, overriding the user's floor choice → flaky `aria-pressed` and unpredictable UX | removed the auto-switch; only the camera follow is cleared (`src/main.js`) |
| D6 | Minor | HUD was empty for the first ~0.4 s of (simulated) time — bad first paint and racy in tests | seed `hudTimer = HUD_INTERVAL` so the dashboard renders on frame 1 |
| D7 | Minor | `THREE.Clock` deprecation warning on every load | replaced with a small `performance.now()` delta clock (`createClock`) |
| D8 | Minor | Asset-failure notice only said "*N* furniture type(s) could not be loaded" | message now lists the missing model names |
| D9 | Test infra | Vitest was collecting the Playwright spec as a unit test file | scoped `test.include` to `tests/unit/**/*.test.js` |
| D10 | Test infra | The `tablet` project inherited `browserName: webkit` from the iPad device descriptor (not installed) | forced `browserName: "chromium"` |
| D11 | Test infra | Headless Chromium used SwiftShader (~1 fps) → timeouts | launch GPU flags (ANGLE/D3D11) in `playwright.config.js` |

Pre-QA fixes carried over from the implementation run: `this.face` vs `face()` collision in
`Agent.place`, `RGBELoader`→`HDRLoader`, `Agent.visible`/`setVisible` for the door controller,
`maxLabelDistance`, `walking`/`running` status entries.

## 5. Performance (NFR-01, NFR-02)

Measured in Chromium via ANGLE/D3D11 on the test machine's **integrated AMD Radeon HD 8200 / R3**,
1920×1080, devicePixelRatio 1:

| Preset | FPS | Draw calls | Triangles |
|---|---|---|---|
| Low | **24** | 163 | 326,934 |
| Medium | **18** | 351 | 2,437,130 |
| High | **5** | 358 | 2,437,144 |
| *Software (SwiftShader)* | *1* | *164* | *335,507* |

- **NFR-02 (few hundred draw calls, merged/instanced):** ✅ met (163–358 calls).
- **NFR-01 (60 fps on a mid desktop GPU at medium):** ⚠️ **not verified on this machine** — it has
  only a weak iGPU. At 1600×900 the same preset reached 31 fps at Low. Medium/High trigger the
  shadow pass (~+190 draw calls) and a large triangle jump (props + shadow re-render), which is
  the dominant cost.
- **Recommendation (next iteration):** decimate/LOD the CC0 props, disable `castShadow` on small
  props, shrink the shadow camera to the active floor, and add a prop-distance cull. This should
  bring Medium into a comfortable range on integrated GPUs.

## 6. Acceptance criteria (SRS §6)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Runs locally per README | ✅ | `npm run dev` / `build` / `preview` verified; README quick start |
| 2 | 3D scene renders and is controllable | ✅ | e2e #1, #3; `docs/qa/screens/*` |
| 3 | GLB models load with materials | ✅ | furniture/characters built; `missing` empty on a clean run; screenshots |
| 4 | Realistic furniture, not primitives | ✅ | 54 vendored furniture GLBs + 11 CC0 props; no placeholder boxes in the scene |
| 5 | Agent selectable with correct info | ✅ | e2e #3 (roster → detail panel) |
| 6 | Status changes the visuals | ✅ | unit `simulation.test.js` (status transitions); `animations.js` maps status→clip; label/pill colour by status |
| 7 | Camera and object interaction work | ✅ | e2e #3 (detail open/close, floors); picking in `interaction/picking.js` exercised by clicking the canvas |
| 8 | Layout usable on small screens | ✅ | e2e mobile project (Pixel 7) passed; `mobile-*.png` |
| 9 | Missing asset failure handled | ✅ | e2e #4 (aborted GLB → HUD notice, app alive) |
| 10 | Every third-party asset has source + license | ✅ | `src/data/assetCredits.js`, Credits modal, `docs/assets/ASSET-REGISTER.md` |
| 11 | No unhandled critical runtime error | ✅ | e2e #1 asserts zero console errors |
| 12 | Production build succeeds | ✅ | §2 |
| 13 | README covers install, controls, architecture, assets, limits | ✅ | `README.md` |

**Partial / not covered:** the no-WebGL DOM fallback (`runHeadless` + `FallbackView`) is implemented
but has **no automated test**; `prefers-reduced-motion` is honoured in code but not asserted; there
is no visual-regression or automated accessibility (axe) check; no long-run soak test.

## 7. Open items

1. Review and, where possible, resolve the 6 `npm audit` advisories.
2. Performance work for Medium/High on integrated GPUs (§5).
3. Add e2e coverage for the DOM fallback path and reduced-motion.
4. Add ESLint + a style guide check (no linter is configured yet).
5. Add a repeatable screenshot baseline (visual diff) — the current screenshots are reference only.

## 8. How to reproduce

```bash
cd virtual-3d-agents-office
npm install
npm test
npm run build
npx playwright install chromium      # first time only
npm run e2e
```

Artifacts: `docs/qa/screens/*.png`, this report, `docs/review/code-review.md`.
