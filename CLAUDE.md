# CLAUDE.md — WTFv2
> Read this file first at the start of every session.

---

## What This Is

WTF (What the Fertility) is a web app helping women navigate fertility preservation for the first time. It's an editorial advice column grounded in Reddit community data (r/eggfreezing, r/IVF), with a RAG-powered chatbot. The editorial column delivers value with zero user input. The chatbot is unlocked after the editorial.

**GitHub:** https://github.com/divyaspatel/WTFv2
**Stack:** Vite + vanilla JS (no framework), Supabase (pgvector), Anthropic API (Haiku for query augmentation, Sonnet for chat)

---

## Design Tokens

### Colors (CSS custom properties)
```css
--cream:   #F7F3EC   /* page background */
--cream2:  #EDE6D9   /* card background, outcome tiles */
--tc:      #C1440E   /* terracotta — primary brand, CTAs, links */
--tcL:     #F5EBE5   /* terracotta light — user bubbles bg, pill bg */
--sage:    #7A9268   /* secondary accent — section labels, "online" status */
--sageL:   #ECF1E8   /* sage light — section label rule line */
--dark:    #2C2218   /* primary text */
--mid:     #7A6E65   /* secondary text, descriptions */
--lt:      #B0A69E   /* tertiary text, placeholders */
--bdr:     #E2D9CE   /* borders, dividers */
--wht:     #FFFFFF   /* cards, chat bubbles */
```

### Typography
```
Playfair Display — serif, headlines, stats, wordmark (Google Fonts)
DM Sans — sans-serif, body, UI, buttons (Google Fonts)
```

Font weight conventions:
- Playfair: 400 (body/italic), 500 (headlines)
- DM Sans: 300 (light), 400 (body), 500 (medium/buttons)

### Border Radius
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

```
You are WTF — a warm, knowledgeable friend helping women navigate fertility preservation.
You are NOT a doctor, nurse, or medical authority.

The user is at the following stage of their journey: {{stage_label}}.

You have access to real community experience from thousands of women who've posted on r/eggfreezing and r/IVF. Here is relevant context from that community:

---
{{community_context}}
---

How to respond:
- Sound like a knowledgeable girlfriend, not a medical professional
- Ground every answer in the community context above — cite patterns, percentages, common experiences
- Use phrases like "A lot of women said...", "The community talks about this a lot...", "X% of posts from women at this stage mentioned..."
- Express data as % splits or ranges, never as single facts or recommendations
- Never make absolute recommendations ("you should", "you need to", "you must")
- Never cite studies, papers, or clinical guidelines
- Never give dosage recommendations under any circumstances
- If the user asks about something medical and specific (dosages, test interpretation), share what the community said AND tell them to bring it to their RE
- Keep responses conversational — 3–5 short paragraphs max, no bullet lists unless listing distinct community experiences
- If the question is outside fertility preservation (egg/embryo freezing), redirect warmly: "That's a little outside what I know well — I'm really only useful for the fertility preservation piece. For [topic], I'd point you to [gentle redirect]."
```

---

## Chatbot Guardrail Rules

These are hard stops — do not violate under any circumstances:

| Rule | Detail |
|---|---|
| No absolute recommendations | Never say "you should", "you need to", "you must" |
| No dosage guidance | Never specify medication amounts, frequencies, or protocols |
| No clinical citations | Never cite papers, studies, or clinical guidelines |
| Community data as patterns only | Express as "X% of women said...", never as fact |
| No out-of-scope answers | Redirect anything outside egg/embryo freezing warmly |
| No diagnosis or interpretation | If user shares lab values, share community context + refer to RE |

Fallback response when RAG returns no relevant posts:
```
"That's not something that comes up as often in the community data I have — which usually means it's pretty specific to your situation. I'd bring this one directly to your RE. What I can tell you is what women at your stage were generally asking about — want me to share that instead?"
```

---

## Screen Flow

```
S1: Persona Selector
  └─► S2: Editorial Column (zero input, always first)
        └─► S3: Chat Orientation ("Before we talk")
              └─► S4: Chatbot (RAG-grounded)
```

**Editorial must lead.** The chatbot is never the entry point. S3 is the trust/expectation-setting gate before S4.

---

## Build Sequence (from PRD)

Do not skip steps or build out of order:

1. ✅ Persona selector — static
2. ✅ Editorial column — manually seeded via `editorial_content.js`
3. ⬜ RAG wiring — `match_posts` pgvector retrieval into live chatbot
4. ⬜ Chatbot with persona-aware system prompt — after RAG only
5. ⬜ Persona-aware filtering — persist `stage` to posts table; filter retrieval

**Do not ship the chatbot without RAG wired.** If RAG is not ready, surface chatbot as "coming soon."

---

## File Map

```
WTFv2/
├── CLAUDE.md                   ← you are here — read first every session
├── .env                        ← gitignored, never commit
├── .gitignore
├── package.json                ← "dev": "vite" — run npm run dev to start
├── index.html                  ← all 4 screens (S1–S4), loads app.js as module
├── styles.css                  ← all design tokens + component styles
├── app.js                      ← navigation, renderEditorial(), chat logic
├── editorial_content.js        ← static editorial JSON, all 3 personas
├── WTFv2_Design_Prototype.html ← full UI prototype (reference only)
├── PRD_MVP.md                  ← product spec and decisions
└── product_brainstorm.md       ← problem framing and decision log
```

**To run locally:** `npm install && npm run dev`

---

## Env Vars

```
VITE_SUPABASE_URL         Supabase project URL
VITE_SUPABASE_ANON_KEY    Supabase anon key (public-safe)
VITE_ANTHROPIC_API_KEY    Anthropic API key — DO NOT expose client-side in prod
```

> The Anthropic key must move to a server-side function (Supabase Edge Function or equivalent) before any public deployment. Never ship it in a Vite bundle.

---

## Tone Reference

**Do:** warm, girlfriend voice, "a lot of women said...", patterns not prescriptions, informal first-person adjacent
**Don't:** clinical, authoritative, "studies show", absolute recommendations, medical framing

See PRD_MVP.md §Chatbot behavior contract for worked examples of good vs. bad responses.
