# WBS — Virtual 3D Agent Office v1.0

**Owner:** Project Manager · **Date:** 2026-10-19 · **Status:** complete (single iteration)

Work breakdown with the owning role and the evidence that closes each package.

| # | Work package | Owner (role) | Deliverable | Status | Evidence |
|---|---|---|---|---|---|
| **1** | **Planning & audit** | | | ✅ | |
| 1.1 | Audit the workspace and the reference repo (`kantor-rpg`), license check | Solution Architect | `IMPLEMENTATION_PLAN.md` §1–2 | ✅ | license = MIT © 2026 Budi Prabhawa |
| 1.2 | Build/pass the attribution gates (Gate 0) | AI Orchestrator | gate logs | ✅ | `verify-attribution.ps1`, `verify-official-upstream.ps1`, `check-github-entitlement.ps1` all OK |
| 1.3 | SRS (requirements, stories, AC) | Business/System Analyst | `docs/srs/SRS-office-v1.md` | ✅ | 15 FR, 8 NFR, 13 AC |
| 1.4 | Architecture + ADRs | Solution Architect | `docs/architecture/{ARCHITECTURE.md,decisions.md}` | ✅ | ADR-1…ADR-7 |
| 1.5 | Design (visual + interaction) | UI/UX Designer | `docs/design/DESIGN.md` | ✅ | |
| 1.6 | Task board | Project Manager | `docs/tasks/board/sprint-1.md` | ✅ | |
| **2** | **Asset pipeline** | | | ✅ | |
| 2.1 | Vendor MIT assets unmodified (building, characters, furniture, signage, dataset) + NOTICE | DevOps | `public/assets/{building,characters,furniture,signage,world}`, `vendor/kantor-rpg/{LICENSE,NOTICE}` | ✅ | ADR-3 |
| 2.2 | Fetch + optimize CC0 Poly Haven props + HDRI | DevOps | `scripts/fetch-assets.mjs`, `scripts/optimize-assets.mjs`, `public/assets/{polyhaven,hdri}` | ✅ | 11 props + 1 HDRI |
| 2.3 | Credits registry | Technical Writer | `src/data/assetCredits.js` | ✅ | `docs/assets/ASSET-REGISTER.md` |
| **3** | **Core runtime** | | | ✅ | |
| 3.1 | Renderer, quality presets, resize, teardown hooks | Frontend Eng | `src/core/{renderer,quality}.js` | ✅ | |
| 3.2 | GLTF/HDRI cache with failure capture | Frontend Eng | `src/core/assets.js` | ✅ | `getFailureReport()` |
| 3.3 | Loading screen + fatal-error surface | Frontend Eng | `src/core/{loading,events}.js` | ✅ | e2e #1, #4 |
| 3.4 | Remote-control / seed flags | Frontend Eng | `?quality`, `?seed` | ✅ | used by tests |
| **4** | **World** | | | ✅ | |
| 4.1 | Load + validate + normalise the vendored dataset | Database/Backend Eng | `src/world/worldData.js` | ✅ | unit `world data` |
| 4.2 | Coordinate conversion (single source) | Solution Architect | `src/world/coords.js` | ✅ | ADR-2 |
| 4.3 | Building shell + animated door leaves | Frontend Eng | `src/world/building.js` | ✅ | doors open for agents |
| 4.4 | Furniture batching + pick proxies | Frontend Eng | `src/world/{furniture,materials}.js` | ✅ | 54 models, merged per material |
| 4.5 | Workstation tech props | Frontend Eng | `src/world/props.js` | ✅ | ADR-4 |
| 4.6 | Signage / artwork | Frontend Eng | `src/world/signage.js` | ✅ | |
| 4.7 | Office additions (repurpose 3 rooms, drop 8 RPG types, clear doorways) | Tech Lead | `src/data/{fixtures,officeAdditions}.js` | ✅ | ADR-7; unit clearance test |
| **5** | **Agents** | | | ✅ | |
| 5.1 | Roster + identities | Product Owner | `src/data/agents.js` | ✅ | 9 agents, 5 divisions |
| 5.2 | Character model, mixer, LOD, labels, visible toggle | Frontend Eng | `src/agents/{agent,labels}.js` | ✅ | |
| 5.3 | Status → animation mapping | Frontend Eng | `src/agents/animations.js` | ✅ | unit + e2e |
| 5.4 | Navigation: raster grid + A\* + string pull + seat clearance | Backend Eng | `src/agents/navigation.js` | ✅ | unit `navigation` |
| 5.5 | Seeded activity simulation + seat reservation + level travel | Backend Eng | `src/agents/simulation.js` | ✅ | unit `simulation` |
| **6** | **Interaction** | | | ✅ | |
| 6.1 | Camera rig: orbit / focus / follow / overview / floor clipping | Frontend Eng | `src/interaction/camera.js` | ✅ | e2e #3 |
| 6.2 | Picking (raycast agents + Box3 proxies) | Frontend Eng | `src/interaction/picking.js` | ✅ | |
| 6.3 | Pointer/keyboard input with drag-vs-click | Frontend Eng | `src/interaction/input.js` | ✅ | |
| **7** | **UI** | | | ✅ | |
| 7.1 | HUD: stats, attention, divisions, roster, feed | Frontend Eng | `src/ui/hud.js` | ✅ | e2e #3 |
| 7.2 | Detail panel (agent / room / fixture) with live refresh | Frontend Eng | `src/ui/detail.js` | ✅ | e2e #3 |
| 7.3 | Overlays: credits + help | Frontend Eng | `src/ui/overlays.js` | ✅ | e2e #3 |
| 7.4 | No-WebGL DOM fallback | Frontend Eng | `src/ui/fallback.js` | ✅ | implemented (test gap noted) |
| 7.5 | Styling + responsive layout | UI/UX Designer | `src/styles/main.css` | ✅ | 3 viewports |
| **8** | **Verification & docs** | | | ✅ | |
| 8.1 | Unit tests | QA Engineer | `tests/unit/*` | ✅ | 10/10 |
| 8.2 | E2E tests + screenshots | QA Engineer | `tests/e2e/*`, `docs/qa/screens/*` | ✅ | 15/15 |
| 8.3 | Production build | DevOps | `dist/` | ✅ | |
| 8.4 | Performance measurement | QA Engineer | `docs/qa/QA-REPORT.md` §5 | ✅ | 3 presets |
| 8.5 | Code review | Code Reviewer | `docs/review/code-review.md` | ✅ | approved |
| 8.6 | QA report + release notes + README + register | Technical Writer | `docs/qa`, `docs/release`, `README.md`, `docs/assets` | ✅ | |
| 8.7 | Project card | AI Orchestrator | `../PROJECT.md` | ✅ | |

## Critical path

`2.1 → 4.1 → 4.3/4.4 → 5.4 → 5.5 → 6.1 → 7.1 → 8.1 → 8.2 → 8.3`

## Remaining (out of v1 scope, tracked)

- ESLint + type checking (review P1)
- Split `src/main.js` composition (review P1)
- Prop LOD / shadow trimming for Medium/High fps (QA §5)
- E2E coverage for the DOM fallback and reduced-motion (QA §7)
- Resolve 6 `npm audit` advisories
