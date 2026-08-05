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

## Shipped August 5, 2026 — One feedback widget, everywhere

**What changed for users:** "Was this helpful?" now looks and behaves identically no matter where you see it — under a chat response in the stage-detail dock, under a chat response in the standalone chatbot, or under the questions/wisdom/resources tabs on a journey step. The thumbs are yellow line icons (no more circle buttons), turn green or red when you pick one, and the label now reads left-to-right in the order you'd say it: "Was this helpful?" then the thumbs, instead of the thumbs floating off to the right. The comment box only shows up after you've picked a thumb, matches the width of the chat response above it, and there's one Submit button — no more separate Skip.

**User impact bullets:**
- "Was this helpful?" label now sits directly before the thumbs, left-aligned, on every surface
- Thumbs are yellow outline icons with no circular background; thumbs-up turns green when selected, thumbs-down turns red
- Comment box placeholder is context-aware: "What was helpful (optional)?" after 👍, "What would be more useful (optional)?" after 👎
- In chat, the comment box width now matches the response bubble above it instead of stretching wider
- One "Submit" button everywhere — the separate "Skip" button on the journey-step feedback is gone (the field was already optional)
- Submitting always shows "Thanks for the feedback."

**Technical decisions:**
Before this, the chatbot's feedback widget and the journey-step feedback widget were two separate implementations that had drifted: different markup, different CSS classes (`.mfb-*` vs `.fb-*`), different colors, different copy ("Thanks ✓" vs "Thanks for the feedback."), and — as the bubble-width bug from yesterday showed — no shared source of truth meant a fix in one place silently didn't apply to the other. Options were: keep patching both in parallel and hope they stay in sync, or collapse them into one component. Final call: pulled both into a single `createFeedbackWidget()` factory in a new `feedback.js`, imported by both `chat.js` (for the two chat surfaces) and `app.js` (for the journey-step tabs). The only thing that varies by context now is the `onSubmit` callback each caller passes in — chat logs `question`/`bot_response` alongside the verdict, journey steps log `milestone`/`section` — and a single CSS scoping rule (`.msg-fb .fbw-form { max-width: 82% }`) that caps the chat version's width to match the bubble above it. The color-changing thumbs also forced a decision: real 👍/👎 emoji can't be recolored via CSS, so both surfaces now use the same line-art SVG icons (`stroke="currentColor"`) that the journey-step widget already had, instead of emoji.

Watch out for: since this is now one shared component, a bug here shows up in three places at once instead of one — but a fix also lands in three places at once, which is the whole point.

**Blog URL:** *(coming soon)*

---

## Shipped August 4, 2026 — Chat polish: wider bot bubbles, honest feedback prompts

**What changed for users:** Chat responses are easier to read, and giving feedback on a response is less committal. The chatbot's answer bubbles are noticeably wider (they'd quietly stayed narrow in the stage-detail dock even after we widened them in the standalone chat). While the bot is composing a reply, the dots now come with the words "Give me a minute…" instead of just three silently bouncing dots. And the response feedback widget — the 👍/👎 under every bot message — no longer traps you: the comment box used to appear whether or not you'd picked a thumb, which made the feedback prompt feel mandatory. Now it stays hidden until you actually pick 👍 or 👎, and once it shows, the field is clearly optional.

**User impact bullets:**
- Bot response bubbles in the stage-detail chat dock are now as wide as the ones in the full-screen chat — no more narrow, heavily-wrapped text
- Typing indicator now reads "Give me a minute…" alongside the animated dots
- The feedback comment box only appears after tapping 👍 or 👎, not before
- Comment box placeholder now reads "Your feedback on this response (optional)," styled in italic gray so it reads as a hint, not a demand
- Thumbs icons no longer sit inside a circular button outline — just the icon, dimmed until selected
- Removed the separate "Skip" button; the comment field is optional by design, so Send alone covers both "just the thumb" and "thumb plus a note"

