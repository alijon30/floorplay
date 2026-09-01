# Swarm Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A live team-retro board at a Cloudflare URL where each participant's ChatGPT joins as a named WebMCP co-participant with a phase-driven dynamic tool surface.

**Architecture:** React+Vite static SPA served by a Cloudflare Worker; one Durable Object per board holds authoritative state, applies mutations through a pure shared reducer (server-enforced phase rules), persists to DO storage, and broadcasts per-viewer-redacted state over WebSockets. The page registers WebMCP tools via `document.modelContext`, re-registering the phase-specific set whenever the board phase changes.

**Tech Stack:** TypeScript, React 18, Vite 6, Cloudflare Workers + Durable Objects (wrangler v4), vitest, `ws` (integration test client only).

**Spec:** `docs/superpowers/specs/2026-09-01-swarm-board-design.md`

## Global Constraints

- Deadline: submit before **2026-09-03 13:00 PDT**. Cut order if behind: blur-during-Brainstorm → Vote phase → visual cluster groups (fall back to tag chips). Never cut: notes + realtime + phase-driven tools + seeded demo.
- Node 22 / npm. App lives at repo root (`/Users/alijonkarimberdiev/WebMCP-hackathon`).
- Caps (enforced in reducer): note text ≤ 500 chars, names ≤ 50, ≤ 500 notes/board, ≤ 3 votes/participant.
- Columns are exactly `"well" | "didnt" | "actions"`. Phases exactly `"brainstorm" | "group" | "vote" | "actions"`.
- WebMCP API: `document.modelContext.registerTool(tool, {signal})` with graceful in-page shim fallback when absent (dev only; UI badge shows NATIVE vs SHIM).
- Every commit message: imperative, ends with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- UI verification happens via claude-in-chrome browser driving (two tabs); only the reducer gets unit tests (vitest) — deliberate deadline tradeoff recorded here.

---

### Task 1: Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `wrangler.jsonc`, `index.html`, `src/main.tsx`, `src/App.tsx`, `worker/index.ts` (hello-world), `.gitignore`

**Interfaces:**
- Produces: `npm run dev` (vite build --watch + wrangler dev on :8787), `npm run test` (vitest), `npm run deploy`.

- [ ] **Step 1: Init project**

```bash
npm create vite@latest . -- --template react-ts   # accept files into existing dir
npm i
npm i -D wrangler vitest concurrently ws @types/ws
```

- [ ] **Step 2: Config files**

`wrangler.jsonc`:
```jsonc
{
  "name": "swarm-board",
  "main": "worker/index.ts",
  "compatibility_date": "2026-08-01",
  "assets": { "directory": "./dist", "not_found_handling": "single-page-application", "binding": "ASSETS" },
  "durable_objects": { "bindings": [{ "name": "BOARD", "class_name": "BoardDO" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["BoardDO"] }]
}
```

`package.json` scripts:
```json
{
  "dev": "concurrently \"vite build --watch\" \"wrangler dev --port 8787\"",
  "test": "vitest run",
  "deploy": "vite build && wrangler deploy"
}
```

`worker/index.ts` (placeholder until Task 3):
```ts
export class BoardDO { constructor(_state: DurableObjectState, _env: unknown) {} async fetch() { return new Response("do"); } }
export default { async fetch(req: Request, env: { ASSETS: Fetcher }) { return env.ASSETS.fetch(req); } };
```

- [ ] **Step 3: Verify** — `npm run dev`; `curl -s localhost:8787` returns the Vite index.html.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "Scaffold Vite+React SPA with Cloudflare Worker/DO shell"`

---

### Task 2: Shared types + mutation reducer (TDD)

**Files:**
- Create: `shared/types.ts`, `shared/reducer.ts`
- Test: `test/reducer.test.ts`

**Interfaces (Produces — later tasks rely on these exact names):**
```ts
// shared/types.ts
export type Column = "well" | "didnt" | "actions";
export type Phase = "brainstorm" | "group" | "vote" | "actions";
export type AuthorKind = "human" | "agent";
export interface Participant { id: string; name: string; color: string; online: boolean; }
export interface Note { id: string; text: string; column: Column; clusterId?: string; owner?: string;
  authorId: string; authorKind: AuthorKind; votes: string[]; ts: number; }
