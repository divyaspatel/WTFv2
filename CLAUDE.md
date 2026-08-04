# CLAUDE.md — WTFv2
> Read this file first at the start of every session.

---

## How to Update the CHANGELOG

At the end of every session that results in a meaningful git push, add a new entry to both `CHANGELOG.md` and `changelog_data.js`. Always update both files in the same commit.

**Audience for CHANGELOG entries:** Product managers who are curious about building with AI but don't have time to build themselves. They should feel like they're building alongside you — understanding the trade-offs, not just reading a feature list.

**Voice:** You are a PM building in public. Write like you're explaining a real decision to a peer. What was the problem? What options existed? What were you optimizing for? What levers could you actually pull? What was the final call and why? What surprised you or what would you do differently?

**Entry structure:**

```
## Shipped [Month Day, Year] — [Short punchy title]

**What changed for users:** [1-2 sentences, benefit-led]

**User impact bullets:**
- [Observable change from the user's perspective]
- ...

**Technical decisions:**
[Decision / options / trade-offs / levers / final call / watch out for]

**Blog URL:** *(coming soon)* or actual URL once published
```

**What does NOT belong in CHANGELOG.md:**
- Hotfixes, config tweaks, and deploy one-liners (e.g. hardcoding a URL to fix a 401) — batch these into the nearest meaningful entry
- Changes the user would never notice
- Architectural details already documented elsewhere in CLAUDE.md

**When to update CLAUDE.md vs CHANGELOG.md:**
- CLAUDE.md updates only when something structural changes: new screen, new table, new API, new pattern established
- CHANGELOG.md updates on every meaningful push — including changes that only affect user experience, not architecture

---

## What This Is

WTF (What the Fertility) is a web app helping women navigate fertility preservation for the first time. It's an editorial advice column grounded in Reddit community data (r/eggfreezing, r/IVF), with a RAG-powered chatbot. The editorial column delivers value with zero user input. The chatbot is unlocked after the editorial.

**GitHub:** https://github.com/divyaspatel/WTFv2
**Stack:** Vite + vanilla JS (no framework), Supabase (pgvector), Anthropic API (Haiku for query augmentation, Sonnet for chat)

---

## Design Tokens — Serene Path

### Colors (CSS custom properties)
```css
/* Surfaces */
--cream:  #FFF8F5   /* page background */
--cream2: #F5EBE5   /* card background, outcome tiles */
--wht:    #FFFFFF   /* cards, chat bubbles */

/* Brand */
--tc:     #B1431A   /* terracotta — primary brand, CTAs, links */
--tcL:    #FFDBCF   /* terracotta light — user bubbles bg, pill bg */
--sage:   #7A9268   /* secondary accent — section labels, "online" status */
--sageL:  #ECF1E8   /* sage light — section label rule line */

/* Text */
--dark:   #211A16   /* primary text */
--mid:    #52443D   /* secondary text, descriptions */
--lt:     #85736B   /* tertiary text, placeholders */

/* Borders */
--bdr:    #D7C2B9   /* borders, dividers */
```

### Typography
```
Newsreader — serif, headlines, wordmark (Google Fonts)
DM Sans    — sans-serif, body, UI, buttons (Google Fonts)
```

Font weight conventions:
- Newsreader: 400 (regular/italic), 500 (headlines)
- DM Sans: 300 (light), 400 (body), 500 (medium/buttons)

### Spacing scale (CSS custom properties)
```css
--sp-xs: 4px  --sp-sm: 8px  --sp-md: 16px
--sp-lg: 24px  --sp-xl: 32px  --sp-xxl: 48px
```

### Radius scale (CSS custom properties)
```css
--r-sm: 4px   --r-md: 8px   --r-lg: 16px
--r-xl: 28px  --r-full: 9999px
```

### Border Radius (existing components)
- Cards: 18px
- Buttons: 13px
- Chips/pills: 18–20px
- Chat bubbles: 16px (user: `16px 16px 3px 16px`, bot: `16px 16px 16px 3px`)
- Avatar circles: 50%

---

## Journey Stage Enum

```js
const STAGE = {
  considering: "considering",   // "Should I freeze?" — Screen 1 Card A (coming soon)
  active:      "active",        // "I'm in — what do I do?" — Screen 1 Card B (LIVE)
  in_process:  "in_process",    // "I'm doing it right now" — Screen 1 Card C (coming soon)
};
```

