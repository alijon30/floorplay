# Verification checklist

## A. Automated
- `npm test` passes: engine, store, webmcp, plan, three suites.
- `npm run build` passes with no type errors.

## B. Dev panel (any browser, Ctrl+Shift+D)
Load the demo studio, then run in order and confirm each result:
1. `get_room` → 360×520 room, door on bottom, window facing 90, no items.
2. `get_catalog` `{"category":"bed"}` → four beds, cheapest first.
3. `evaluate_layout` with a bed at (260,300) and a desk at (60,30) → budgetUsed 628, no violations, room unchanged.
4. `propose_layout` twice with different labels → two cards in the tray; hover each; Accept one → both cleared, furniture on plan and in 3D.
5. Select the bed by clicking it → `move_selected` appears in the panel list with "Queen bed" in its description; `find_alternatives_for_selected` → double and single beds; deselect → tools gone. `apply_proposal` and `withdraw_proposal` are always listed.
6. Drag the bed against the right wall → red window zone; `move_item` back → clear.
7. `set_daylight_hour` `{"hour":9}` and `get_daylight` → desk light score > 0.5 when near the window; slider moves.
8. `set_item_locked` on the bed, then `move_item` on it → `error: "locked"`; unlock.
9. `set_brief` `{"budget":600}` → over_budget violation and red budget chip.
10. `set_camera` `{"preset":"from_door"}` → 3D camera moves; result lists items in view.
11. `undo_last_action` → ledger gains an "Undid" entry.
12. Toggle Propose first; `place_item` → `status: "proposed"`; Reject the card.
13. `add_catalog_item` for a lamp, then `place_item` with the returned id → appears with a "from agent" badge in the catalog.
14. Reload the page → the room is still there.

## C. Chrome with the flag
- Enable `chrome://flags/#enable-webmcp-testing`, restart, open the deployed URL.
- DevTools → Application → WebMCP panel lists the tools; selecting an item adds four and deselecting removes them.
- Invoke `get_room` from the panel and confirm the JSON.

## D. ChatGPT in-app browser
- Open the deployed URL in ChatGPT's browser. The agent chip turns green with 23 tools.
- Run the video script prompts below and confirm the plan updates live.

## E. Video script (under 3 minutes, with audio)
1. (0:00) Open the site, load the demo studio, show the brief. "Floorplay: a room you design with ChatGPT on the same plan."
2. (0:20) Prompt: "Furnish this studio for my brief. Give me three options." Show tool calls, three cards, hover, accept one. Furniture appears in 2D and 3D.
3. (1:00) Drag the bed against the window. Red zone. Prompt: "Make it work with the bed there, and keep the desk in morning light." Show the desk move and the light chip.
4. (1:35) Prompt: "I'm over budget. Find cheaper storage." Select the wardrobe first. Budget chip drops.
5. (2:00) Prompt: "What do I see from the door?" Camera walks; agent answers from the result.
6. (2:25) Click Revert on one agent step in the ledger. Orbit the 3D view at 18:00 and end on the tagline.
