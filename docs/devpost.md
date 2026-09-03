# Floorplay — Devpost submission text

## Why the use case fits WebMCP

Furnishing a room is a spatial problem with hard constraints. A door has to swing, you have to reach the bed, a desk wants daylight, and the total has to fit a budget. A chatbot can talk about a layout but cannot see one; a planner app can draw one but cannot read your brief. WebMCP lets the page hand the room itself to the agent as tools, so it reads true state and gets back computed violations and metrics instead of guessing coordinates. Both parties work one live artifact.

## How it improves the experience

Floorplay is a designer's workspace, not a chat window with a picture in it. A tool rail runs down the left edge, and the plan is drawn like a drafting sheet: paper ground, a 10 cm grid, solid wall bands with doors and windows cut out of them, swing arcs, dimension lines, outlined furniture. Beside it a 3D viewport, where eleven CC0 Poly Haven models cover the pieces whose proportions fit and procedural shapes the rest, lit through the glass. On the right, a properties column with Room, Selection and Issues tabs. Along the bottom, a ledger drawer and a status strip of six readings: free floor, walkway, open area, budget, light and issues.

The agent's work lands in that workspace, in its visual language. Proposals arrive as floating cards over the plan, each with a thumbnail of its ghosts over the current footprints and its three biggest deltas. Hovering one previews it in both views. Violations draw as dashed markers on the sheet and rows in the Issues tab, each with a one-click Fix running the same operation as `fix_item`. Every action by either party appends a ledger entry carrying its inverse, so any step reverts.

The hardest moment in a planner is the empty rectangle, so the wizard opens on eight furnished rooms, from a kitchen to a studio flat, each with its own brief, budget and finish. A test asserts every one loads with no blocked door, nothing unreachable and nothing over budget, so the agent inherits a valid room and the conversation is refinement rather than construction.

## What people and agents can now do together

- Start from a furnished room, one click or one `load_template` call, then refine it.
- Ask for three layout options against a real brief, then compare them by hovering the cards.
- Drag the bed where the agent did not expect, then ask it to make the room work around that.
- Say "keep the sofa" and have the lock respected by every later tool call.
- Take a whole palette derived from what is already placed, walls, floor and recolors, in one undoable step.
- Ask what the room looks like from the door and get an answer from the real camera view.
- Turn on Propose first so the agent can only suggest, and accept each change yourself.
- Turn the right viewport to a wall, paint it aizome indigo from the Japan palette, and hang a print on it at the height you actually want — by hand, or by asking the agent to read the elevation first.

## Implementation

A Vite, React and TypeScript single-page app with no backend. A pure engine computes footprints, overlaps, door and window conflicts, clearances, a 10 cm occupancy grid for reachability and walkway width, a daylight model with line of sight, the templates, a palette deriver, twenty-two named finishes, and invertible operations for the ledger. The catalog holds 139 items in twenty categories, sixty-three with alternative colors.

The WebMCP layer registers 44 static tools plus four scoped to the current selection, using abort-signal registration so the tool list follows page state. The surface is deliberately complete: every room, item, style and view control a person can reach, the agent can reach too, so it never has to ask the user to click something. Placement quality comes from mechanism, not prompting. `suggest_positions` ranks real candidate positions against walls, door swing, window and daylight, returning each with a reason and a score. `place_item` and `move_item` snap within 15 cm of a wall, turn wall furniture to face the room and report `snapped: true`. `fix_item` moves an item to the nearest position clearing its violations. `run_layout_script` runs agent-written search code in a sandboxed Web Worker. Read-only tools carry the read-only hint, text-returning tools the untrusted-content hint. Every mutating tool returns violations, metrics, and the nearest clear position on failure. `apply_layout` and `apply_palette` land a whole idea as one ledger entry, `revert_to_entry` rewinds to any point in it, and `get_guide` hands a first-time agent the order of calls and the coordinate conventions. Rooms persist in the browser only.

Repository: (public GitHub URL). Live: (Vercel URL). Video: (YouTube URL).