export interface Cluster { id: string; title: string; }
export interface Board { id: string; phase: Phase; participants: Participant[];
  notes: Note[]; clusters: Cluster[]; summary: string; }
export type Mutation =
  | { type: "join"; name: string }
  | { type: "add_note"; column: Column; text: string; asAgent: boolean; owner?: string }
  | { type: "move_note"; noteId: string; column: Column }
  | { type: "update_note"; noteId: string; text: string }
  | { type: "delete_note"; noteId: string; asAgent: boolean }
  | { type: "cluster_notes"; noteIds: string[]; title: string }
  | { type: "cast_votes"; noteIds: string[] }      // replaces actor's vote set, ≤3
  | { type: "set_summary"; markdown: string }
  | { type: "set_phase"; phase: Phase };
export interface Ok { board: Board; info: string; }   // info returned to tools
export interface Err { error: string; }
export const emptyBoard = (id: string): Board =>
  ({ id, phase: "brainstorm", participants: [], notes: [], clusters: [], summary: "" });
```
```ts
// shared/reducer.ts
export function applyMutation(board: Board, m: Mutation, actorId: string): Ok | Err;
export function redactFor(board: Board, viewerId: string): Board; // brainstorm: others' note text → "🔒 hidden until Group phase", redacted flag
```

**Phase rules to enforce** (structured error strings, tested verbatim):
- `add_note`/`update_note`/`move_note`/`delete_note`: allowed in every phase EXCEPT `add_note` to non-actions columns is blocked in `vote` phase → `"adding notes is locked during Vote"`; delete only own notes when `asAgent` (`authorId === actorId && authorKind === "agent"`) else `"agents may only delete their own notes"`.
- `cluster_notes`: only in `group`/`vote`/`actions` → else `"cluster_notes is only available from the Group phase"`.
- `cast_votes`: only in `vote` → `"voting is only open during the Vote phase"`; >3 ids → `"vote limit reached (3)"`.
- `set_summary`: only in `actions` → `"the summary opens in the Actions phase"`.
- `join`: idempotent by actorId (rejoin flips online, keeps color); colors assigned round-robin from `["#e11d48","#2563eb","#059669","#d97706","#7c3aed","#0891b2"]`.
- Caps from Global Constraints; unknown noteId → `"note not found"`.

- [ ] **Step 1: Write failing tests** — `test/reducer.test.ts` with vitest covering: join/rejoin, add within cap, text-cap trim reject, add during vote blocked, move, update, agent delete own vs others', cluster before group phase rejected, cluster assigns clusterId + creates cluster, cast_votes replaces set / limit 3 / wrong phase, set_summary phase gate, set_phase transitions, redactFor hides others' text only in brainstorm and never the viewer's own.
- [ ] **Step 2: Run** — `npx vitest run` → all FAIL (module missing).
- [ ] **Step 3: Implement** `shared/types.ts` + `shared/reducer.ts` — pure functions, immutably return new Board, `crypto.randomUUID().slice(0,8)` ids.
- [ ] **Step 4: Run** — `npx vitest run` → all PASS.
- [ ] **Step 5: Commit** — `"Add board types and pure mutation reducer with phase rules (TDD)"`

---

### Task 3: Durable Object + Worker routing

**Files:**
- Modify: `worker/index.ts`
- Create: `worker/board-do.ts`
- Test: `test/integration.mjs` (node script against `wrangler dev`)

**Interfaces:**
- Consumes: `applyMutation`, `redactFor`, `emptyBoard`, types from Task 2.
- Produces (client relies on):
  - `GET /ws?board=<id>&pid=<participantId>&name=<urlencoded>` → WebSocket upgrade routed to `BOARD.idFromName(boardId)`.
  - Client sends `{ clientRef: string, mutation: Mutation }`. Server replies to sender `{ type:"ack", clientRef, ok:true, info }` or `{ type:"ack", clientRef, ok:false, error }`, and broadcasts `{ type:"state", board }` (redacted per viewer) to all on every accepted mutation and on connect/disconnect.
  - `POST /api/demo` → `{ boardId }` — new board pre-loaded from seed (DO `/init` refuses non-empty board).

**DO implementation notes (write exactly this shape):**
- Hibernation-friendly WebSocket API: `this.ctx.acceptWebSocket(ws, [pid])`, `webSocketMessage`, `webSocketClose`; attach `{pid, name}` via `ws.serializeAttachment`.
- Board in `this.board`, lazily `await ctx.storage.get("board")`, `ctx.storage.put("board", board)` after each accepted mutation; auto-`join` mutation on connect; mark participant `online:false` on close (broadcast).
- `broadcast()` loops `ctx.getWebSockets()`, sends `redactFor(board, attachedPid)` per socket.

- [ ] **Step 1: Implement** `worker/board-do.ts` + routing in `worker/index.ts` (ws upgrade, `/api/demo` with `crypto.randomUUID().slice(0,8)` id, else ASSETS).
- [ ] **Step 2: Write integration script** `test/integration.mjs`: connect two `ws` clients (pids A,B) to `ws://localhost:8787/ws?board=itest&...`, A sends `add_note`, assert A gets `ack ok:true` AND B's next `state` contains the note with `authorId:A`; set_phase to group from B; assert brainstorm redaction was present for B before, absent after. Exit 0/1.
- [ ] **Step 3: Run** — `npm run dev` in background, `node test/integration.mjs` → PASS.
- [ ] **Step 4: Commit** — `"Add per-board Durable Object with WS sync, acks, redaction, demo clone"`