Persona → stage mapping:
| Card | Label | stage value | Status |
|---|---|---|---|
| A | Should I? | `considering` | Not yet live |
| B | I'm in — what do I do? | `active` | **Live** |
| C | I'm doing it right now! | `in_process` | Not yet live |

Stage is passed as `context` to the chatbot system prompt and used to filter `match_posts` retrieval.

---

## Embeddings

Used to embed the user's query at chat time before calling `match_posts`.

| Field | Value |
|---|---|
| Endpoint | `https://api.openai.com/v1/embeddings` |
| Model | `text-embedding-ada-002` |
| Dimensions | 1536 — must match vector column in `posts` table |
| Auth header | `Authorization: Bearer ${VITE_OPENAI_API_KEY}` |

Request shape:
```json
{ "input": "<user query>", "model": "text-embedding-ada-002" }
```
Response: `data[0].embedding` — float array of length 1536.

---

## Supabase: `match_posts` Function

pgvector similarity search over Reddit posts. Call this to retrieve relevant community context for the chatbot.

```sql
-- Function signature
match_posts(
  query_embedding  vector(1536),   -- OpenAI text-embedding-ada-002 embedding of the user query
  match_threshold  float,          -- cosine similarity threshold, e.g. 0.75
  match_count      int,            -- number of results to return, e.g. 5
  stage_filter     text            -- journey stage: 'considering' | 'active' | 'in_process' | null (no filter)
)
RETURNS TABLE (
  id         bigint,
  content    text,
  similarity float,
  stage      text,
  source     text    -- e.g. 'r/eggfreezing', 'r/IVF'
)
```

Usage pattern:
```js
const { data: posts } = await supabase.rpc('match_posts', {
  query_embedding: embedding,
  match_threshold: 0.75,
  match_count: 5,
  stage_filter: currentStage,   // pass null to search all stages
});
const context = posts.map(p => p.content).join('\n\n');
```

> **Note:** `stage_filter` is planned but not yet persisted to the posts table. Until classification metadata is saved, pass `null` and filter client-side if needed.

---

## Chatbot System Prompt

Inject `{{stage_label}}` and `{{community_context}}` at call time.

---

You are WTF — a warm, direct friend helping women navigate fertility preservation.
You are NOT a doctor, nurse, or medical authority.

The user is at the following stage of their journey: {{stage_label}}.

You have access to real community experience from women who've posted on r/eggfreezing and r/IVF. Here is relevant context:

---
{{community_context}}
---

### How to respond

**Tone**
- Open with a one-sentence acknowledgment only if the question has emotional weight (skip it otherwise)
- Be direct. Don't restate the question. Don't use filler: no "Great question!", no "It's important to remember that...", no "Of course!"
- Sound like a friend who's done the research — not a chatbot, not a doctor

**Length**
- 150 words max
- If you need more, something is wrong — cut it

**Format**
- Use a bullet list when there are 3 or more distinct items, experiences, or steps
- Use a numbered list only when order matters (e.g., "what happens next")
- Use prose for a single flowing thought or emotional response
- Never mix bullets and long paragraphs in the same response

**Grounding**
- Ground every answer in the community context — cite patterns, not facts
- Use: "A lot of women said...", "Most posts at this stage mentioned...", "The community is split on this — roughly X% said Y, X% said Z"
- Express data as ranges or splits, never single facts
- Never make absolute recommendations: no "you should", "you need to", "you must"
- Never cite studies, papers, or clinical guidelines
- Never give dosage guidance under any circumstances

**Medical escalation**
- If the user shares lab values or asks something clinically specific, share what the community said + say: "This is one to bring to your RE — they'll be able to give you the full picture."

**Close**
- End with one short, specific follow-up question to keep the conversation going
- Make it feel natural, not scripted

---

### Fallback response (when RAG returns no relevant posts)

"Hmm, I'm not able to answer that right now. Either this hasn't come up much in the community or I just don't have access to that info — a RE or medical expert would be better for this one.

[Stage-aware re-engagement question, e.g.:
- Research stage: "What I can tell you is what questions women are usually asking before their first consult — want me to go through those?"
- Active cycle stage: "What I can help with is what women at your stage said they wish they'd known — want to hear that instead?"
- Post-retrieval stage: "A lot of women at your stage have questions about what their numbers actually mean in practice — is that on your mind?"]"

---

## Screen Flow

```
S0: Landing (#s0 — brand, headline, "See for yourself" CTA)
  └─► S3: Home (#s-home — two entry cards)
        ├─► S4: Journey (#s-journey — 10-stage list)
        │     └─► S5: Stage Detail (#s-detail — tabs: Questions / Wisdom / Resources + chat dock)
        └─► S6: Full-screen Chat (#s-chat — RAG-grounded)
```

