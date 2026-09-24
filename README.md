# Small City

A small browser city-builder made with three.js and TypeScript. Lay out roads, zone land for
homes, shops and industry, run power to it, and balance the budget while the town grows.

The city is drawn with low-poly models from Kenney's City Kits: suburban houses, shops and towers,
factories, roads and power poles.

## Features

- **32 × 32 map** in an isometric-style view with pan, zoom and 90° rotation.
- **Tools:** select, road, residential, commercial, industrial, power plant, power line, bulldoze.
  Drag to build roads and power lines along an L-shaped path, and zones and bulldozing as
  rectangles. A ghost preview shows green for tiles that will be built and red for blocked ones,
  and a label shows the total cost before you let go.
- **Roads** pick their shape (straight, corner, T, cross, dead end) from their neighbours.
- **Power:** 2 × 2 plants have a fixed capacity. Power travels through power lines and through
  touching zones and buildings, but not across roads or empty land. A power line built over a road
  makes a crossing that carries power. When demand exceeds capacity, the tiles farthest from the
  plant lose power first.
- **Zones** develop only with power and a road within 3 tiles. They go from empty lot (a bordered
  tile) to construction (a scaffold) to levels 1–3, and are abandoned after 20 days without power
  or road access.
- **Zone feedback:** empty lots show a floating icon for the first thing they're missing: a road,
  then power, then demand. Buildings at risk of abandonment blink the same icons. While a zone tool
  is selected, a placement guide shades tiles with a road in reach, power, or both. A tip explains
  the basics on first launch.
- **Population and jobs:** homes house residents, and shops and industry offer jobs. Workers take
  the nearest jobs within a commute radius. RCI demand bars show what the city needs next.
- **Economy:** starting funds, build costs, monthly upkeep and taxes with an adjustable rate.
  Taxes above 9 % dampen demand and lower rates boost it. You can't build what you can't afford,
  and a warning appears while the city is in debt.
- **Info panel:** click a tile to see its type and stage, a ✓/✗ checklist of road, power and
  demand with advice on what to fix, and its residents or jobs.
- **Dialogs and toasts:** confirmations use an in-game modal (Esc cancels, Enter confirms), and
  short messages appear as toasts in the corner (info, success, warning, error).
- **Save and load:** manual save and load, a new-game button, and an autosave every 30 game days,
  all in `localStorage` with a versioned format.
- **Time:** one game day per second at 1×, plus pause, 2× and 4×.
- **Low-poly 3D:** 2–3 model variants per zone and level, chosen from the tile coordinates so they
  stay the same across reloads. Buildings face their nearest road, and abandoned buildings turn
  grey. Models load behind a progress bar; if one fails, that building type falls back to a simple
  box and a toast says so.
- **Low quality:** a toggle in the top bar that turns off shadows and high-DPI rendering for weak
  phones. It is remembered between visits.

## Controls

| Action                 | Mouse                | Touch                 | Keyboard   |
| ---------------------- | -------------------- | --------------------- | ---------- |
| Use the current tool   | Left click / drag    | One-finger tap / drag |            |
| Pan                    | Right or middle drag | Two-finger drag       | Arrow keys |
| Zoom                   | Wheel                | Pinch                 | `+` / `-`  |
| Rotate 90°             |                      |                       | `Q` / `E`  |
| Choose a tool          | Toolbar              | Toolbar               | `1`–`8`    |
| Pause / resume         | Speed buttons        | Speed buttons         | `Space`    |
| Cancel drag / deselect |                      |                       | `Esc`      |

**Getting started:** draw a road, zone residential land on one side and industrial on the other
(within 3 tiles of the road), place a power plant touching a zone, and link zones on opposite sides
of the road with a power line across it. Then press 2× and watch the demand bars.

## Run locally

Requires Node.js 22.13 or newer (the current LTS is recommended).

```sh
npm ci
npm run dev        # http://localhost:5173/small-city/
```

| Script            | What it does                            |
| ----------------- | --------------------------------------- |
| `npm run dev`     | Vite dev server with hot reload         |
| `npm run build`   | Type-check, then build to `dist/`       |
| `npm run preview` | Serve the production build locally      |
| `npm test`        | Run the Vitest suite once               |
| `npm run lint`    | ESLint plus a Prettier formatting check |
| `npm run format`  | Format everything with Prettier         |

