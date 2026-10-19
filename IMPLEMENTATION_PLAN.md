# IMPLEMENTATION_PLAN.md

**Project:** Virtual 3D Agent Office — Realistic AI Workspace
**Folder:** `virtual-3d-agents-office/` (id `virtual-3d-agents-office`, GitHub-safe: lowercase, hyphens)
**Date:** 2026-10-19 · **Status:** v1.0.0 implemented and verified locally (10/10 unit, 15/15 e2e, production build green) — see `docs/qa/QA-REPORT.md`
**Author:** AI Agents Rogue — AI Orchestrator + Solution Architect + Tech Lead (+ QA, Technical Writer)

---

## 1. Audit of the workspace

The requested folder was empty (created in the previous step). There was no existing app in
it, so nothing had to be preserved or migrated. `D:\explore` is **not** a git repository, so all
work here is plain files (no commits are made unless the user asks).

Toolchain found on the machine: Node.js 26.12.0, npm 11.20.0, PowerShell 5.1, curl, Chromium
(installed later for Playwright). No Blender, no Python requirement for running the app.

## 2. Audit of the reference repository (`air-buddy410/kantor-rpg`)

The repository was cloned and inspected file by file (not from screenshots).

| Aspect | Finding |
|---|---|
| License | **MIT**, `Copyright (c) 2026 Budi Prabhawa`. `NOTICE` lists only three.js (MIT) and Alegreya Sans (OFL-1.1) as third-party. |
| Stack | Vite 8 + three.js 0.186 + **TypeScript**, ES modules, `app/` for the 3D client, `server/` (private, optional) for agent chat. |
| Architecture | Data-driven: `design/world.json` (36 rooms, 44 doors, 39 windows, 201 fixtures, 118 activity slots, 9 actors) + `design/derived/walls.json` (wall pieces, openings, door leaves). The Blender models + CAD sheets are generated from that same dataset. |
| Runtime modules | `world/build.ts` (builds floors, merges by material), `world/furniture-kit.ts` (GLB loader), `world/navgrid.ts` (0.1 m raster + A*), `game/{avatar,npcs,camera,input}.ts`, `sim/idle.ts` (seeded NPC day). |
| Assets | 65 GLB, all **procedurally generated and original** — `design/asset-registry.json` records creator `kantor-rpg procedural script`, license `original, MIT`. 9 characters with 24 named animation clips each (walk, run, sit, type, type_fast, talk, read, coffee, …). |
| Gaps vs. our brief | No monitors, keyboards, PCs or laptops (the `desk` GLB is a desk only), RPG content (billiard, arcade, treadmill), Indonesian room names, and a player-avatar RPG loop rather than an agent-status command center. |
| Verdict | The **assets and world dataset are perfect raw material**; the 100-file TS app is tied to the RPG loop we do not want. |

## 3. Decision: build new, vendor the MIT assets

Evaluated three options:

1. **Fork `kantor-rpg` and modify it.** Rejected: we would carry the RPG loop (player avatar,
   15 mini games, arcade, gym, studio, private Telegram backend) and diverge massively; TypeScript
   gives no benefit here, and the brief explicitly prefers ES modules unless there is a strong reason.
2. **Build everything from scratch, including models.** Rejected: Blender is not available on this
   machine, and hand-built primitive furniture is exactly what the brief forbids as a final result.
3. **Build a new focused app (Vite + three.js + ES modules) and vendor the MIT assets/dataset from
   `kantor-rpg`, adding CC0 Poly Haven props for the gaps.** ← **chosen**

Consequences, all documented in `docs/assets/ASSET-REGISTER.md` and in the in-app
*Credits & Asset Licenses* modal:

- `LICENSE`/`NOTICE` of the source project are preserved (`public/assets/vendor/kantor-rpg/NOTICE`).
- `public/assets/world/world.json` + `walls.json`, `building/`, `characters/`, `furniture/` and
  `signage/` are vendored unmodified, with their MIT copyright notice.
- Room **display names and divisions are remapped in our data layer** (`src/data/rooms.js`); the
  geometry is untouched so the vendored walls and door openings stay valid.
- Billiard / arcade / gym fixtures are filtered out (our office is a software company); three
  repurposed rooms receive our own added fixtures (`src/data/officeAdditions.js`).
- Poly Haven CC0 models fill the tech gaps: desk monitors, laptops, lamps, notepads, cabinets,
  bins, clock, plant, server-room props, projector screen. Downloaded by
  `scripts/fetch-assets.mjs`, optimized by `scripts/optimize-assets.mjs`.

## 4. Target stack

Vite 7 · three.js 0.186 · JavaScript ES modules · GLTFLoader · HDRLoader (HDRI) ·
AnimationMixer · Raycaster + Box3 picking proxies · custom 3/4 orbit camera rig ·
CSS (no framework) · Vitest + Playwright.

## 5. Architecture outline

```
index.html → src/main.js
  core/      renderer, assets (GLTF/HDRI cache), loading manager, quality presets, fallback gate
  world/     worldData (load+validate), building (shell GLB + doors), furniture (vendored GLB),
             props (Poly Haven tech props on every desk), signage, materials (shared + batched)
  agents/    roster (data), agent (model + mixer + state), animations (clip mapping),
             simulation (seeded tasks/status), navigation (raster + A* + seat reservation)
  interaction/camera (orbit/focus/floors), picking (agents/desks/rooms), input (keyboard/touch)
  ui/        hud, dashboard, agentPanel, roomPanel, credits, help, loading, dom helpers
  data/      agents, divisions, tasks, rooms, officeAdditions, assetCredits
```

Full detail: `docs/architecture/ARCHITECTURE.md`.

## 6. Phases and current state

| Fase | Scope | State |
|---|---|---|
| 1 | Audit + plan + asset register + SRS/planning/architecture/design/tasks | **done** |
| 2 | Vertical slice: one real workspace, GLB furniture, ≥2 agents, animation, camera, selection, agent panel, credits modal | **done** |
| 3 | Two floors, navigation between rooms/floors, agent walking, room/object interaction, simulation system | **done** |
| 4 | Full HUD/dashboard, quality presets, responsive, fallback + error handling | **done** |
| 5 | build/vitest/Playwright (desktop, tablet, mobile), console + asset + credits checks | **done** — 10/10 unit, 15/15 e2e; see `docs/qa/QA-REPORT.md` |

## 7. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Vendored dataset is authored for a different narrative | Names/divisions remapped in data only; geometry untouched so walls/doors/nav stay consistent |
| R2 | GLB props from Poly Haven may not have the axis/orientation assumed | Placement in the desk's local frame, verified from rendered screenshots |
| R3 | Bundled size | `assets:optimize` (quantize + simplify + 512 px textures) cuts 2.1 MB → 0.5 MB per model |
| R4 | Nav grid cost (0.1 m cells, 2 floors) | Grid built lazily per floor, A* capped, paths smoothed |
| R5 | Simulation could be mistaken for real AI work | "Simulation" badge in HUD/agent panel + README + this plan |
| R6 | 3rd-party asset license drift | Every entry in `assetCredits.js` carries source URL, license and status; `unverified` never ships as final |

## 8. Acceptance criteria

See `docs/srs/SRS-office-v1.md` §6 — the 13 criteria from the brief are tracked there with the
evidence that closes each one.
