# Release Notes — Virtual 3D Agent Office v1.0.0

**Release date:** 2026-10-19 · **Channel:** GitHub Pages (public)
**Live:** https://rogue-dev-studio.github.io/virtual-3d-agents-office/
**Repo:** https://github.com/rogue-dev-studio/virtual-3d-agents-office
**Author:** Rogue Development (`@rogue-dev-studio`) — AI Agents Rogue v1.4.0
**License:** MIT · **Build:** Vite production bundle, `dist/` (built by CI, not committed)

---

## Highlights

First working release of the explorable 3D agent office.

- **Two-floor, 36-room office** rendered from the vendored `kantor-rpg` dataset — building shell,
  doors that open for characters, 54 furniture models, signage and the vertical stair/lift links.
- **Nine animated agents** with skeleton, 24 named clips each, LOD, and a status-driven animation
  mapping (idle / thinking / working / reviewing / in_meeting / waiting_approval / completed / error).
- **Seeded activity simulation**: agents take tasks, walk between rooms and floors, sit, take
  breaks and return home; seats are reserved so two agents never share a chair; reproducible by seed.
- **Interaction**: click an agent, desk, prop or room for a panel; focus/follow camera; floor filter
  (L1 / L2 / Both); overview; fullscreen; keyboard shortcuts.
- **HUD dashboard**: totals, working/attention counts, tasks/trips/floor-moves/breaks, divisions,
  attention list, live activity feed and the live roster.
- **Credits & Asset Licenses** modal generated from one central registry.
- **Quality presets** (Auto/Low/Medium/High) and a **DOM fallback** for devices without WebGL.
- **Tested:** 10 unit tests + 15 browser end-to-end tests across desktop, tablet and mobile.

## Fixed in this release

QA found and we fixed (details in `docs/qa/QA-REPORT.md`):

- Crash on the first frame — fading a non-`AnimationAction`.
- The stylesheet was never imported (unstyled UI, 300×150 canvas).
- `onClick` handlers registered with the wrong event-name case (dead buttons).
- The detail panel re-opened itself right after being closed.
- The viewed floor was overridden by the simulation.

## New assets / third-party additions

- CC0 **Poly Haven** props: classic laptop, Television_01, notepads, stationery, desk lamp, drawer
  cabinet, trash can, wall clock, circuit board, power box, projector screen — plus the
  `studio_small_09` HDRI for image-based lighting.
- The upstream MIT `LICENSE`/`NOTICE` are now vendored at `public/assets/vendor/kantor-rpg/`.
- Full inventory: `docs/assets/ASSET-REGISTER.md`.

## Known limitations

- Front-end simulation only — no backend, auth, persistence or real agents.
- Not 60 fps at Medium on integrated GPUs (see QA §5); 24 fps at Low, 18 at Medium, 5 at High on
  an AMD Radeon HD 8200 at 1080p.
- DOM fallback path implemented but not covered by an automated test.
- Small unreachable pockets behind some upstream furniture (98.8 % / 96.0 % walkable).
- 6 open `npm audit` advisories in the dev/build tree (none shipped).
- Static GitHub Pages hosting only — no API origin, so all state lives in the browser session.

## Upgrade / install

```bash
git clone https://github.com/rogue-dev-studio/virtual-3d-agents-office.git
cd virtual-3d-agents-office
npm install
npm run build && npm run preview
```

No migration steps — first release.

## Verification summary

| Gate | Result |
|---|---|
| `npm run build` | ✅ |
| `npm test` | ✅ 10/10 |
| `npm run e2e` | ✅ 15/15 (desktop, tablet, mobile) |
| Console errors | ✅ none on load |
| CI (`npm ci` + `npm test` + `npm run build`) | ✅ `39232839029` |
| GitHub Pages deploy | ✅ build → artifact → `deploy-pages` green |
| Live site check (headless Chromium) | ✅ 10/10 — 9 agents, 36 rooms, 164 draw calls, 0 console errors, 0 failed requests |
