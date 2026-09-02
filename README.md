# Floorplay

Design a room with ChatGPT on the same floor plan.

Floorplay is a single-room furniture planner where a human and an AI agent edit the same live plan. You drag furniture, lock what you love, and approve proposals. ChatGPT works the same room through [WebMCP](https://github.com/webmachinelearning/webmcp) tools and iterates against a geometry engine that checks door swings, walkways, clearances, daylight and budget, so it reasons over facts it cannot fake.

**Live demo:** coming soon (Vercel URL added after deploy).

## What you can do

- Build a room: dimensions, doors with swing, windows with a compass direction.
- Furnish it by hand from a catalog of about fifty items with real dimensions and prices, or let the agent do it.
- See every problem as it happens: blocked doors, no walkway, an item in the dark, a blown budget.
- Get layout options from the agent as ghost furniture and variant cards, then accept, reject, or drag a ghost before accepting.
- Watch daylight move through the room on a time slider, in 2D and in 3D.
- Walk through the room in 3D, or ask the agent what it sees from the door.
- Roll back any step from a ledger that records every action by either party.

Everything is stored in your browser. Nothing leaves your machine.

## Use it with an agent

1. Open the live URL in ChatGPT's in-app browser, or in Google Chrome with `chrome://flags/#enable-webmcp-testing` enabled.
2. Click **My rooms → Load demo studio**.
3. Try prompts such as:
   - "Furnish this studio for my brief. Give me three options."
   - "I moved the bed. Make it work and keep the desk in morning light."
   - "I'm over budget. Find cheaper storage."
   - "What do I see from the door?"

The top-right chip shows whether an agent is connected and how many tools are registered. Press **Ctrl+Shift+D** (Cmd+Shift+D on macOS) for a developer panel that lists every tool and lets you call it by hand.

## The WebMCP surface

All coordinates are integer centimeters from the room's top-left corner, items are placed by their center, and rotation is 0, 90, 180 or 270 degrees clockwise.

Read-only tools: `get_room`, `get_catalog`, `evaluate_layout`, `get_daylight`, `get_ledger`.

Mutating tools: `set_room_shell`, `add_opening`, `remove_opening`, `set_brief`, `place_item`, `move_item`, `rotate_item`, `remove_item`, `swap_item`, `set_item_locked`, `add_catalog_item`, `propose_layout`, `apply_proposal`, `withdraw_proposal`, `apply_all_proposals`, `set_daylight_hour`, `set_camera`, `undo_last_action`.

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
```

## How it is built

- `src/engine` is a pure TypeScript model: geometry, validation, a 10 cm occupancy grid for reachability, a daylight model, metrics, and invertible operations. It has no UI dependencies and is fully unit-tested.
- `src/store` is a Zustand store. UI and tools both dispatch operations to it; every change appends a ledger entry with its inverse.
- `src/webmcp` registers tools with `document.modelContext`, re-registering selection- and proposal-scoped tools when the page state changes. A shim provides a fake model context so the dev panel works in any browser.
- `src/plan` is the SVG plan. `src/three` is the three.js scene, with walls built as segments around real openings so sunlight comes through the window.

Built for the WebMCP Challenge, September 2026. MIT licensed.