## Architecture

```
src/
  core/     typed event bus, fixed-step game loop, number formatting
  sim/      pure, deterministic simulation (no three.js, no DOM, seeded RNG)
  render/   three.js scene that reads sim state; one InstancedMesh per model part
  input/    pointer (mouse + touch) and keyboard → tile picking → commands
  ui/       plain HTML/CSS overlays: stats bar, toolbar, info panel, notices
  game/     wiring: Game (owns sim + loop), event map, tools, save storage
  main.ts   creates the layers and connects them through one event bus
tests/      Vitest unit tests for the simulation and core
```

- **The simulation** (`src/sim`) is plain data plus functions. It changes only through
  `Simulation.execute(command)` and `Simulation.tick()`, which advances one game day. All
  randomness comes from a seeded RNG whose state is saved with the game, so the same seed and
  commands always produce the same city. Derived data such as power, road access and jobs is
  recomputed from grid-based lookups each day (multi-source BFS, a bucketed spatial index for
  jobs), never with per-tile full-map scans.
- **The renderer** (`src/render`) redraws its instanced meshes when `state.revision` changes and
  never changes game state.
- **Input and UI** only send commands (`placeRoad`, `placeZone`, `bulldoze`, `setTaxRate`, …) and
  requests (`speed:set`, `game:save`, …) on the event bus. Nothing is attached to `window`.
- **ESLint enforces the boundaries.** The sim may not import three.js or other layers, call
  `Math.random` or touch DOM globals, and the renderer may not import the command or simulation
  modules.
- **Tuning:** every gameplay number (costs, capacities, radii, growth rates, demand, taxes) lives in
  [`src/sim/config.ts`](src/sim/config.ts). Colours and proportions live in
  [`src/render/palette.ts`](src/render/palette.ts), and which Kenney model draws what (variants,
  road pieces and their rotations, the power plant parts) in
  [`src/render/models/catalog.ts`](src/render/models/catalog.ts).

## Tests

```sh
npm test
```

The suite covers the rules of the simulation:

- road shapes and rotations for every neighbour combination, and auto-connection when placing
- power flow through lines and zones but not roads or empty land, crossings, separate networks,
  multi-tile plants, and brownout order when demand exceeds capacity
- road access within the radius, measured as Manhattan distance
- zone growth, construction, upgrades, decline, abandonment and recovery
- which requirement an empty lot or building is missing (road, then power, then demand)
- job matching within the commute radius, nearest first, never over capacity
- RCI demand and the effect of taxes
- economy: per-tile and per-plant costs, refusing unaffordable builds, upkeep, taxes, monthly
  settlement, debt, and tax rate limits
- command validation (blocked roads, zone skipping, plant footprints, bulldozing)
- save/load round-trips that continue identically, plus rejection of malformed or newer saves
- seeded determinism, the event bus and the fixed-step loop

## Deploy to GitHub Pages

`.github/workflows/deploy.yml` runs on every push to `main`. It installs dependencies, lints, tests
and builds, then publishes `dist/` to GitHub Pages.

1. Push the repository to GitHub as `small-city`.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main`. The site appears at `https://<user>.github.io/small-city/`.

If the repository has a different name, change `base` in [`vite.config.ts`](vite.config.ts) to
match.

## Roadmap

- **Phase 2: a city that feels alive.** ~~Low-poly models~~ (done), commutes along the road
  network instead of a radius, visible traffic, and data overlays for power, traffic, land value
  and pollution.
- **Services and land value.** Police, fire, schools, clinics and parks raise land value, which
  gates higher building levels. Industry pollutes.
- **Terrain.** Water, elevation, bridges and trees to clear.
- **Deeper economy.** Per-department budgets, loans, yearly reports with charts, separate tax rates
  per zone.
- **Scale.** Run the simulation in a Web Worker, support 64 × 64 and larger maps, and render in
  chunks.
- **Quality of life.** Undo, several save slots, save export and import, sound, and a keyboard tile
  cursor for accessibility.
- **Testing.** End-to-end tests of the UI with Playwright.

## Credits

3D models by Kenney (kenney.nl), CC0

## License

Code: [MIT](LICENSE) © 2026 Said El Fariss. The models in `public/models/` are CC0; see
[`public/models/LICENSE-kenney.txt`](public/models/LICENSE-kenney.txt).
