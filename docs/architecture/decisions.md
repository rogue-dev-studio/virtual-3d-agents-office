# Architecture decisions

## ADR-1 — Build a new app instead of forking `kantor-rpg`

**Context:** the reference repo is MIT and battle-tested, but implements an RPG (player avatar,
mini games, arcade, gym, Telegram-backed agent chat) with TypeScript across ~100 modules.

**Decision:** build a new focused app; reuse the reference's *data* and *assets*, not its app code.

**Consequences:** we own a small, purpose-built codebase; we must implement camera/picking/nav
ourselves (already done in `interaction/` and `agents/navigation.js`, adopting the reference's
raster rules). Attribution for the reused data/assets is preserved.

## ADR-2 — Vendor the MIT assets and dataset

**Context:** the brief requires realistic furniture, not primitives, on a machine without Blender.

**Decision:** vendor `world.json`, `walls.json`, `building-L1/L2.glb`, `characters/*.glb`,
`furniture/*.glb`, `signage/*.jpg` from `kantor-rpg` (MIT, © 2026 Budi Prabhawa), unmodified.

**Consequences:** the office is instantly realistic and consistent; we must keep the MIT notice
(`NOTICE`, `public/assets/vendor/kantor-rpg/`), and we cannot rename GLB files without breaking the
`type → <type>.glb` mapping. Room *labels* are remapped in our data layer instead.

## ADR-3 — JavaScript ES modules instead of TypeScript

**Context:** the brief prefers ES modules when there is no strong reason for TypeScript.

**Decision:** plain JS with JSDoc typedefs for the world/agent shapes.

**Consequences:** faster iteration and no build-type step; type safety is enforced by runtime
validation of `world.json` (`worldData.js`) plus unit tests instead of the compiler.

## ADR-4 — Merged geometry for rendering, Box3 proxies for picking

**Context:** 200+ fixtures × multiple materials would be thousands of draw calls, and raycasting
merged geometry per click is slow.

**Decision:** merge geometry per (type, material) and keep a parallel list of pick proxies.

**Consequences:** few draw calls and O(n) box tests on click; a prop can't be picked separately from
its merged mesh, so each pickable registers its own proxy with its own metadata.

## ADR-5 — Seeded front-end simulation, clearly labelled

**Context:** there is no agent backend; the brief forbids claiming real AI work.

**Decision:** `simulation.js` drives tasks/status/movement from a seeded PRNG (mulberry32), and the
HUD, agent panel and README state that the activity is a simulation.

**Consequences:** deterministic, testable, demoable; a future backend only needs to replace the
state source.

## ADR-6 — One central credits registry

**Context:** the brief requires per-asset provenance and forbids hand-written credits scattered in
components.

**Decision:** every integrated asset is an entry in `src/data/assetCredits.js`; the credits modal,
the QA audit and `docs/assets/ASSET-REGISTER.md` all read from it.

**Consequences:** adding an asset means adding a registry entry; `status: 'unverified' | 'missing'`
is rendered honestly (the Sketchfab chair reference is `reference-only` and **not** integrated).

## ADR-7 — Filter out RPG fixtures, add our own in three repurposed rooms

**Context:** the vendored dataset contains billiard, arcade, treadmill and dumbbell fixtures that do
not belong in a software company office.

**Decision:** drop 8 fixture types at build time (`worldData.js`), repurpose L2-BILLIARD as
"Focus Pods", L2-GAME as "Playtest Lab", L2-GYM as "Training & Workshop Room", and place our own
added fixtures there (`src/data/officeAdditions.js`).

**Consequences:** the office reads as a tech company; the walls/doors/nav stay untouched because
only fixture lists change.
