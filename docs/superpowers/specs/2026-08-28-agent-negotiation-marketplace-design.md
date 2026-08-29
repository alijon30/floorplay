# Agent-Negotiation Marketplace — Design Spec

**Date:** 2026-08-28
**Target:** The WebMCP Challenge (webmcp.devpost.com), deadline **Sep 3, 2026, 1:00 PM PDT**
**Working name:** `webmcp-marketplace` (placeholder — the user picks the real product name before deploy/submission; per judge guidance the name must not be AI-generated)

## 1. Summary

A peer-to-peer marketplace where every listing is guarded by a **mandate agent**. A seller sets a private mandate — floor price, auto-accept threshold, negotiation strategy, FAQ notes, tone — and their agent instantly fields every buyer question and offer, 24/7. Buyers browse with ChatGPT via WebMCP: it searches, questions the seller's agent, haggles offer/counter-offer, and hands the human a confirm-to-buy moment at checkout.

**Positioning (critical):** this is a *negotiation protocol between agents with humans in the loop on both sides* — never framed as a storefront. Storefronts/carts are the overdone WebMCP demo category; the novel mechanic here is agent-vs-agent haggling under a human-set mandate.

**Real problem:** P2P sellers (Craigslist/FB Marketplace) drown in "is this available?" messages and lowball spam. A mandate agent answers instantly, around the clock, and never breaks the seller's floor.

## 2. Judging alignment

| Criterion | How we score it |
|---|---|
| WebMCP Leverage | ~10 tools in three lifecycle tiers (always-on, state-dependent, route-scoped); AbortSignal lifecycle; `readOnlyHint`/`untrustedContentHint` used correctly; verifiable mutations; simulated buyer consumes the page's own tools via `getTools()`/`executeTool()` (both sides of the API) |
| Execution | Zero-friction judge path: land → haggle via ChatGPT in under a minute; abuse-proof for a month of public judging |
| Potential Impact | Real, universally felt P2P selling pain; explainable agent (audit log shows which mandate rule fired) |
| Creativity & Ambition | Agent-to-agent negotiation with dual human-in-the-loop; differs from every official demo category |

## 3. Platform facts that constrain the design

- Judge surface is the **ChatGPT desktop app's built-in browser** (WebMCP support since Aug 25, 2026). It only sees **imperative `document.modelContext.registerTool()` calls on the top-level document** — no declarative form tools, no iframe tools.
- Secondary surface: Chrome 149+ with `chrome://flags/#enable-webmcp-testing`, inspected via DevTools → Application → WebMCP pane (manual tool invocation; no built-in agent). README documents both paths.
- **Tools die on real page navigation.** The app is a strict SPA: Next.js App Router with client-side navigation only; the document never reloads inside the marketplace.
- Secure context (HTTPS) required; do not send `Origin-Agent-Cluster: ?0`.
- Chrome character budgets (treated as hard limits): tool name ≤30 chars, description ≤500, param descriptions ≤150, tool output ≤1.5K chars.
- Tool I/O is text/JSON only. `execute` returns MCP-style `{content:[{type:"text",text}]}`.

## 4. Personas & flows (both zero-signup)

### Buyer (the judge's default path)
1. Lands on a grid of ~10 seeded listings, each with an active mandate agent.
2. Opens the site in ChatGPT's browser; tools appear; asks ChatGPT to find something and haggle.
3. ChatGPT: `search_listings` → `open_listing` (the human *sees* the agent browse) → `ask_seller` → `make_offer` → seller agent counters instantly → `accept_counter` → `checkout` (ChatGPT prompts the human to confirm — the demo climax) → confirmation code.
4. All offers/purchases are **private to the buyer's anonymous session**: 3,400+ participants cannot vandalize or empty the showcase; seeded listings never globally delist.