---

### Task 4: WS client + board UI (join, columns, notes, presence, phases)

**Files:**
- Create: `src/ws.ts`, `src/state.ts` (useBoard hook), `src/components/{JoinModal,Header,PhaseStepper,ColumnView,NoteCard,PresenceBar,SummaryPanel}.tsx`, `src/styles.css`
- Modify: `src/App.tsx`, `index.html` (title "Swarm Board", emoji favicon 🐝)

**Interfaces:**
- Consumes: WS protocol from Task 3; types from Task 2.
- Produces: `sendMutation(m: Mutation): Promise<string>` (resolves ack info / rejects error) — Task 5's tools call exactly this. `useBoard()` returns `{ board, me, connected, sendMutation }`.

**`src/ws.ts` (write exactly):**
```ts
export function connect(boardId: string, pid: string, name: string,
  onState: (b: Board) => void): { sendMutation(m: Mutation): Promise<string>; close(): void } {
  let ws: WebSocket; const pending = new Map<string, {res:(s:string)=>void; rej:(e:Error)=>void}>();
  const open = () => {
    ws = new WebSocket(`${location.protocol==="https:"?"wss":"ws"}://${location.host}/ws?board=${boardId}&pid=${pid}&name=${encodeURIComponent(name)}`);
    ws.onmessage = ev => { const msg = JSON.parse(ev.data);
      if (msg.type === "state") onState(msg.board);
      if (msg.type === "ack") { const p = pending.get(msg.clientRef); pending.delete(msg.clientRef);
        msg.ok ? p?.res(msg.info) : p?.rej(new Error(msg.error)); } };
    ws.onclose = () => setTimeout(open, 1000 + Math.random()*2000);
  }; open();
  return { sendMutation: m => new Promise((res, rej) => { const clientRef = crypto.randomUUID();
      pending.set(clientRef, {res, rej}); ws.send(JSON.stringify({clientRef, mutation: m}));
      setTimeout(() => { if (pending.delete(clientRef)) rej(new Error("server timeout")); }, 5000); }),
    close: () => ws.close() };
}
```

**UI behavior contract (each item is acceptance-checked in Step 2):**
- No `?board=` → landing: "New board" (random id → pushState), "Try the demo" (POST /api/demo → navigate), join-by-id input.
- First visit to a board → JoinModal asks name; `pid` = `crypto.randomUUID().slice(0,8)` persisted in localStorage per board.
- Three columns with headers "✅ Went well", "🌧 Didn't go well", "🎯 Action items"; notes as cards (author badge "Ana" / "Ana's agent 🤖" in participant color, vote dots, owner chip on action notes, cluster chip). Redacted notes render blurred with the lock text.
- Drag note between columns (HTML5 dnd) → `move_note`; double-click own note to edit → `update_note`; ✕ on own notes → `delete_note`; "+" per column → `add_note` (blocked with toast during Vote per server error).
- PhaseStepper shows the 4 phases; click advances via `set_phase` (any participant); current phase highlighted; body gets `phase-<name>` class (brainstorm applies blur CSS to `redacted` notes).
- Vote phase: clicking a note toggles it in *my* vote set → `cast_votes` with full set; dots show counts; my remaining votes shown in header.
- PresenceBar: chip per participant (`● name` dim when offline) + "🤖 agent-ready" sub-chip. Header shows board id + copy-link button + `webmcp: NATIVE|SHIM` badge (from Task 5).
- SummaryPanel (right side, Actions phase only): renders `board.summary` as plain pre-wrap text with a "written by agent" caption when non-empty.
- Styling: single `styles.css`, light theme, system font stack, cards with soft shadow, participant colors as left border. Clean > fancy.

- [ ] **Step 1: Implement** all components against the contract.
- [ ] **Step 2: Verify in browser (claude-in-chrome):** two tabs, different names; every contract line above demonstrated (add/drag/edit/vote/phase/blur/presence both tabs). Fix until true.
- [ ] **Step 3: Commit** — `"Add board UI: join, columns, drag, votes, phases, presence, blur"`

---

### Task 5: WebMCP tool layer

**Files:**
- Create: `src/webmcp.ts`
- Modify: `src/App.tsx` (invoke on board mount + phase change), Header badge.

**Interfaces:**
- Consumes: `sendMutation`, current `board`, `me` from Task 4.
- Produces: `syncTools(ctx: ModelContextLike, board: Board, me: Participant, sendMutation)` — registers base+phase tools under one `AbortController` per phase; on phase change aborts and re-registers (native `toolchange` fires). `getContext(): {ctx, native: boolean}` returns `document.modelContext ?? navigator.modelContext ?? shim` (shim exposed as `window.__swarmShim` for automated testing).

**Tool set (names, schemas, execute — write exactly):**
- Always: `read_board` (readOnly; returns `JSON.stringify(redacted board)` — server already redacts, client returns what it has, plus one-line legend), `add_note {column enum, text}` (`asAgent:true`, description tells the agent to use the user's own words compressed), `move_note {noteId, column}`, `update_note {noteId, text}`, `delete_note {noteId}` (asAgent), `set_phase {phase enum}`.
- Phase `group`+: `cluster_notes {noteIds: string[], title}`.
- Phase `vote`: `cast_votes {noteIds: string[]}` (description: "casts your human's 3 votes — confirm with them first").
- Phase `actions`: `add_action_item {text, owner?}` (maps to add_note column "actions"), `set_summary {markdown}`.
- Every execute: `try { const info = await sendMutation(m); return {content:[{type:"text", text: info}]}; } catch(e){ return {content:[{type:"text", text: "Error: " + e.message}]}; }`
- All descriptions mention the participant identity: `"You are acting as ${me.name}'s agent; contributions are publicly badged."`

- [ ] **Step 1: Implement** `src/webmcp.ts` + wire into App (effect on `board.phase`).
- [ ] **Step 2: Verify via browser automation:** in tab A `window.__swarmShim.executeTool('add_note', {column:'well', text:'shipped the DO sync'})` → note appears in tab B with 🤖 badge; advance phase via tool; confirm `cluster_notes` only listed in group+ (`getTools()` length changes); wrong-phase call returns the structured error text.
- [ ] **Step 3: Commit** — `"Register phase-driven WebMCP tools with agent attribution"`

---

### Task 6: Demo seed + clone flow

**Files:**
- Create: `worker/demo-seed.ts` (a `Board` literal)
- Modify: `worker/board-do.ts` (`/init` handler already routes here), landing page button (Task 4 made it POST /api/demo).

**Seed content:** a finished-looking retro of team "Nova" (sprint 42): 3 participants (Maya, Tom, Priya) + agent-authored notes mixed in (≥5 notes with `authorKind:"agent"`), 2 clusters ("CI flakiness", "Docs debt"), votes distributed, phase `"actions"`, 3 action items with owners, a 4-sentence summary credited to "Priya's agent". Judge's clone starts at phase `actions` with a banner "This is a cloned demo — press ▶ Restart retro to run your own" (button = `set_phase brainstorm`).

- [ ] **Step 1: Write seed + wire init + banner.**
- [ ] **Step 2: Verify:** landing → Try the demo → fresh board id shows seeded history; restart works; a second clone gets a different id.
- [ ] **Step 3: Commit** — `"Add seeded demo retro and one-click clone for judges"`

---

### Task 7: Deploy to Cloudflare

- [ ] **Step 1:** `npx wrangler login` (**needs Alijon** — browser OAuth) then `npm run deploy`.
- [ ] **Step 2: Smoke test the workers.dev URL** exactly like Task 5 Step 2 but production, two browser tabs.
- [ ] **Step 3:** Ask Alijon to enable `chrome://flags/#enable-webmcp-testing` + restart Chrome → verify badge says **NATIVE** and tools appear in Chrome's DevTools WebMCP panel; then a real ChatGPT-browser run.
- [ ] **Step 4: Commit** any fixes — `"Production fixes from deployed smoke test"`.