**Technical decisions:**
The bubble-width miss was a copy-paste gap: when we widened chat bubbles, the CSS override went on `.ch-msgs .m-bbl` (the full-screen chat's message list) but never got mirrored onto `.dock-msgs .m-bbl` (the stage-detail dock), so the dock silently kept the old 210px cap. Fixed by moving the wide `max-width: 82%` onto `.msg.b .m-bbl` — a rule scoped to bot messages generally, not a specific chat surface — so any current or future chat surface gets it automatically instead of needing a per-surface override.

The feedback-box bug was more interesting: the box's wrapper (`.mfb-form`) was set to `hidden` via the HTML attribute, but the CSS class rule `.mfb-form { display: flex; }` has equal specificity to the browser's built-in `[hidden] { display: none; }` rule — and author CSS beats user-agent CSS in a specificity tie. So the box was visible from the moment a message rendered, regardless of whether a thumb had been picked. Added an explicit `.mfb-form[hidden] { display: none; }` rule to make the intent unambiguous instead of relying on the browser default winning a fight it was always going to lose.

Watch out for: this feedback widget is shared code (`createChatSurface()` in chat.js), so the fix applies identically to the dock and the full-screen chat — no separate patch needed, but also no separate testing signal if it breaks again in only one place.

**Blog URL:** *(coming soon)*

---

## Shipped August 4, 2026 — Visual cleanup: consistent nav, quieter home cards

**What changed for users:** Small polish pass on the redesign that shipped earlier today. The "Ask anything" card no longer looks visually different from "Your journey" — both read as equal options now. The chat icon switched from a black square to the same orange-on-cream treatment as the journey icon, so the two cards feel like a matched set. The human silhouette icon that sat in the home screen's top-right corner is gone; that spot is now the "What's New" link, and it's in the same spot on every screen, not just buried in a footer. The landing page's subhead is shorter.

**User impact bullets:**
- "Ask anything" card no longer has a highlighted border — both home cards read as equal-weight options
- Chat icon is now orange line-art on a cream circle, matching the journey icon instead of standing out as a black square
- The top-right "human" icon on Home is gone; "What's New (Release Notes) →" lives there instead
- "What's New" now appears top-right on every screen (landing, home, journey, detail, chat) instead of only in a footer at the bottom of the page
- Landing page subtext trimmed to one sentence

**Technical decisions:**
None of this changed behavior — it's a visual-consistency pass after shipping the bigger nav change earlier today. Two things stood out on a second look: the "Ask anything" card had an orange border and a black-square icon that made it read as the "important" choice, which wasn't the intent — both cards are meant to be equal entry points. And the footer's "What's New" link only lived below the fold on the landing page, easy to miss and inconsistent with the WTF/Beta brand mark's consistent top-left position on every screen. Final call: strip the accent styling from the chat card entirely, and promote "What's New" into the header row opposite the brand mark on every screen, replacing the old fixed-footer instance and the homepage's now-orphaned human icon. Watch out for: on narrow screens the header row is now doing more work (brand block + a wrapping link) — if a future screen adds a third header element, this two-column layout will need to become three.

**Blog URL:** *(coming soon)*

---

## Shipped August 4, 2026 — Cut the funnel: landing goes straight to Home

**What changed for users:** The path from landing to the app is now one tap instead of three. The persona-selector screen and the "You've made the decision" credibility screen are gone — the landing page's "See for yourself" button drops you directly into Home. Every screen also now shows a consistent WTF/Beta brand mark in the top-left that takes you back to the landing page from anywhere.

**User impact bullets:**
- Landing page CTA goes straight to Home — no persona pick, no credibility-bridge stats screen in between
- Home no longer says "Welcome back" or names a current journey stage (there's no way for the app to know that yet)
- Every inner screen (Home, Journey, Stage detail, Chat) has the same WTF/Beta wordmark top-left; tapping it always returns to the landing page

**Technical decisions:**
Two weeks after shipping the Home/Journey/Chat redesign, the persona-selector and credibility-bridge screens were the next thing in the way — they existed to justify unlocking the chatbot behind an editorial gate, a gate the last redesign had already started softening. With chat one tap from Home regardless, the extra two screens were just friction before the app's actual value. Options were: keep them as an optional "learn more" detour, or cut them outright. Final call: cut outright — every screen that isn't Home, Journey, Detail, or Chat is a screen a first-time user has to get through before they see anything useful, and neither of the two removed screens had a clear job once the gate was gone. The brand-mark decision was smaller: with three fewer screens to navigate between, users needed one predictable way back to the start, so the wordmark became clickable everywhere instead of a decorative label duplicated per screen. Watch out for: the "you're on: [stage]" copy on the old Home card is gone for the same reason it was removed last time — there's still no mechanism for a user to set or the app to infer their current stage, so don't reintroduce a hardcoded guess.

**Blog URL:** *(coming soon)*

---

## Shipped August 3, 2026 — The app got a home: redesign around Home, Journey, and Chat

**What changed for users:** The app has a new mobile-first structure. After onboarding you land on a home screen with two clear paths — browse the journey stage by stage, or ask the community anything — instead of being dropped into a single dense milestone page.

**User impact bullets:**
- New home screen with two entry cards: "Your journey" and "Ask anything"
- The journey is now a scrollable list of 10 stage cards (numbered, with descriptions) instead of a horizontal strip of abbreviations like "TEST" and "CONS"
- Each stage page uses three tabs — Questions to explore / What women wish they knew / Resources — instead of stacked accordions
- The chatbot has a full-screen home of its own, one tap from the home screen, plus the familiar collapsible dock on every stage page
- Works on desktop web too — renders as a centered mobile-width column

**Technical decisions:**
The old journey screen tried to do everything at once: a milestone strip, three accordions, and a chat dock stacked on one screen. The redesign started as a prototype in Claude Design (claude.ai/design), which let me tap through Home → Journey → Stage detail → Chat before committing to code. The big implementation decision: the design now has *two* chat surfaces (full-screen chat and the stage dock), and the old chat code was hardwired to one set of DOM elements. Options were duplicating the chat logic per surface or refactoring it into a factory. Final call: one `createChatSurface()` factory in chat.js that binds streaming, markdown rendering, and telemetry to any set of chat elements — each surface keeps its own conversation history. Two judgment calls that deviated from the prototype: dropped the "you are on stage X" indicator entirely (there's no way for users to set their stage yet, so a hardcoded one would just be wrong for most people), and kept dock conversations alive when switching stages (the prototype wiped them — deleting someone's chat because they navigated felt like a bug). Watch out for: chat is now one tap from home instead of being gated behind the editorial, so the "editorial must lead" principle is softened — worth watching whether users skip the journey content entirely.

**Blog URL:** *(coming soon)*

---

## Shipped August 3, 2026 — The receipts are in the repo: data pipeline + eval trail backed up

**What changed for users:** Nothing visible in the app — this one is about making sure the work behind it can't be lost. The pipeline that builds the 10,000+ conversation corpus and the full experiment trail behind the retrieval overhaul now live in the repo.

**User impact bullets:**
- No user-facing changes — the app behaves exactly as before
- The data pipeline (scrape → embed → synthesize) is now version-controlled instead of living only on one laptop
- Every eval run behind the May retrieval decision is archived with a README explaining what was tried and why

**Technical decisions:**
Two months of the most important work on this product existed only on my local machine: the three-stage Python pipeline that built the corpus, and six eval CSVs documenting how retrieval went from 9% to 100% pass rate. The options were (a) leave it local and hope the laptop survives, (b) dump everything into git as-is, or (c) commit selectively. The blockers to (b): a `.env` with real API keys sitting inside the pipeline folder, and a 71MB `posts.json` of raw scraped data. Final call: gitignore the secrets and the raw corpus (it's regenerable by re-running the scraper, and the embedded version persists in Supabase), commit the scripts with a README, and organize the eval CSVs into an "eval/RAG to HyDE experimentation" folder with a decision-trail README — including the two runs that turned out to be recalibrating the judge rather than improving retrieval. Watch out for: the scraper still must run locally (Reddit blocks data-center IPs), so GitHub is backup and documentation here, not automation.

[BUILDER'S NOTE: Replace this with what surprised you, what you'd do differently, the human story behind this decision.]

**Blog URL:** *(coming soon)*

---

## Shipped June 1, 2026 — Corpus size updated to 10,000+ conversations

**What changed for users:** The app now correctly reflects how many real community conversations power the chatbot.

**User impact bullets:**
- Copy updated from "2,000+" to "10,000+" throughout the app

**Technical decisions:**
The corpus grew well past 2,000 posts after expanding scraping across 7 subreddits with multiple sort orders. The copy just hadn't been updated to match. Fixed three instances in index.html — the bridge card, the chat dock header, and the expanded chat dock header.

**Blog URL:** *(coming soon)*

---

## Shipped May 13, 2026 — The chatbot now finds better answers before it searches

**What changed for users:** Responses are more grounded in real community experience. Questions that used to return a fallback ("I don't have much on that") now pull relevant posts.

**User impact bullets:**
- More questions get real community context instead of a fallback
- Answers feel less like keyword matching and more like the bot understood what you were actually asking
- Retrieval improved from roughly 57% of questions finding good context to 91%

**Technical decisions:**

*The core problem:* Our corpus is Reddit posts — answers written by women who've been through it. Our queries are questions. In vector space, questions and answers live in different neighborhoods, so cosine similarity kept surfecting question-like posts (e.g. "has anyone else found injections painful?") over answer-like posts ("the injections weren't bad for me, just a small sting in the stomach"). The retriever was finding the wrong posts not because they weren't there, but because it was searching in the wrong direction.

*Why HyDE:* HyDE (Hypothetical Document Embeddings) fixes this by generating a hypothetical Reddit-style answer post before embedding — then embedding that instead of the raw question. When a user asks "how much did this cost?", we ask Haiku to write a 2-4 sentence Reddit post from a woman who's been through it, then embed that. The resulting vector lands in answer space, where the actual community posts are. It's one extra LLM call (Haiku, ~200ms) before the OpenAI embed.

*Options considered:* Reranking (cross-encoder second pass) was the other candidate. Reranking improves ordering within an already-retrieved set — useful when you're finding the right neighborhood but surfacing slightly wrong chunks. Our problem was more fundamental: we weren't finding the right neighborhood at all. HyDE fixes the root cause; reranking would have polished a broken signal.

*Trade-offs:* Each user message now makes one extra Haiku call before the embed, adding ~200-400ms of latency before retrieval. Cost goes up slightly per message. Match count also increased from 8 to 20 chunks, giving Claude more community context per response — at the cost of a larger system prompt (~4,000 more tokens per call).

*What to watch:* Latency on first-response feel. If users notice the chat feeling slow, the HyDE call is the first thing to profile. Also worth watching: whether 20 chunks vs 8 changes response quality in either direction — more context can dilute as well as enrich.

**Blog URL:** *(coming soon)*

---

## Shipped May 8, 2026 — Every chat question is now logged — and you can rate each response

**What changed for users:** Every question you ask the chatbot and every response it gives is now stored. You can also give a thumbs up or down on any response directly in the chat.

**User impact bullets:**
- Thumbs up/down appears under each bot response — tap to rate, add a comment if you want
- Your question and the bot's response are saved together so feedback is always in context
- Questions are tagged with which phase of the journey you're on when you ask them

**Technical decisions:**

*Why log the conversations:* The chatbot is only as good as what it's being asked. Logging Q&A to a `chat_messages` table gives a real picture of what questions women are actually bringing — which will inform both content and RAG tuning. Each row captures session, stage, milestone, question, response, and whether the user was on mobile.

*The per-response feedback design:* Editorial feedback (thumbs on milestone cards) was already wired. Chat feedback needed a different pattern — tied to a specific exchange, not a general "was this helpful?" The widget renders under each bot bubble after streaming finishes, captures the verdict and an optional comment, and logs to `feedback_events` with `source: 'chatbot'` plus the exact question and response that was rated.

*Milestone threading:* The chat already knew the user's stage (`active`), but not which specific milestone they were viewing when they asked. Added `setDockMilestone()` export called from `renderMilestone()` — so every logged message also carries the milestone (e.g. `re_consult`, `stim_start`). This matters for understanding whether questions cluster around specific phases.

*Source tagging:* Both editorial and chatbot feedback land in the same `feedback_events` table, tagged `source: 'editorial'` or `source: 'chatbot'`. One table for querying everything; the source field for filtering.

**Blog URL:** *(coming soon)*

---

## Shipped May 8, 2026 — The app was broken and we didn't know it

**What changed for users:** The "Try out WTF in Beta" button now actually works. Feedback you submit (thumbs up/down + comments) now lands in our database.

**User impact bullets:**
- CTA button on the homepage navigates correctly for the first time on the live site
- Thumbs up/down feedback on milestone sections is now stored and queryable
- The whole app's JS was silently failing on the live site — this fixes all of it

**Technical decisions:**

*The root cause was invisible:* GitHub Actions was running, completing successfully, and reporting "success" on every push. GitHub Pages was also serving the site. Both systems were working — they just weren't connected. Pages was configured to deploy from the `main` branch root (raw source files), not from the GitHub Actions artifact (the Vite-built `dist/`). The action was uploading the correct built bundle to the Pages environment, but Pages was ignoring it and serving raw source files instead.

*Why this was hard to catch:* The site looked fine. HTML and CSS render without JS. The button was visible, styled correctly, and appeared interactive. But `import.meta.env` is a Vite-specific construct — browsers don't understand it. The raw `app.js` crashed on line 4 (`import.meta.env.BASE_URL`), silently killing every event listener before any were attached. One console error, invisible to anyone who wasn't actively looking.

*The fix was a one-click settings change:* GitHub repo → Settings → Pages → Source → switch from "Deploy from a branch" to "GitHub Actions." Then trigger a fresh deploy. The architecture was always correct; the Pages source setting was just wrong.

*The lesson:* "Deploy succeeded" means the CI job completed — it doesn't mean users can use the app. The only reliable signal is: does the actual user-facing action work? We had no smoke test for "does clicking the CTA button navigate." Add one.

*The feedback telemetry bug was separate but related:* `SESSION_ID` was being generated correctly but never included in the POST body sent to Supabase. Supabase was rejecting inserts silently (HTTP 400 responses swallowed by a bare `catch` block). Fixed by adding `user_session_id: SESSION_ID` to the request body. Now every thumbs up/down + comment lands in `feedback_events` with a session ID for grouping.

**Blog URL:** *(coming soon)*

---

## Shipped May 7, 2026 — The chatbot was broken (and we built a test to find out)

**What changed for users:** The chatbot now actually uses real community data when answering questions. Before this fix, every response was a fallback — the app was never retrieving anything from the database.

**User impact bullets:**
- Chatbot answers are now grounded in real r/eggfreezing and r/IVF posts
- Responses should feel noticeably more specific and human than before
- A retrieval eval harness is now in place to measure and track answer quality over time

**Technical decisions:**

*The bug:* The Edge Function was calling `match_posts` with the wrong parameter names — `filter_subreddit` and no `match_threshold` — while the actual database function expects `stage_filter` and `match_threshold`. PostgreSQL function overloading means if the parameter names don't match exactly, it simply doesn't find the function. Supabase returns a schema cache error. The Edge Function caught that error and silently served the fallback response every time. From the outside, the chatbot appeared to work. The answers just had no community grounding at all.

*How we found it:* Built a retrieval eval — a script that runs 23 real user queries through `match_posts`, scores each returned chunk via Claude Haiku (binary PASS/FAIL: does this chunk help answer the question?), and writes results to a timestamped CSV. The first run returned errors on all 23 queries. Reading the error message from the CSV revealed the parameter name mismatch immediately. The eval found a bug the app had been hiding for weeks.

*The eval itself:* Pass bar is 6/8 chunks relevant = PASS. First clean run: 2/23 queries passed (9%). That's the baseline. Retrieval quality needs work — separate problem from the bug fix, to be investigated next. The eval runs with `npm run eval`.

*What to watch:* The `match_threshold` is now set to 0.75 in the Edge Function. If the chatbot starts returning "I don't have info on that" too often, the threshold may be too strict. If answers feel vague or off-topic, it's too loose. The retrieval eval is the instrument for measuring this.

**Blog URL:** *(coming soon)*

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
