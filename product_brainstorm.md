# WTF (What the Fertility) — Product Brainstorm
Last Updated: April 2026

---

## The Question
**Build a product that helps women in their fertility preservation journey.**

---

## Constraints & Scope
- US only
- Web-based (responsive, not native mobile app)
- Solo founder, iterative build

---

## User Groups

| User Group | Notes |
|---|---|
| Women who've never started fertility preservation | ✅ **Chosen** |
| Women who've done preservation and are considering IVF | Post-preservation, different set of anxieties |
| Women with infertility / endo / PCOS diagnosis | High urgency, medical framing needed |
| Women considering going abroad for treatment | Cost arbitrage, trust in foreign clinics |
| Women who just got a concerning lab result (low AMH, high FSH) | In shock/research mode; distinct from "never done it" — high urgency |
| Partners trying to understand the process | Supportive role, secondary audience |
| Women who started and had a cycle cancelled or got poor outcomes | Re-entry guidance, emotionally fragile |
| Women navigating employer fertility benefits (Progyny, Carrot, WIN) | Practical — don't know how to use what they have |

**Decision: Solve for women who've never completed the fertility preservation process.**

---

## Pain Points (for chosen user group)

| Pain Point | Notes |
|---|---|
| How to pick the best clinic | |
| Financial support / insurance navigation | |
| Optimizing decision-making | |
| What to ask the doctor at each appointment | Pre-appointment prep |
| Tracking their journey | |
| Advice and guidance navigating the experience | ✅ **Chosen** |
| "Science maxxing" — understanding the data behind decisions | |
| Biohacking for fertility | |
| Emotional regulation — it's isolating, anxiety-inducing between appointments | |
| Knowing what's normal vs. what warrants a clinic call | Symptoms, responses, feelings |
| Understanding lab results in plain language | AMH, AFC, FSH decoded |
| Benchmarking — "is my situation typical or unusual?" | Core differentiator: community data |
| Knowing when to change clinics / get a second opinion | |

**Decision: Solve for advice and guidance navigating the experience and journey.**

---

## Solutions

| Solution | Notes |
|---|---|
| Personalized, localized, updating pathway for the journey | |
| Recommendation engine (clinics, supplements, etc.) | |
| Q&A of experiences | Reddit already exists — differentiation needed |
| Scientific calculator for optimizing decisions | |
| Clinic picker (insurance, finances, location) | |
| Ask an expert — medically sound advice from fertility professionals | |
| Fertility experience tracker — data-driven approach | |
| "Normal-ometer" — instant benchmarking against community data | "X% of women with AMH like yours did Y rounds" |
| Pre-appointment prep sheet generator | Questions to ask based on stage |
| Results interpreter — decode AFC/AMH/retrieval numbers in context | High trigger value: she got her results and is confused |
| Community signal feed — what are women at your exact stage asking right now | |
| Editorial advice column grounded in community data | ✅ **Chosen** |

**Decision: Build an editorial-magazine-style advice column that surfaces guidance from women who've navigated this journey, grounded in real Reddit community data.**

---

## User Research Signals

- Users do not want to give personal information in the first several uses
- Trust takes time and repeated engagement with the tool
- Tool needs a clear answer to: **"what's the point / when do I open this"**

**Strategic implications:**
- Show value ASAP with minimal input from user
- More usage = better, more personalized experience (earn the right to ask)
- The chatbot must be grounded in community data to be differentiated — raw Claude is not enough

---

## Success Metrics

### Vanity / Lag (track but don't optimize for)
- DAU
- CSAT / evals

### Leading Indicators (what actually matters)
| Metric | What It Measures |
|---|---|
| Return within 7 days without a prompt | "When do I open this" answered behaviorally |
| Depth of first session | Do they engage with chatbot or just read and leave? |
| Unprompted second persona exploration | Do they come back at a different stage? |
| Profile completion rate over time | Proxy for trust building — giving more because they're getting more |
| Chatbot messages per session | Engagement with the core RAG-powered experience |
| % of sessions that reach Screen 2 → chatbot | Funnel conversion from passive to active engagement |