---

### Task 8: Submission assets

**Files:**
- Create: `README.md`, `LICENSE` (MIT, holder "Alijon Karimberdiev"), `docs/demo-script.md`, `docs/devpost.md`

- [ ] **Step 1: README** — what it is (2 paragraphs), architecture diagram (ASCII), why WebMCP fits (the 4 judging bullets from the spec), run locally (`npm i; npm run dev`), deploy, tool reference table, "all code written during the submission period" note.
- [ ] **Step 2: `docs/demo-script.md`** — timed 3-min shot list: 0:00 hook (two browsers, two ChatGPTs, one board) · 0:20 solo brainstorm dictation · 1:00 second participant's agent joins, blur demo · 1:40 phase advance → toolchange shown in ChatGPT's tool list · 2:10 agent clusters + votes · 2:40 agent writes summary · 2:55 URL + repo. Alijon records + narrates.
- [ ] **Step 3: `docs/devpost.md`** — submission text: inspiration / what it does / how WebMCP is used (tool table + toolchange story) / challenges (per-viewer redaction, ack-verified tools) / what's next.
- [ ] **Step 4: Make repo public** (**needs Alijon**), commit, push, submit on Devpost before **13:00 PDT Sep 3**.

---

## Self-review (done at write time)

- Spec coverage: phases/tools table → Tasks 2+5; redaction → 2+3+4; solo-judge/demo → 6; caps/errors → 2; deploy/live URL → 7; deliverables → 8. Gap: none found.
- Placeholders: none — every step has code, exact names, or an acceptance list.
- Type consistency: `sendMutation` signature identical in Tasks 4 (producer) and 5 (consumer); mutation names identical in Tasks 2/3/5.
