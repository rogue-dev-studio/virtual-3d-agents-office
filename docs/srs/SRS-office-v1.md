# SRS — Virtual 3D Agent Office v1

**Version:** 1.0 · **Status:** approved for local development · **Phase:** Local Development
**Owner:** AI Orchestrator · **Approver:** Product Owner (user)

## 1. Purpose

Deliver a browser application in which a realistic, explorable 3D two-floor technology office
is the centre of the experience: AI agents are represented as animated characters that occupy
workstations, move between rooms, and report their work status through an in-world HUD.

The app must be extensible into a real multi-agent system later, but **v1 is explicitly a
front-end simulation** (seed-driven) — this is stated in the UI and never claimed otherwise.

## 2. Scope

### In scope (v1)

- Two-floor office shell (vendored, MIT) with lobby, open-plan workspace, per-division rooms,
  meeting room, CEO office, QA lab, server room, pantry, lounge, stairs/lift, terrace.
- Realistic furniture from vendored GLB models plus CC0 Poly Haven tech props.
- 9 agent characters with identity, role, division, workstation, status, current task,
  progress, last-activity time and activity log.
- Seeded activity simulation that drives status → animasi → perpindahan ruangan.
- Navigation: raster navigation grid + A*, seat reservation, no walking through walls or furniture.
- Camera: orbit/pan/zoom, focus an agent, focus a room, return to overview, floor switching.
- Interaction: click agent → profile panel; click desk → workstation panel; click room →
  occupant list; click prop → info.
- HUD/dashboard: agent totals, working/idle counts, active/completed/error tasks, activity feed,
  division list, attention list.
- Credits & Asset Licenses modal fed by a single central registry.
- Quality presets (low/medium/high/auto), fullscreen, help overlay, reduced-motion support.
- Graceful degradation: DOM directory when WebGL is unavailable; visible notice when a GLB fails.

### Out of scope (v1)

- Real backend/LLM calls, auth, persistence, multiplayer.
- Mobile native apps; only responsive web.
- Editing the world layout in-app (Office Studio in the reference stays out).
- Deployment to any server (needs explicit user approval).

## 3. Users and stories

| ID | User | Story | Priority |
|---|---|---|---|
| US-01 | Visitor | As a visitor I want to walk the office and understand what each agent does | P0 |
| US-02 | Engineering manager | As a manager I want one glance to see who is working, blocked or in error | P0 |
| US-03 | Engineering manager | As a manager I want to open one agent and read its current task, progress and log | P0 |
| US-04 | Legal/ops | As an ops person I want to open Credits and see every asset's source and license | P0 |
| US-05 | Developer | As a developer I want world/agent data separated from rendering to extend it | P1 |
| US-06 | Visitor on a weak GPU | As a visitor on a weak device I want a lighter quality preset / a DOM fallback | P1 |
| US-07 | Visitor on a phone | As a phone user I want touch camera control and a usable panel | P1 |

## 4. Functional requirements

| ID | Requirement |
|---|---|
| FR-01 | Load `world.json` (+ derived walls) and fail loudly if the schema is wrong |
| FR-02 | Render both floors; only the active floor casts shadows and receives full detail |
| FR-03 | Place every kept fixture using `type → furniture/<type>.glb`; log failures in the HUD |
| FR-04 | Place workstation tech (monitor, laptop, lamp, notepads, cabinet, bin) per desk in the desk's local frame |
| FR-05 | Load agent characters with skeleton + clips; drive an `AnimationMixer` per agent |
| FR-06 | Status set: idle, thinking, working, reviewing, in_meeting, waiting_approval, completed, error |
| FR-07 | Status drives animation (sit/type/talk/read), nameplate colour and HUD counters |
| FR-08 | Seeded simulation: same seed ⇒ same sequence of activities |
| FR-09 | Agents path to meeting rooms, pantry, server room and back; seats are reserved (capacity 1) |
| FR-10 | Level travel via stairs/lift is animated along the vertical link ends |
| FR-11 | Click agent/desk/room/prop → corresponding panel; Esc closes; clicks on UI never reach the 3D scene |
| FR-12 | Focus buttons fly the camera to an agent/room; "Overview" returns to the whole office |
| FR-13 | Quality preset changes shadow map, pixel ratio, environment intensity, prop count |
| FR-14 | Credits modal lists every integrated asset with creator, source, license and status |
| FR-15 | No-WebGL devices get an accessible DOM directory + activity list |

## 5. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | 60 fps target on a mid desktop GPU at "medium"; graceful degradation otherwise |
| NFR-02 | Static furniture merged per material; repeated props instanced/merged — few hundred draw calls max |
| NFR-03 | All geometry/material/texture/renderer resources disposable on teardown |
| NFR-04 | Pixel ratio capped at 2; shadow map ≤ 2048 |
| NFR-05 | No runtime asset is fetched from a third-party host |
| NFR-06 | Keyboard operable UI, visible focus rings, `prefers-reduced-motion` honoured |
| NFR-07 | Usable from 360 px wide to a 4K desktop |
| NFR-08 | Zero critical console errors on load and during interaction |

## 6. Acceptance criteria and evidence

| # | Criterion (from the brief) | Evidence |
|---|---|---|
| 1 | Runs locally per README | `README.md` quick start; dev + preview verified |
| 2 | 3D scene renders and is controllable | Playwright screenshots `docs/qa/screens/` |
| 3 | GLB models really load with materials | No entry in the `#asset-issues` notice on a clean run; 54 furniture + 9 character GLBs placed; `docs/qa/screens/*` |
| 4 | Realistic furniture, not primitives | Vendored GLB furniture + CC0 props (no placeholder boxes in use) |
| 5 | Agent selectable with correct info | E2E "dashboard, detail, credits and help" — roster row opens the agent panel |
| 6 | Status changes the visuals | status→clip mapping in `animations.js` + label/pill colour by status (code); status transitions asserted by unit `simulation.test.js` |
| 7 | Camera and object interaction work | E2E #3 (agent selection, detail open/close, floor switch); canvas picking wired in `interaction/picking.js` — **canvas raycast selection itself is not automated** |
| 8 | Layout usable on small screens | Playwright mobile project (Pixel 7) passed; `mobile-*.png` |
| 9 | Missing asset failure handled | E2E "surfaces a missing asset instead of breaking" — aborted GLB → HUD notice, app alive |
| 10 | Every third-party asset has source + license | `src/data/assetCredits.js` + Credits modal + `docs/assets/ASSET-REGISTER.md` |
| 11 | No unhandled critical runtime error | Playwright console assertion |
| 12 | Production build succeeds | `npm run build` output in QA report |
| 13 | README covers install, controls, architecture, assets, limits | `README.md` |

## 7. Assumptions

- A1: The vendored world dataset may be relabelled but not re-geometried in v1.
- A2: Agent activity is simulated; no external AI service is called.
- A3: English UI copy (the vendored dataset is Indonesian but only its ids are used).
- A4: Desktop is the primary target; mobile is supported at a reduced quality preset.