### Seller
1. One click ("Try selling") → anonymous seller session → dashboard.
2. Creates a listing (title, description, category, condition, price, **stock image library only — no uploads**).
3. Sets the mandate: floor price, auto-accept threshold, strategy (`firm` / `split-difference` / `step-down`), max rounds, FAQ notes, tone preset.
4. Watches a live audit log: "Buyer offered $80 → your agent countered $95 (rule: below floor $85, strategy: split-the-difference)". **Every agent action names the rule that fired** (explainability differentiator).
5. "Summon a buyer" button triggers a simulated buyer persona so the dashboard is never empty.
6. Seller can also drive everything via ChatGPT on the dashboard route: "list my old camera at $90, floor $70, firm tone" → `create_listing` + `set_mandate`.

## 5. WebMCP tool surface

Single source of truth: Zod schemas per tool, validated server-side and converted to JSON Schema for `inputSchema`.

### Tier 1 — always registered (buyer side)
| Tool | Hints | Behavior |
|---|---|---|
| `search_listings` | readOnly, untrustedContent | query/category/max-price filter; returns top 5 compact rows (id, title, price, condition) |
| `get_listing` | readOnly, untrustedContent | full listing details (seller UGC) |
| `open_listing` | — | client-side navigate the UI to the listing (shared human/agent context) |
| `ask_seller` | untrustedContent | Q&A grounded ONLY in listing + FAQ notes; never sees mandate numbers |
| `make_offer` | — | creates/advances thread; returns offer id, thread state, and the seller agent's instant response (counter/accept/reject with amounts) — verifiable mutation |
| `get_my_activity` | readOnly | the session's threads and purchases |

### Tier 2 — state-dependent (register/unregister as negotiation state changes; the dynamic-lifecycle showcase)
| Tool | Exists when | Behavior |
|---|---|---|
| `accept_counter` | ≥1 thread in COUNTERED | takes `thread_id`; accept the seller's counter → ACCEPTED |
| `checkout` | ≥1 thread in ACCEPTED | takes `thread_id`; fake checkout; returns confirmation code + summary; consequential (ChatGPT asks the human to confirm) |

### Tier 3 — route-scoped (seller dashboard only)
| Tool | Hints | Behavior |
|---|---|---|
| `create_listing` | — | create listing from params + stock image key |
| `set_mandate` | — | set/update mandate for own listing |
| `get_my_threads` | readOnly | live negotiation feed w/ rule rationales |

Registration lifecycle: a typed client-side registry wraps `registerTool` with one AbortController per tool; React hooks bind Tier 2 to thread-state (from the activity store) and Tier 3 to the dashboard route. Feature-detect `document.modelContext`; the site is fully usable without it.

## 6. Negotiation state machine

Per thread = (buyer session × listing):

```
NONE → OFFERED → ACCEPTED → PURCHASED
            ↘ COUNTERED ⇄ re-offer (round++ ≤ max_rounds)
            ↘ REJECTED (terminal)
COUNTERED → accept_counter → ACCEPTED
round > max_rounds → REJECTED (rationale: "max rounds reached")
```

Seller agent responds synchronously in the same request (instant demo feedback).

## 7. Core logic

