# CHANGELOG — WTF (What the Fertility)

> This file is the source of truth for what shipped, when, and why.
> It feeds the Release Notes page on the live site and informs blog content.
>
> **How to update this file:**
> After every meaningful push, add an entry using the structure below.
> Write as a PM building in public — audience is other PMs who want to understand
> the trade-offs, not just what changed. Document: what problem was solved,
> what options existed, what was being optimized for, what levers were available,
> what the final decision was, and what you'd tell someone to watch out for.
> Always update `changelog_data.js` in the same commit so the live page stays in sync.

---

## Shipped May 4, 2026 — No more phone frame

**What changed for users:** The app now fills your actual screen — whether you're on your phone, tablet, or desktop browser. No more tiny cutout in the middle of the page.

**User impact bullets:**
- On mobile: the app uses your full screen, exactly like any native app would
- On desktop: content centers in a clean 560px column — no phone-shaped box, no gray surround
- "What's new →" link now appears on all devices, not just desktop
- All content is reachable by scrolling — nothing is clipped or hidden off-screen

**Technical decisions:**

*The problem:* The original UI wrapped everything in a `#phone` div — literally 375×790px with rounded corners, drop shadow, and a fake status bar showing "9:41" and battery icon. The intent was to demonstrate the mobile-first design in a browser demo. The consequence was a broken product: fixed pixel dimensions clipped content, the footer lived outside the fake phone so it was invisible on real phones, and users opening the app on an actual device saw a redundant phone-within-a-phone.

*What "mobile-first" actually means vs. what was built:* Mobile-first means your CSS defaults to mobile layout and scales up via media queries. It does not mean render a phone frame. These are completely different things. The frame was a demo artifact that shipped into production.

*The fix:* Deleted the `#phone` wrapper, the fake status bar, and 88 lines of CSS. Replaced with `#app` — a proper flex column filling `100dvh`, centered at `max-width: 560px` on desktop, full-width on mobile. Moved the footer inside the app so it renders on all viewports. Fixed S0's scroll so content doesn't clip on short screens.

*What to watch:* The 560px desktop max-width is a reading-comfort choice, not a constraint. If you ever want a two-column layout on wider screens, that's the next lever to pull.

[BUILDER'S NOTE: Replace this with what surprised you, what you'd do differently, the human story behind this decision.]

**Blog URL:** *(coming soon)*

---

## Shipped May 4, 2026 — Real stories, finally

**What changed for users:**
The milestone cards throughout the journey map now show real wisdom, quotes, and patterns from women who've actually been through egg freezing — not placeholder text. Each of the 10 phases of the journey is backed by synthesized insights from 40+ actual Reddit posts.

**User impact bullets:**
- Journey milestone cards show real community quotes and observed patterns
- Each phase reflects what women at that exact stage said they wished they'd known
- Content is AI-synthesized from the r/eggfreezing and r/IVF communities

**Technical decisions:**

*The problem:* The 10-phase journey milestones were built and live, but they were showing static placeholder content. The data pipeline to synthesize community insights and store them in Supabase needed to be built and wired to the UI.

*The approach:* Built a batch synthesis pipeline (`pipeline/synthesize_wtfv2.py`) that runs a semantic search per milestone, pulls the most relevant community posts, synthesizes them via Claude, and upserts the results to a `milestone_insights` table in Supabase.

*The levers:* Two key parameters controlled quality:
- **`MATCH_THRESHOLD`** — cosine similarity cutoff. Higher = only very relevant posts pass through. Lower = more posts but some may be tangential.
- **`MATCH_COUNT`** — number of posts to pull per milestone. More posts = richer synthesis but higher API cost and potential noise.

*The trade-off:* In real-time chat, you balance relevance, latency, and cost simultaneously. This is a batch job — it runs once (or on demand), not per user request. That changes the optimization entirely. Latency and cost effectively don't matter here. The only lever worth pulling is accuracy of the synthesis.

