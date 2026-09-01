# WebMCP Challenge — Idea Candidates

**Status (Aug 31, 2026):** Pivoted away from the agent-negotiation marketplace (spec at
`docs/superpowers/specs/2026-08-28-agent-negotiation-marketplace-design.md`, now shelved) —
too likely that many of the 3,400+ participants build agent-commerce apps.

## Saved candidate: Agent Whiteboard ("the canvas ChatGPT draws on")

A live diagramming canvas (react-flow) where the visiting agent is a true co-editor.
Say "map out my microservices with a payment flow" — nodes, edges, and groups appear
on screen as ChatGPT calls tools. The human drags things around; the agent reads the
canvas state and builds on it.

- **Demo:** most visual possible 3-min video — a diagram draws itself while a human rearranges it
- **Audience:** engineers/PMs who sketch architecture, flows, org charts daily
- **WebMCP depth:** selection-scoped dynamic tools (select 2 nodes → `connect_selected`
  appears), toolchange lifecycle, readOnly canvas reads, verifiable mutations
  (every tool returns the new graph)
- **No LLM key needed** — the judge's ChatGPT is the brain
- OpenAI explicitly names collaborative whiteboards/docs as the frontier category;
  their WebMCP showcase for it is empty
- Scores: Leverage ★★★★★ · Execution risk low-medium · Impact ★★★★ · Creativity ★★★★★

## Active exploration lens

"The most boring task that can be made easy with an agent" — tedious, universally
hated digital chores where WebMCP tools let ChatGPT do the drudgery while the human
supervises on the live page.
