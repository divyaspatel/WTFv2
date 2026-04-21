# PRD: WTF MVP — Editorial Advice Column
Owner: Divya Patel
Status: Planning / Kickoff
Last Updated: April 2026

---

## Executive Summary

Women navigating fertility preservation for the first time are anxious, information-overwhelmed, and deeply isolated. WTF delivers immediate, community-grounded guidance in an editorial format — zero personal input required to get value on first visit — with a chatbot that becomes more useful the more a user engages.

---

## Opportunity Framing

**Core Problem:** Women beginning the fertility preservation process don't know what they don't know, and the gap between googling and their first RE appointment is filled with anxiety, misinformation, and Reddit rabbit holes.

**Working Hypothesis:** If we can surface what women at the same journey stage were afraid of, asked about, and actually did — in an editorial format that requires no personal input — we can deliver immediate value and earn the right to collect information over time.

**Strategy Fit:** This is the trust-building layer that makes everything else (personalization, journey pathway, benchmarking) possible. Without trust, users won't share data. Without data, personalization is shallow.

---

## User Research Signals & Principles

1. **Users won't give personal info early** — trust must be earned through demonstrated value first
2. **Trust takes time and repeated engagement** — design for return visits, not single sessions
3. **"When do I open this" must be answered** — there needs to be a clear trigger moment
4. **Value first, input later** — show the community data before asking anything
5. **More usage = better experience** — personalization is the reward for engagement, not the price of entry

---

## MVP Scope

### In Scope
- Persona selector (Screen 1)
- Editorial column per persona (Screen 2, left column)
- Chatbot grounded in Reddit community data (Screen 2, right/below column) — **only after RAG is wired**
- Mobile-responsive layout

### Out of Scope (explicitly)
- Journey pathway builder / "design your journey" (Screen 3) — requires trust and input not yet earned; build after return visit patterns are established
- Profile/onboarding flow on first visit
- Results interpreter / benchmarking widget — high value but separate build
- Clinic picker, financial navigation
- Native mobile app

---

## Screen Specifications

### Screen 1: Persona Selector

Three entry points, no personal data required:

| Persona | Label | Description |
|---|---|---|
| A | Should I? | I don't know if I should freeze my eggs/embryos |
| B | I'm in, what do I do? | I want to freeze my eggs/embryos but need help getting started |
| C | I'm doing it! | I'm in the process right now |

**Decision:** Persona selection sets the system prompt context for the chatbot and filters which editorial content is shown. It is not saved to a profile on first visit.

---

### Screen 2: Editorial Column + Chatbot

**Layout decision:** Editorial column leads. Chatbot sits below (mobile) or to the right (desktop). Do not present them simultaneously as equal options — editorial delivers value with zero input and must be the hook.

#### Column 1: Editorial (zero input required)

**Section 1 — You Are Not Alone**
- 2–3 sentences validating the emotional reality of being at this stage
- Tone: warm, girlfriend voice, not clinical
- Sourced from: synthesized community sentiment, not invented copy

**Section 2 — What They Were Afraid Of**
- Bullet list of the fears, questions, and anxieties most common at this persona's stage
- Format: "X% of women at this stage asked about [topic]" — community data as % splits, never as recommendations
- Source: classified Reddit posts filtered by journey stage

**Section 3 — What Actually Happened**
- The outcomes and decisions that women at this stage navigated
- Format: % splits ("Of women who did Y, Z% said...")
- This is the differentiated asset — not generic advice, but aggregated community experience

**Section 4 — What They Wish They'd Known**
- The "girlfriend advice" moment — the things that surprised people, the things they'd do differently
- Tone: informal, first-person adjacent ("A lot of women said they wished they'd asked about...")

#### Column 2: Chatbot

- Entry prompt: "Everyone's exact journey is different. Where are you and what's top of mind?"
- **Must be grounded in Reddit community data via RAG** before shipping
- If RAG is not wired: ship editorial column only, surface chatbot as "coming soon" or hold entirely
- Chatbot must never make absolute recommendations, cite papers/studies, or present community data as clinical fact
- Responses should feel like a knowledgeable girlfriend, not a medical authority

**Chatbot behavior contract (examples):**

