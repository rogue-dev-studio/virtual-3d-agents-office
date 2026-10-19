# Planning — Virtual 3D Agent Office

## Roadmap

| Milestone | Scope | Outcome |
|---|---|---|
| M1 — Foundations | Vite + three.js app shell, world data loader, assets pipeline, quality presets | Scene renders an empty shell |
| M2 — Vertical slice | One real workspace (Engineering), GLB furniture, 2 agents, animation, camera, selection, agent panel, credits modal | The brief's Fase 2 acceptance |
| M3 — The office | Both floors, furniture everywhere, workstation tech props, nav grid, agent walking, room/prop interaction, simulation | Living office |
| M4 — Command center | HUD stats, dashboard feed, divisions, attention list, responsiveness, fallback, error handling | Fase 4 acceptance |
| M5 — Verification | vitest, Playwright (desktop/tablet/mobile), build, console + credits audit | QA report |

## WBS (top level)

1. Planning & audit — audit repo, license check, asset register, SRS, architecture, design
2. Asset pipeline — vendor MIT assets, fetch + optimize CC0 props, HDRI, credits registry
3. Core runtime — renderer, loaders, loading UI, quality presets, teardown
4. World — world data adapters, building shell, doors, furniture batching, workstation props, signage
5. Agents — roster, character loading, animation mapping, status model, simulation, navigation
6. Interaction — camera rig, picking proxies, keyboard/touch input, focus/overview
7. UI — HUD, dashboard, agent/room panels, credits, help, loading screen, fallback directory
8. Verification — unit tests, E2E tests, screenshots, performance + console checks, docs

## Milestones / timeline (single iteration, local development)

| Day | Work |
|---|---|
| D1 | Audit, decision, asset vendoring + CC0 download/optimize |
| D1 | Docs: SRS, planning, architecture, design, tasks, asset register |
| D2 | Core runtime + world builder + workstation props |
| D2 | Agents: roster, animation, simulation, navigation |
| D3 | HUD/dashboard/panels/credits, camera + interaction |
| D3 | Tests, build, screenshots, QA report, README |

## Definition of Done (project)

- All 13 acceptance criteria in `docs/srs/SRS-office-v1.md` §6 proven.
- `npm run build` green, `npm test` green, `npm run e2e` green.
- Every asset has a credits entry with source + license (or an explicit `unverified` marker).
- README documents install, controls, architecture, asset sources and known limitations.
