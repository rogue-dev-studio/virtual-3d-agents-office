# Sprint 1 board — Fase 1–2 (foundations + vertical slice)

| Task | Owner role | Status | Evidence |
|---|---|---|---|
| TASK-001 Audit workspace + reference repo | Solution Architect | done | `IMPLEMENTATION_PLAN.md` §1–2 |
| TASK-002 Decide build-vs-fork + record ADRs | Solution Architect | done | `docs/architecture/decisions.md` |
| TASK-003 Asset register (source, license, size, tris) | Tech Lead | done | `docs/assets/ASSET-REGISTER.md` |
| TASK-004 Vendor MIT assets + fetch/optimize CC0 props | Tech Lead | done | `public/assets/**`, `scripts/fetch-assets.mjs`, `scripts/optimize-assets.mjs` |
| TASK-005 App scaffold (Vite, three, quality presets) | Frontend | done | `index.html`, `src/core/*` |
| TASK-006 World data loader + validation | Backend | done | `src/world/worldData.js` |
| TASK-007 Building shell + door leaves + floor switching | Frontend | done | `src/world/building.js` |
| TASK-008 Furniture batching + failure ledger | Frontend | done | `src/world/furniture.js` |
| TASK-009 Workstation + CC0 tech props | Frontend | done | `src/world/props.js` |
| TASK-010 Agent roster + character + animation mapping | Frontend | done | `src/agents/*` |
| TASK-011 Status→visual model + seeded simulation | Backend | done | `src/agents/simulation.js` |
| TASK-012 Navigation grid, A*, seat reservation, level travel | Backend | done | `src/agents/navigation.js` |
| TASK-013 Camera rig (orbit/pan/zoom/focus/overview) | Frontend | done | `src/interaction/camera.js` |
| TASK-014 Picking proxies + keyboard/touch input | Frontend | done | `src/interaction/*` |
| TASK-015 HUD, dashboard, agent/room/workstation panels | UI/UX | done | `src/ui/*` |
| TASK-016 Credits & Asset Licenses modal | UI/UX + Legal | done | `src/ui/credits.js`, `src/data/assetCredits.js` |
| TASK-017 No-WebGL fallback directory | Frontend | done | `src/ui/fallback.js` |
| TASK-018 Unit tests (nav, simulation, world data) | QA | done | `tests/unit/*` |
| TASK-019 E2E tests + screenshots (desktop/tablet/mobile) | QA | done | `tests/e2e/*`, `docs/qa/screens/` |
| TASK-020 Production build + console/asset/credit audit | QA + Reviewer | done | `docs/qa/QA-REPORT.md`, `docs/review/CODE-REVIEW.md` |
| TASK-021 README + release notes | Technical Writer | done | `README.md`, `docs/release/RELEASE-NOTES.md` |

## Backlog (Fase 3+ / future)

| Task | Note |
|---|---|
| TASK-101 Optional player avatar (WASD walk) | the brief marks it conditional on having an avatar |
| TASK-102 Replace the seeded simulation with a real agent transport | `simulation.js` is the only seam needed |
| TASK-103 Bake/compress building GLBs with meshopt | size win, needs a decoder |
| TASK-104 Office editing (move furniture) | explicitly out of v1 scope |
| TASK-105 i18n (ID/EN) | copy is English only in v1 |