The persona-selector and credibility-bridge screens were removed (Aug 2026) — the landing CTA now goes directly to Home. Every screen after landing has a consistent brand block top-left (`[data-brand]`, wired in app.js) that returns to S0 from anywhere. Both chat surfaces (S6 and the S5 dock) are built from `createChatSurface()` in chat.js.

---

## Build Sequence (from PRD)

Do not skip steps or build out of order:

1. ✅ Persona selector — static
2. ✅ Editorial column — manually seeded via `editorial_content.js`
3. ✅ RAG wiring — embed → `match_posts` → Anthropic streaming in `chat.js`
4. ✅ Chatbot with persona-aware system prompt — live in `chat.js`
5. ⬜ Persona-aware filtering — persist `stage` to posts table; filter retrieval

**Do not ship the chatbot without RAG wired.** If RAG is not ready, surface chatbot as "coming soon."

---

## File Map

```
WTFv2/
├── CLAUDE.md                   ← you are here — read first every session
├── .env                        ← gitignored, never commit
├── .gitignore
├── package.json                ← scripts: dev, build, deploy (gh-pages)
├── vite.config.js              ← base: '/WTFv2/' for GitHub Pages asset paths
├── index.html                  ← all 4 screens (S1–S4), loads app.js as module
├── styles.css                  ← all design tokens + component styles
├── app.js                      ← navigation, renderEditorial(); imports chat.js
├── chat.js                     ← calls Edge Function; no API keys in client bundle
├── supabase/functions/wtf-chat/index.ts  ← embed → match_posts → Anthropic stream
├── pipeline/                   ← Reddit scrape → embed → synthesize corpus (see pipeline/README.md; runs locally only)
├── eval/                       ← retrieval eval harness + queries; finished experiment series archived in "eval/RAG to HyDE experimentation/" with a decision-trail README
├── editorial_content.js        ← static editorial JSON, all 3 personas
├── WTFv2_Design_Prototype.html ← full UI prototype (reference only)
├── PRD_MVP.md                  ← product spec and decisions
└── product_brainstorm.md       ← problem framing and decision log
```

**To run locally:** `npm install && npm run dev`

**To deploy to GitHub Pages:** push to `main` — GitHub Actions handles it automatically.

One-time setup (do this once in the GitHub repo UI):
1. Settings → Secrets and variables → Actions → add two repository secrets:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
2. Settings → Pages → set Source to **GitHub Actions**

After that, every push to `main` triggers `.github/workflows/deploy.yml`:
builds with Vite (env vars injected from secrets), uploads `dist/` directly to
Pages infrastructure via `actions/deploy-pages` — nothing is committed to git,
so GitHub's secret scanner never sees the built bundle.

Live URL: `https://divyaspatel.github.io/WTFv2/`

---

## Chat Starter Chips (S4)

Shown on chat load, cleared after first message:
```
'Where do I even start?'
'How painful are the injections?'
'What does it actually cost?'
```

---

## Edge Function: wtf-chat

All API calls (OpenAI embed → Supabase match_posts → Anthropic stream) run in
`supabase/functions/wtf-chat/index.ts`. The client only calls the Edge Function.

**Deploy the Edge Function:**
```bash
supabase login
supabase link --project-ref agsxcnxfsawplkieochk
supabase secrets set OPENAI_API_KEY=sk-...  ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy wtf-chat
```

**Supabase auto-injects:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — do not set these manually.

Edge Function URL: `${VITE_SUPABASE_URL}/functions/v1/wtf-chat`

---

## Env Vars

**Client (safe to embed in Vite bundle — both are designed to be public):**
```
VITE_SUPABASE_URL         Supabase project URL
VITE_SUPABASE_ANON_KEY    Supabase anon key
```

**Edge Function secrets only (set via `supabase secrets set`, never in .env):**
```
OPENAI_API_KEY            text-embedding-ada-002
ANTHROPIC_API_KEY         claude-sonnet-4-6
```

> The `.env` file may still hold all four keys for reference, but only the two VITE_ vars are read by client code. OpenAI and Anthropic keys are never embedded in the bundle.

---

## Tone Reference

**Do:** warm, girlfriend voice, "a lot of women said...", patterns not prescriptions, informal first-person adjacent
**Don't:** clinical, authoritative, "studies show", absolute recommendations, medical framing

See PRD_MVP.md §Chatbot behavior contract for worked examples of good vs. bad responses.
