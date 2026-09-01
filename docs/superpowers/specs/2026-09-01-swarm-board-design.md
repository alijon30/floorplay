# Swarm Board — Design Spec

**Date:** 2026-09-01 · **Deadline:** 2026-09-03 13:00 PDT (WebMCP Challenge, webmcp.devpost.com)
**Status:** Approved by Alijon in chat, 2026-09-01.

## One-liner

A live team-retro board where every participant's own ChatGPT joins as a named
co-participant via WebMCP — posting notes, clustering themes, casting votes, and
drafting the summary — while humans drag, edit, and see every agent action happen
on the shared page in real time.

## Why this wins (judging criteria)

- **WebMCP Leverage:** phase-driven dynamic tool registration (the tool list
  ChatGPT sees morphs as the retro advances), `toolchange` lifecycle, readOnly
  annotations, server-enforced phase rules, verifiable tool results, and
  redaction of other participants' notes during Brainstorm (agents can't spoil
  groupthink — a trust-boundary detail).
- **Creativity:** multi-human multi-agent collaboration on one live page —
  a story few of 3,400 entrants will tell.
- **Impact:** every software team runs retros; agents absorb the drudgery
  (dedup, clustering, action-item extraction, summary writing).
- **Execution:** risky core de-risked by spike (WS relay + WebMCP tools +
  two-tab sync worked in ~30 min); solo-first design means a judge alone
  gets full value.

## Product

Retro board with three columns: **Went well / Didn't go well / Action items**.
Shareable URL per board (`/?board=<id>`). No auth: human picks a display name
(localStorage); their agent inherits "«Name»'s agent" identity. Every note is
badged by author (human vs agent, colored per participant).

### Retro phases and the tool surface

| Phase | Human UI | Tools available to agents |
|---|---|---|
| **Brainstorm** | others' notes blurred | base tools; `read_board` redacts others' note text |
| **Group** | blur lifted, drag to cluster | + `cluster_notes({noteIds, title})` |
| **Vote** | 3 vote dots per participant | + `cast_votes({noteIds})` |
| **Actions** | actions column + summary panel | + `add_action_item({text, owner})`, `set_summary({markdown})` |

Base tools (always registered): `read_board` (readOnly annotation),
`add_note({column, text})`, `move_note({noteId, column})`,
`update_note({noteId, text})`, `delete_note({noteId})` (own agent's notes only).

Any participant can advance the phase — UI button, and a `set_phase` tool
registered for every agent (there is no privileged facilitator role). Phase
rules are enforced in the Durable Object — a tool call
illegal in the current phase returns a structured error. Tool `execute` resolves
only after the server acks the mutation, and returns the outcome (e.g. new note
id + board count) so the agent can verify its own writes.

## Architecture

- **Frontend:** React + Vite static SPA. Columns, drag-and-drop, presence bar
  (humans + agents online), phase stepper, vote dots, cluster groups, summary
  panel. WebMCP registration via `document.modelContext.registerTool` (native;
  a dev-only shim is used for automated testing when the flag is absent —
  clearly labeled in UI).
- **Backend:** Cloudflare Worker serving static assets + one **Durable Object
  per board**: authoritative state, one WebSocket per client, full-state
  broadcast on mutation (fine at retro scale), state in DO storage
  (refresh-safe, no cold starts).
- **Data model:**
  `Board { id, phase, participants[{id, name, color, online}], notes[{id, text, column, clusterId?, authorId, authorKind: human|agent, votes[participantId], ts}], clusters[{id, title}], summary }`
- **Protocol:** client→DO `{type: join|mutate, mutation, clientRef}`;
  DO→clients `{type: state, board, ack?: clientRef, error?}`.

## Solo-judge experience

Landing page: create board, join board, or **"Try the demo"** — clones a seeded
board (a real multi-agent retro recorded during our demo session, agent badges
visible) into a fresh private copy so each judge gets a clean sandbox their own
ChatGPT joins. Solo loop is fully valuable: dictate thoughts → agent posts →
agent clusters → agent drafts actions and summary.

## Error handling

- WS reconnect with backoff; DO state persists across refresh/redeploy.
- Tool errors are structured strings (`"vote limit reached (3)"`,
  `"cluster_notes is only available in the Group phase"`).
- `add_note` text capped (500 chars), participant names capped (50), board
  size capped (500 notes) — abuse guards, also part of the security story.

## Testing

- Dev: drive tools via in-page `getTools`/`executeTool` (spike-proven), two
  Chrome tabs for realtime verification.
- Native: Chrome 149+ with `chrome://flags/#enable-webmcp-testing` (user
  enables), then ChatGPT in-app browser as the judge-realistic environment.
- Pre-submission checklist: fresh-profile cold run of the exact judge flow.

## Deliverables

Live URL (workers.dev), public repo with MIT license + README (WebMCP
rationale, what's old/new — all new during submission period), <3-min video
with audio, Devpost text.

## Cut lines (in order, if behind)

blur-during-Brainstorm → Vote phase → clusters as visual groups (fall back to
tags). Non-negotiable core: notes + realtime sync + phase-driven dynamic tools
+ seeded demo.
