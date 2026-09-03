# Floorplay

Design a room with ChatGPT on the same floor plan.

Floorplay is a single-room furniture planner where a human and an AI agent edit the same live plan. You drag furniture, lock what you love, and approve proposals. ChatGPT works the same room through [WebMCP](https://github.com/webmachinelearning/webmcp) tools and iterates against a geometry engine that checks door swings, walkways, clearances, daylight and budget, so it reasons over facts it cannot fake.

**Live demo:** coming soon (Vercel URL added after deploy).

## What you can do

- Start from a ready-made room. Eight furnished templates, each with its own brief, budget and finish, load in one click.
- Build a room from scratch: dimensions, doors with swing, windows with a compass direction.
- Furnish it by hand from a catalog of 139 items with real dimensions and prices, or let the agent do it.
- Hang things on the walls: pictures, mirrors, wall shelves, curtains, coat hooks and a wall TV all mount at a real height.
- Recolor a piece from its alternative finishes, repaint the walls, change the floor, or take one of three palettes derived from what is already in the room.
- Drop furniture near a wall and watch it snap flush and turn to face the room, or ask the agent where a piece belongs.
- See every problem as it happens: blocked doors, no walkway, an item in the dark, a blown budget, each with a one-click fix.
- Get layout options from the agent as ghost furniture and variant cards, then accept, reject, or drag a ghost before accepting.
- Watch daylight move through the room on a time slider, in 2D and in 3D.
- Walk through the room in 3D, or ask the agent what it sees from the door.
- Roll back any step from a ledger that records every action by either party.

Everything is stored in your browser. Nothing leaves your machine.

## Ready-made rooms

The new-room wizard opens on a grid of eight furnished templates, each with a thumbnail drawn from its own footprints. Every one arrives with a brief, a budget and a finish, and none of them starts with a blocked door, an unreachable item or a blown budget.

- **Living room** — a sofa facing the TV wall, a reading corner and a rug that ties the seating together.
- **Kitchen** — counters in an L along two walls with the fridge at the end of the run and an island in the middle.
- **Bedroom** — queen bed against the long wall, wardrobe opposite and a small desk under the window.
- **Entrance hall** — everything hugs the walls so the run from the front door stays clear.
- **Home office** — desk under the window, shelving on the blank wall and files within reach of the chair.
- **Dining room** — a long table centred under the pendant with chairs pulled back on every side.
- **Kids room** — a crib on one wall, a bed on the other and a soft rug across the floor between them.
- **Studio flat** — the starter studio, furnished: bed in the corner, desk in the east light, a loveseat by the door.

The agent reaches the same eight through `list_templates` and `load_template`, which builds the room, switches to it and hands back the summary.

## Catalog, colors and finishes

The catalog holds 139 items in twenty categories: beds, sofas, armchairs, desks, chairs, tables, wardrobes, shelves, dressers, nightstands, rugs, lamps, plants, TVs, kitchen units, appliances, storage, decor, wall-mounted pieces and a catch-all. Each item carries the room kinds it suits, so the catalog drawer and `get_catalog` both filter by room as well as by category, price and footprint. Wall-mounted items hang at a real height and take no floor, so a picture may sit above a sofa and a mirror above a desk without either reading as a collision.

Sixty-three items list two to four alternative colors. The inspector shows them as swatches under **Finish**; the agent sets one with `set_item_color`. The **Style** button in the top bar opens eight curated wall colors and five floors (oak, walnut, ash, grey, tile), which the agent sets with `set_finish`. `suggest_palette` reads the dominant tone of the furniture already in the room and returns three whole-room schemes, warm, cool and neutral, each with a wall color, a floor, three accents and the exact recolors that would carry it out. Applying one from the Style popover lands as a single ledger entry, so one undo takes the room back.

## Use it with an agent

1. Open the live URL in ChatGPT's in-app browser, or in Google Chrome with `chrome://flags/#enable-webmcp-testing` enabled.
2. Click **Load the demo studio** on the first-run card, or pick a ready-made room from **My rooms → New room**.
3. Try prompts such as:
   - "Furnish this studio for my brief using suggest_positions. Give me three options."
   - "Start me a bedroom from a template, then make it work for two people."
   - "Suggest a palette for this room and apply the cool one."
   - "I moved the bed. Make it work and keep the desk in morning light."
   - "I'm over budget. Find cheaper storage."
   - "What do I see from the door?"

**First run.** On an untouched room a card sits over the plan with the three steps above, a **Load the demo studio** button, a **Start empty** button, and three example prompts you can copy straight into the agent. It disappears once you place anything or ask the agent for something, and **Don't show again** retires it for good.

The top-right chip shows whether an agent is connected and how many tools are registered. The **?** button next to it lists every keyboard shortcut. Two toggles turn the shading down when you want the plain geometry: the sun button beside the hour slider drops the daylight wash from the plan, and the **Shadows** checkbox over the 3D view drops the contact shadow. Both stick across reloads. Press **Ctrl+Shift+D** (Cmd+Shift+D on macOS) for a developer panel that lists every tool and lets you call it by hand.

## The WebMCP surface

All coordinates are integer centimeters from the room's top-left corner, items are placed by their center, and rotation is 0, 90, 180 or 270 degrees clockwise.

There are 31 static tools plus 4 that appear only while an item is selected. `run_layout_script` needs a real Web Worker for its sandbox, so it is registered only in a browser; the test harness's fake model context sees the other 30.

Read-only tools: `get_room`, `get_catalog`, `suggest_positions`, `evaluate_layout`, `get_daylight`, `list_templates`, `suggest_palette`, `get_ledger`.

Mutating tools: `set_room_shell`, `add_opening`, `remove_opening`, `set_brief`, `place_item`, `move_item`, `rotate_item`, `fix_item`, `remove_item`, `swap_item`, `set_item_locked`, `add_catalog_item`, `load_template`, `set_item_color`, `set_finish`, `propose_layout`, `apply_proposal`, `withdraw_proposal`, `apply_all_proposals`, `set_daylight_hour`, `set_camera`, `undo_last_action`, `run_layout_script`.

`suggest_positions` ranks real positions for a catalog item against the walls, the door swing, the window and the daylight model, and returns each one with a reason and a score, so the agent asks the room where a bed goes instead of guessing coordinates. `place_item` and `move_item` snap a position within 15 cm of a wall flush against it and turn wall furniture to face the room, reporting `snapped: true` and which wall, so a rough coordinate still lands like a designer put it there. `fix_item` moves one item to the nearest position that clears its blocking violations.

`run_layout_script` runs a small algorithm the agent writes, in a sandboxed Web Worker with no DOM access, and turns the returned placements into a proposal.

Three of the groups are about starting well and about how the room looks rather than where things stand. `list_templates` and `load_template` let the agent open a whole furnished room from one of the eight ready-made layouts instead of placing a dozen items one at a time. `set_item_color` and `set_finish` set a per-item finish and the room's wall paint and floor material, and `suggest_palette` derives three whole-room schemes from the furniture already placed, each carrying the exact calls that would apply it. `get_catalog` takes a `room` filter, so the agent can ask for kitchen items or kids items directly.

Tools that appear only while the page is in a matching state:

- When you select an item: `move_selected`, `replace_selected`, `remove_selected`, `find_alternatives_for_selected`. Their descriptions name the selected item, and they disappear when you deselect.

Every mutating tool returns the violations it caused, the new metrics, and, when a placement has problems, the nearest clear position. `evaluate_layout` lets the agent score a layout privately before showing anything. The **Propose first** switch turns every agent change into a proposal you accept on screen.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine, store and tool tests
npm run build    # typecheck and production build
npm run smoke    # headless Playwright screenshots into ./smoke-out (first run downloads Chromium)
npm run models   # rebuild public/models from Poly Haven (the .glb files are committed; this is only for changing them)
```

## How it is built

- `src/engine` is a pure TypeScript model: geometry, validation, a 10 cm occupancy grid for reachability, a daylight model, metrics, the eight room templates, the palette deriver, and invertible operations. It has no UI dependencies and is fully unit-tested, including a test that every template loads clean against the same validator the agent is scored by.
- `src/store` is a Zustand store. UI and tools both dispatch operations to it; every change appends a ledger entry with its inverse.
- `src/webmcp` registers tools with `document.modelContext`, re-registering selection- and proposal-scoped tools when the page state changes. A shim provides a fake model context so the dev panel works in any browser.
- `src/plan` is the SVG plan. `src/three` is the three.js scene, with walls built as segments around real openings so sunlight comes through the window.

## 3D models

Armchairs, dining chairs, shelving, cabinets, sideboards, nightstands, coffee tables, poufs and
plants are drawn from photographed models rather than from boxes. They come from
[Poly Haven](https://polyhaven.com/models), are published under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), and are used here with thanks to the
people who made them — James Ray Cock, Ulan Cabanilla, Rico Cilliers, Amin, Vibrant Nordic, Patrik
Pangerl and Caspian Fortune. `public/models/LICENSES.md` credits each file individually.

Everything else — beds, sofas, desks, dining tables, stools, benches, rugs, lamps, kitchen units and
everything that hangs on a wall — is drawn procedurally. That is a choice about style, not a gap:
Poly Haven's furniture is largely period and salvage, and a Gothic four-poster or a Victorian settee
would break a plan for a modern rental more than a plain box does. The models that survived are the
short list Poly Haven itself files as `condition: clean` with modern or minimalist tags, so the two
renderers read as one catalog.

`npm run models` rebuilds them: it reads `scripts/models.manifest.json`, downloads the 1k glTF of
each asset, and compresses it to 512 px WebP textures and meshopt-packed geometry, which brings
eleven models to about 1.6 MB in total. `src/three/models.ts` decides which catalog entries each one
stands in for and how far it may be stretched onto a size it was not photographed at. `npm run smoke`
photographs one of every model in a single room as `contact-sheet.png`, which is where a piece whose
style, scale or orientation has drifted shows up.

Built for the WebMCP Challenge, September 2026. MIT licensed.
