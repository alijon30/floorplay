# Verification checklist

## A. Automated
- `npm test` passes: engine, store, webmcp, plan, three suites.
- `npm run build` passes with no type errors.

## B. Dev panel (any browser, Ctrl+Shift+D)
Start on a fresh profile (a private window, or clear site data and reload), then run in order and confirm each result:
1. The first-run card sits over the plan: three numbered steps, three example prompts each with a **Copy** button, and **Load the demo studio** / **Start empty**. Click **Load the demo studio** → the card goes away and the studio loads. Reload → the card stays away.
2. `get_room` → 360×520 room, door on bottom, window facing 90, no items.
3. `get_catalog` `{"category":"bed"}` → four beds, cheapest first.
4. `suggest_positions` `{"catalogId":"bed-queen-160","near":"window","count":3}` → three placements, best first, each with `x`, `y`, `rotation`, a `reason`, a `light` score and a `score`; every one is inside the room and clear of the door swing, and the room is unchanged.
5. `evaluate_layout` with a bed at (260,300) and a desk at (60,30) → budgetUsed 628, no violations, room unchanged.
6. `propose_layout` twice with different labels → two cards in the tray; hover each; Accept one → both cleared, furniture on plan and in 3D.
7. Select the bed by clicking it → `move_selected` appears in the panel list with "Queen bed" in its description; `find_alternatives_for_selected` → double and single beds; deselect → tools gone. `apply_proposal` and `withdraw_proposal` are always listed.
8. Snapping: `place_item` `{"catalogId":"desk-120","x":100,"y":42,"rotation":90}` → `snapped: true` and `wall: "top"`; the desk lands flush against the top wall, turned to face the room (rotation 0, center y 30), not at the y you asked for. Repeat with `{"x":180,"y":260,"rotation":90}` in open floor → `snapped: false` and the position you gave.
9. Drag a desk by hand to within a few centimeters of the left wall → the snap guide highlights that wall while you drag and the desk lands flush on release.
10. Issues panel: `place_item` a second `desk-120` at (150, 30) → the result carries an `overlap` violation and a `suggestion` naming the nearest clear position, and the Issues panel appears at the top right with an "overlap" row. **Select** on that row selects the desk and opens the inspector.
11. `fix_item` `{"id":"<the second desk's id from get_room>"}` → `status: "applied"`, the overlap gone, the Issues row gone. Call `fix_item` again on the same id → `error: "already_clear"`. Create the overlap once more and press **Fix** in the Issues panel instead → same move, logged as a human action in the ledger. Lock the item and press **Fix** → the button is disabled with "Unlock the item to fix it".
12. 3D click-to-select: click a piece of furniture in the 3D view → it gets a selection outline and a floating label, the plan and inspector select the same item, and the four selection-scoped tools appear in the panel.
13. Drag the bed against the right wall → red window zone; `move_item` back → clear.
14. `set_daylight_hour` `{"hour":9}` and `get_daylight` → desk light score > 0.5 when near the window; slider moves.
15. `set_item_locked` on the bed, then `move_item` on it → `error: "locked"`; unlock.
16. `set_brief` `{"budget":600}` → over_budget violation and red budget chip. The Issues panel row for it offers **Select** only, since no move can fix a budget.
17. `set_camera` `{"preset":"from_door"}` → 3D camera moves; result lists items in view.
18. `undo_last_action` → ledger gains an "Undid" entry.
19. Toggle Propose first; `place_item` → `status: "proposed"`; Reject the card.
20. `add_catalog_item` for a lamp, then `place_item` with the returned id → appears with a "from agent" badge in the catalog.
21. Reload the page → the room is still there.

## C. Chrome with the flag
- Enable `chrome://flags/#enable-webmcp-testing`, restart, open the deployed URL.
- DevTools → Application → WebMCP panel lists 26 tools with nothing selected; selecting an item adds four and deselecting removes them.
- Invoke `get_room` from the panel and confirm the JSON.

## D. ChatGPT in-app browser
- Open the deployed URL in ChatGPT's browser. The agent chip turns green with 26 tools.
- Run the video script prompts below and confirm the plan updates live.

## E. Video script (under 3 minutes, with audio)
1. (0:00) Open the site, load the demo studio, show the brief. "Floorplay: a room you design with ChatGPT on the same plan."
2. (0:20) Prompt: "Furnish this studio for my brief using suggest_positions. Give me three options." Show tool calls, three cards, hover, accept one. Furniture appears in 2D and 3D.
3. (1:00) Drag the bed against the window. Red zone. Prompt: "Make it work with the bed there, and keep the desk in morning light." Show the desk move and the light chip.
4. (1:35) Prompt: "I'm over budget. Find cheaper storage." Select the wardrobe first. Budget chip drops.
5. (2:00) Prompt: "What do I see from the door?" Camera walks; agent answers from the result.
6. (2:25) Click Revert on one agent step in the ledger. Orbit the 3D view at 18:00 and end on the tagline.