- **Mandate engine** — pure function `decide(mandate, thread, offer) → {action: accept|counter|reject, amount?, rationale}`. No I/O. Deterministic rules own ALL money decisions:
  - `offer ≥ auto_accept` → accept
  - `offer ≥ floor` and strategy would counter at ≤ offer → accept
  - otherwise → counter per strategy, clamped to ≥ floor; after `max_rounds`, reject with rationale "max rounds reached"
  - Strategy definitions (seller's opening position = asking price):
    - `firm` — counter is always the asking price ("the price is the price"); floor only matters for auto-reject of absurd offers
    - `split-difference` — counter = midpoint of buyer's offer and seller's last position, clamped ≥ floor
    - `step-down` — counter = seller's last position − (step_pct% of asking), clamped ≥ floor
  - never emits an amount below floor (property-tested)
- **Q&A provider** — interface `answerQuestion(listing, faqNotes, question) → string`. Ships with `TemplateProvider` (deterministic, zero keys). `OpenAIProvider` / `AnthropicProvider` selected via env var when a key exists. The provider input **never contains floor/auto-accept numbers** — prompt injection cannot leak what isn't in the prompt.
- **Simulated buyer** — scripted persona; in supporting browsers it drives the page's own registered tools via `document.modelContext.getTools()` / `executeTool()` (API-consumer flex), with direct registry-call fallback elsewhere.

## 8. Data model (Neon Postgres + Drizzle)

- `sessions` — anonymous cookie UUID; created on first write; no PII
- `listings` — title, description, category, condition, asking_price_usd, image_key, status, `is_seed`, seller_session_id (null for seeded), timestamps
- `mandates` — 1:1 listing; floor_usd, auto_accept_usd, strategy, step_pct, max_rounds, faq_notes, tone. **Server-side only: never serialized into any buyer-path API/tool response.**
- `threads` — listing_id, buyer_session_id, state, current_offer_usd, current_counter_usd, rounds, timestamps
- `events` — append-only: thread_id, actor (buyer_agent|seller_agent|system), type (offer|counter|accept|reject|question|answer|checkout), amount, text, `rule_fired`, created_at. Powers buyer chat view, seller audit log, and explainability.

## 9. Architecture

- **Next.js (App Router, TypeScript) on Vercel** — marketplace is one client-side-routed SPA region; API route handlers for listings/offers/questions/mandates.
- Anonymous session cookie (httpOnly UUID) issued lazily.
- Seller dashboard liveness: polling every ~2–3s (serverless-friendly; SSE optional stretch).
- Seed content: ~10 listings with personality (vintage camera, mechanical keyboard, road bike, synthesizer, mid-century chair, …), curated stock images shipped with the app.

## 10. Security & operational limits

- Server-side Zod validation on every tool/API input (never trust the agent).
- Rate limits per session on write paths (offers, questions, listings).
- **Floor-leak test in CI:** no buyer-path response may contain mandate numbers.
- No user image uploads (stock library only) — removes the biggest UGC-abuse vector.
- Seeded showcase auto-reheals (seed script idempotent; seeded rows immutable to visitors).
- Tool outputs truncated ≤1.5K chars; names/descriptions within Chrome budgets.
- `untrustedContentHint: true` on every tool whose output embeds seller/buyer text.

## 11. Testing & verification

- TDD (unit) on mandate engine + thread state machine, including property tests (floor never breached, rounds bounded).
- Integration tests on tool handlers (schema validation, state transitions, output budgets).
- Playwright smoke on the two golden paths (buyer haggle→checkout; seller create→mandate→audit log).
- Manual matrix before submission: ChatGPT desktop browser (full flows) + flagged Chrome DevTools WebMCP pane (registration/lifecycle visible).

## 12. Schedule (6 days)

| Day | Deliverable |
|---|---|
| Fri Aug 29 | Scaffold, schema, seed content, mandate engine (TDD), marketplace UI shell |
| Sat Aug 30 | WebMCP registry + Tier-1 tools, offer/thread API, lifecycle verified in flagged Chrome |
| Sun Aug 31 | Seller dashboard, mandate editor, audit log, Tier-2/3 tools, simulated buyer |
| Mon Sep 1 | End-to-end in ChatGPT desktop, tool-description tuning, visual polish, production deploy + showcase |
| Tue Sep 2 | Demo video (<3 min, YouTube, narrated), README, Devpost description, OSS license, bug buffer |
| Wed Sep 3 AM | Final checks; submit hours before 1 PM PDT |

## 13. Submission checklist (Devpost requirements)

- [ ] Live URL on Vercel, testable in ChatGPT desktop browser + flagged Chrome
- [ ] Public repo (GitHub) with OSS license + working setup instructions
- [ ] Text description: WebMCP fit, human-agent collaboration, implementation notes
- [ ] Demo video <3 min, public YouTube, audio narration (record ChatGPT desktop driving the site)
- [ ] Product name chosen by the user (not AI-generated)

## 14. Open items

1. **Product name** — user decides before deploy (placeholder: `webmcp-marketplace`).
2. **LLM key** — none for now; `TemplateProvider` ships; plug OpenAI/Anthropic via env var if a key appears.
3. SSE vs polling for dashboard liveness — start with polling; upgrade only if time allows.