*The decision:* `MATCH_THRESHOLD=0.65` (more permissive than the chat threshold of 0.75, to allow broader community context for synthesis) and `MATCH_COUNT=40` (enough signal per milestone without diluting the synthesis). Also built an `ivfflat` vector index on the posts table (lists=100) to make similarity search fast as the dataset grows.

*What to watch:* The 0.65 threshold is deliberately more permissive than chat. If milestone content starts feeling generic or off-topic, tighten it back toward 0.70–0.75. The sweet spot moves as the post corpus grows.

**Blog URL:** *(coming soon)*

---

## Shipped April 29, 2026 — The full journey, in one view

**What changed for users:**
The app now shows you all 10 phases of the egg freezing journey before you start asking questions — from "Should I even do this?" all the way through "My results are in." You can see the full arc, understand where you are, and ask more targeted questions as a result.

**User impact bullets:**
- 10-phase journey map replaces the previous editorial article format
- Each phase is its own card: title, key questions women ask, and community wisdom
- The chatbot is still accessible at any point — the map gives you context first

**Technical decisions:**

*The problem:* The original editorial format was article-style — long, linear, easy to skim past without absorbing. The goal was to surface the structure of the journey visually so users could orient themselves before asking questions.

*The pivot:* Replaced the editorial + orientation screens with a "credibility bridge" (why trust this product) and a journey milestone map. This was a significant structural change — two screens collapsed into a different UX pattern entirely.

*The phase structure:* 10 phases were defined based on how women on Reddit actually describe their experience — not clinical stages, but emotional and logistical milestones. The names and sequencing came from reading hundreds of posts, not from a medical framework.

*Supporting changes:* Tightened the chatbot system prompt (cut filler, sharpened the community-grounding instructions). Trimmed the feedback payload from a broad schema to just `verdict`, `optional_text`, `milestone`, and `section` — only what's actually useful for iterating.

*What to watch:* The 10-phase structure was a hypothesis. If users consistently ask questions that don't map to any phase, that's a signal the phases need rewriting, not that the chatbot needs more prompting.

**Blog URL:** *(coming soon)*

---

## Shipped April 23, 2026 — A door worth opening

**What changed for users:**
WTF now has a proper front door — a homepage that explains what you're about to use and why you should trust it, before asking you to do anything. Chat responses also now render as proper lists instead of raw asterisks and dashes.

**User impact bullets:**
- New homepage: what WTF is, why it exists, what you'll learn — before any persona selection
- Chat now renders bullet and numbered lists cleanly instead of showing raw markdown symbols
- Smoother first impression overall

**Technical decisions:**

*The front door:* Before this, the app opened directly to the persona selector. That meant users were being asked to self-identify their journey stage before they understood what the product was. Added S0 as a landing screen with a clear value prop and a single CTA.

*The Google OAuth mistake:* The first version of S0 had a Google sign-in button — added speculatively because "you'll probably want auth eventually." Removed it two days later. The friction it added wasn't justified at this stage, and it was solving a problem that doesn't exist yet. Classic premature feature. The lesson: build for the user you have, not the user you imagine you'll have.

*Markdown rendering:* The Anthropic API was returning formatted responses with bullet lists, but the chat UI was rendering them as raw text (asterisks and hyphens). Added a lightweight markdown parser for the chat bubble renderer — handles `**bold**`, `- bullets`, `1. numbered lists`, and line breaks. No external library; ~30 lines of JS.

*What to watch:* The markdown parser is minimal by design. If the chatbot starts using formatting patterns that break rendering (like nested bullets or tables), it's cheaper to add a rule to the parser than to constrain the model response format.

**Blog URL:** *(coming soon)*

---

## Shipped April 21, 2026 — It goes public

**What changed for users:**
WTF is live at a real URL. The app is mobile-optimized and accessible from any phone without installing anything.

**User impact bullets:**
- Live at https://divyaspatel.github.io/WTFv2/
- Optimized for mobile screens
- Chatbot now connected to real community data (see entry below)

**Technical decisions:**

*The deployment architecture:* The plan was to deploy client-side JS to GitHub Pages and embed API keys in the Vite bundle. GitHub's secret scanner blocked the push — it detected the API keys and refused to let them through. This forced a rethink.