| Input | Good Response | Bad Response |
|---|---|---|
| "Is 32 too old to freeze eggs?" | "A lot of women on r/eggfreezing froze in their early 30s. AMH and AFC matter more than age alone — about 60% of posts from women 30-34 described getting good retrieval results." | "You should freeze your eggs as soon as possible." |
| "How many eggs do I need?" | "The most common question in the community. There's no magic number — women shared a wide range. Many aimed for 10-20 mature eggs, but it depended heavily on their age and whether they wanted embryos vs. eggs." | "You need at least 15-20 eggs to have a good chance." |
| "Should I do embryos or eggs?" | "This comes up constantly. Whether you freeze eggs vs. embryos usually comes down to whether you have a partner and how you feel about the decision now vs. later. Women who froze embryos with partners mentioned [X], women who froze eggs alone mentioned [Y]." | "You should freeze embryos if you have a partner." |
| "My AMH is 0.8, is that bad?" | "AMH of 0.8 is on the lower end — a lot of women with similar numbers talked about still having successful retrievals, though they often did more than one round. This is something to go deep on with your RE." | "AMH of 0.8 is too low to freeze eggs successfully." |
| "What medications will I have to take?" | "The community talks about this a lot. Most protocols involve daily injections for 10-14 days — the most common ones mentioned are Gonal-F, Menopur, and a trigger shot. Your protocol will depend on your clinic and your numbers." | "You'll need to take Gonal-F 300IU starting on day 2." |

**Hard guardrails:**
- No dosage recommendations
- No absolute recommendations ("you should", "you need to")
- No citing studies or papers
- Community data expressed as % splits or "many women said..." — never as fact
- If question is outside scope (e.g., "do I have cancer"): redirect warmly, don't answer
- If question is outside scope of fertility preservation, specifically egg freezing or embryo freezing (e.g., "how are stethescopes made"): redirect warmly, don't answer

---

## Build Sequence

Build in this order. Do not advance to next step until current step is working:

1. **Persona selector** — static, no backend needed
2. **Editorial column content** — per persona, can be manually seeded first, then pipeline-generated
3. **RAG wiring** — `match_posts` pgvector retrieval into live Q&A (per previous context: this is the immediate next action)
4. **Chatbot with persona-aware system prompt** — only after RAG is wired
5. **Persona-aware filtering** — persist classification metadata to posts table; filter retrieval by journey stage

Other things in the backlog for the future: 
- adding other data sources to the dataset like TikTok videos that walk through egg/embryo freezing experiences

---

## Technical Dependencies

| Dependency | Status | Notes |
|---|---|---|
| `match_posts` pgvector function | Exists | Not yet wired into live Q&A |
| Classification metadata on posts | Not persisted | Discarded after `extract.py` — needs to be saved to `posts` table |
| Haiku query augmentation | Planned | Before embedding at query time |
| Persona-aware system prompt | Not built | Needed for chatbot differentiation |
| Editorial content per persona | Not built | Can manually seed first round |

---

## Success Metrics

### Primary (leading indicators)
| Metric | Target | Measurement |
|---|---|---|
| Return within 7 days (no prompt) | >25% of first-time visitors | Supabase session tracking |
| Chatbot messages per session (sessions that reach chatbot) | ≥3 messages | Event log |
| Editorial scroll depth | >75% of editorial column | Scroll event |

### Secondary (engagement quality)
| Metric | Target | Notes |
|---|---|---|
| % sessions reaching chatbot from editorial | >40% | Funnel conversion |
| Persona distribution | Track only (no target) | Understand who's coming |
| Profile completion rate over time | Track only | Proxy for trust building |

### Guardrails (if these degrade, pause)
- Chatbot producing absolute recommendations → kill switch, revert to editorial-only
- User-reported inaccurate community data → flag for pipeline review

---

## Answered Questions

1. **Editorial content seeding**: Do we manually write the first editorial column per persona, or generate from pipeline first? Decision: manual first to control quality, then replace with pipeline.

## Open Questions

2. **Chatbot fallback**: If RAG returns no relevant posts for a query, what does the chatbot say? Needs a graceful fallback response.
3. **"When do I open this" trigger**: The results interpreter (AMH/AFC benchmarking) is the highest-leverage answer to this question — when does it get built relative to the chatbot?
4. **Trust signal**: Should there be any explicit signal to users about where the community data comes from (Reddit, r/eggfreezing, r/IVF)? May increase trust but also may introduce questions about sourcing.
5. **Screen 3 unlock**: What behavioral threshold triggers offering the journey pathway builder? (e.g., 3+ return visits, chatbot engagement >5 messages)
