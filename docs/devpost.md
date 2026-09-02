# Floorplay — Devpost submission text

## Why the use case fits WebMCP

Furnishing a room is a spatial problem with hard constraints: a door has to swing, you have to be able to walk to the bed, a desk wants daylight, and the total has to fit a budget. A chatbot can talk about a layout but cannot see one, and a planner app can draw one but cannot reason about your brief. WebMCP lets the page expose the room itself as tools: the agent reads the true state, proposes changes, and gets back computed violations and metrics rather than guessing. The human and the agent operate one shared, live artifact.

## How it improves the experience

You keep the parts humans are good at: taste, priorities, and dragging things until they feel right. The agent takes the tedious parts: trying dozens of placements, checking clearances and walkways, keeping the budget straight, and remembering that you wanted the desk in morning light. Proposals arrive as ghost furniture and variant cards on the plan, so you judge them with your eyes, not by reading a paragraph. A ledger records every action by either party, and you can revert any step.

## What people and agents can now do together

- Ask for three layout options for a real brief and compare them by hovering cards while ghosts light up in 2D and 3D.
- Drag the bed somewhere the agent did not expect, then ask it to make the rest of the room work around your choice, with the desk still in the light.
- Say "keep the sofa" and have that lock respected by every later tool call.
- Ask what the room looks like from the door and get an answer grounded in the actual camera view.
- Turn on "propose first" so the agent can only suggest, and accept each change yourself.

## Implementation

The app is a Vite, React and TypeScript single-page app with no backend. A pure engine computes footprints, overlaps, door and window conflicts, clearances, a 10 cm occupancy grid for reachability and walkway width, an approximate daylight model with line-of-sight, and invertible operations for the ledger. The WebMCP layer registers twenty-three static tools and adds four more scoped to the current selection, using abort-signal registration so the tool list changes with page state. Read-only tools carry the read-only hint, and tools that return user or agent supplied text carry the untrusted-content hint. Every mutating tool returns violations, metrics and the nearest clear position on failure, and `evaluate_layout` lets the agent iterate privately. The 3D view uses three.js with walls built as segments around real openings, so sunlight falls through the window. Rooms persist in the browser only.

Repository: (public GitHub URL). Live: (Vercel URL). Video: (YouTube URL).