*The Edge Function decision:* Moved all API calls (OpenAI embedding, Supabase vector search, Anthropic streaming) into a Supabase Edge Function. The client only calls the Edge Function — no secrets in the bundle, ever. This wasn't originally planned; it was forced by a constraint. But it's the right architecture: the client should never hold API keys, and the Edge Function is the natural boundary between the client and external services.

*The upside of constraints:* The GitHub secret scanner "failure" produced a better architecture than the original plan. The Edge Function is stateless, runs at the edge (low latency), and means no backend server to maintain. Worth remembering: sometimes a blocker is pointing at a better path.

*CORS, hardcoded URLs, redeploys:* Several hotfixes on this day — CORS headers missing on Edge Function errors, Supabase URL not being picked up from env vars on GitHub Pages, favicon path broken. Normal first-deploy chaos. Each fix was a one-liner; the pain was in the deploy cycle time.

**Blog URL:** *(coming soon)*

---

## Shipped April 21, 2026 — The community gets a voice

**What changed for users:**
The chatbot now draws its answers from real Reddit posts by women who've been through egg freezing. When you ask a question, WTF searches thousands of community posts for relevant experiences, then synthesizes an answer from that — not from a model's training data.

**User impact bullets:**
- Every chatbot answer is grounded in real r/eggfreezing and r/IVF community posts
- Responses reflect actual patterns, not generic medical summaries
- The chatbot knows its limits: if the community hasn't talked about something, it says so

**Technical decisions:**

*The RAG architecture:* Retrieval-Augmented Generation — embed the user's query, find the most similar community posts via cosine similarity, inject those posts as context before the model generates a response. This is the entire product's differentiator.

*Why OpenAI for embeddings, not Anthropic:* Anthropic doesn't offer a standalone embedding API. `text-embedding-ada-002` (OpenAI, 1536 dimensions) is the established standard for pgvector deployments. The embedding model and the generation model being from different providers is normal and fine; they don't need to be the same.

*The model split:* Haiku for query augmentation (fast, cheap, just needs to rewrite the query), Sonnet for the main chat response (quality matters here). Using the right model for the right job.

*The threshold:* `match_threshold=0.75` for chat — strict enough to filter noise, permissive enough to return something useful for most questions. This was set by feel initially; it's the most important tunable parameter in the product.

*What to watch:* The threshold is everything. Too high and the chatbot falls back to "I don't have that" constantly. Too low and responses drift from community experience toward model hallucination. Monitor fallback rate as a proxy.

**Blog URL:** *(coming soon)*

---

## Shipped April 21, 2026 — The first draft

**What changed for users:**
WTF exists. You can pick your journey stage (considering / active / in-process), read editorial content tailored to that stage, and see the chatbot interface — though at this point the chat wasn't yet connected to anything real.

**User impact bullets:**
- Three-persona selector: "Should I freeze?", "I'm in — what do I do?", "I'm doing it right now"
- Editorial column: answers the most common questions at each stage, with zero user input
- Chat interface visible — but static, not yet connected to community data

**Technical decisions:**

*The foundational product decision:* The chatbot is never the entry point. Editorial leads. Users read community-grounded content before they can ask questions. This was a deliberate product philosophy — people need to build trust in the source before they'll act on its answers. Reversing this order would produce a worse product even if the chatbot were perfect.

*Why no framework:* Vite + vanilla JS. No React, no Vue, no Svelte. The app has four screens and minimal state — a framework would add build complexity and bundle size for no gain. This decision gets second-guessed every time someone asks "why isn't this in React," but it's held up. Simpler is faster to ship.

*The persona model:* Three stages (`considering`, `active`, `in_process`) map to meaningfully different user needs. The same question ("how much does this cost?") has a different best answer depending on whether you're researching or mid-cycle. Stage-awareness is baked in from day one, even though only `active` is live.

*What to watch:* "Considering" and "in-process" are marked "coming soon." The persona model only pays off if those two stages are eventually built. If they're never built, the three-card selector is wasted real estate.

**Blog URL:** *(coming soon)*
