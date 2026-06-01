// Structured changelog data — mirrors CHANGELOG.md.
// Update both files together whenever a new entry is added.
// This file feeds the /release-notes.html page directly.

export const CHANGELOG = [
  {
    date: "June 1, 2026",
    title: "Corpus size updated to 10,000+ conversations",
    userSummary: "The app now correctly reflects how many real community conversations power the chatbot.",
    userBullets: [
      "Copy throughout the app updated from '2,000+' to '10,000+' conversations",
    ],
    buildersNote: `
      <p>The corpus grew well past 2,000 posts after expanding scraping across 7 subreddits with multiple sort orders. The copy just hadn't been updated to match. Fixed three instances in index.html — the bridge card, the chat dock header, and the expanded chat dock header.</p>
    `,
    blogUrl: null,
  },
  {
    date: "May 13, 2026",
    title: "The chatbot now finds better answers before it searches",
    userSummary: "Responses are more grounded in real community experience. Questions that used to return a fallback now pull relevant posts from women who've been through it.",
    userBullets: [
      "More questions get real community context instead of a generic fallback",
      "Answers feel less like keyword matching — the bot better understands what you're actually asking",
      "Retrieval improved from ~57% of questions finding good context to ~91%",
    ],
    buildersNote: `
      <p><strong>The core problem:</strong> Our corpus is Reddit posts — answers written by women who've been through it. Our queries are questions. In vector space, questions and answers live in different neighborhoods, so cosine similarity kept surfacing question-like posts ("has anyone else found injections painful?") over answer-like posts ("the injections weren't bad for me, just a small sting"). The retriever was finding the wrong posts not because they weren't there, but because it was searching in the wrong direction.</p>

      <p><strong>Why HyDE:</strong> HyDE (Hypothetical Document Embeddings) fixes this by generating a hypothetical Reddit-style answer post before embedding — then embedding that instead of the raw question. When a user asks "how much did this cost?", Haiku writes a 2-4 sentence Reddit post from a woman who's been through it, then we embed that. The resulting vector lands in answer space, where the actual community posts are. It's one extra Haiku call (~200ms) before the OpenAI embed.</p>

      <p><strong>Options considered:</strong> Reranking (cross-encoder second pass) was the other candidate. Reranking improves ordering within an already-retrieved set — useful when you're finding the right neighborhood but surfacing slightly wrong chunks. Our problem was more fundamental: we weren't finding the right neighborhood at all. HyDE fixes the root cause; reranking would have polished a broken signal.</p>

      <p><strong>Trade-offs:</strong> Each user message now makes one extra Haiku call before the embed, adding ~200-400ms of latency. Match count also increased from 8 to 20 chunks — more community context per response, at the cost of a larger system prompt (~4,000 more tokens per Sonnet call).</p>

      <p><strong>What to watch:</strong> Latency on first-response feel. If users notice the chat feeling slow, the HyDE call is the first thing to profile. Also worth watching: whether 20 chunks vs 8 changes response quality — more context can dilute as well as enrich.</p>
    `,
    blogUrl: null,
  },
  {
    date: "May 8, 2026",
    title: "Every chat question is now logged — and you can rate each response",
    userSummary: "Every question you ask the chatbot and every response it gives is now stored. You can also give a thumbs up or down on any response directly in the chat.",
    userBullets: [
      "Thumbs up/down appears under each bot response — tap to rate, add a comment if you want",
      "Your question and the bot's response are saved together so feedback is always in context",
      "Questions are tagged with which phase of the journey you're on when you ask them",
    ],
    buildersNote: `
      <p><strong>Why log the conversations:</strong> The chatbot is only as good as what it's being asked. Logging Q&amp;A to a <code>chat_messages</code> table gives us a real picture of what questions women are actually bringing — which will inform both content and RAG tuning. Each row captures the session, stage, milestone, question, response, and whether the user was on mobile.</p>

      <p><strong>The per-response feedback design:</strong> Editorial feedback (thumbs on milestone cards) was already wired. Chat feedback needed a different pattern — the feedback has to be tied to a specific exchange, not just a general "was this helpful?" The widget renders under each bot bubble after streaming finishes, captures the verdict and an optional comment, and logs to the same <code>feedback_events</code> table with <code>source: 'chatbot'</code> plus the exact question and response that was rated.</p>

      <p><strong>The milestone threading:</strong> The chat already knew the user's stage (<code>active</code>), but not which specific milestone they were viewing when they asked a question. Added a <code>setDockMilestone()</code> export to <code>chat.js</code> called from <code>renderMilestone()</code> in <code>app.js</code> — so now every logged message also carries the milestone (e.g. <code>re_consult</code>, <code>stim_start</code>). This matters for understanding whether questions cluster around specific phases.</p>

      <p><strong>Source tagging:</strong> Both editorial and chatbot feedback now land in the same <code>feedback_events</code> table, tagged <code>source: 'editorial'</code> or <code>source: 'chatbot'</code>. Keeping them in one table makes it easy to query all feedback at once; the source field makes it easy to separate them.</p>
    `,
    blogUrl: null,
  },
  {
    date: "May 8, 2026",
    title: "The app was broken and we didn't know it",
    userSummary: "The 'Try out WTF in Beta' button now actually works, and feedback you submit now lands in our database.",
    userBullets: [
      "CTA button on the homepage navigates correctly for the first time on the live site",
      "Thumbs up/down feedback on milestone sections is now stored and queryable",
      "The whole app's JS was silently failing on the live site — this fixes all of it",
    ],
    buildersNote: `
      <p><strong>The root cause was invisible:</strong> GitHub Actions was completing successfully on every push. GitHub Pages was serving the site. Both systems appeared healthy — they just weren't connected. Pages was configured to deploy from the <code>main</code> branch root (raw source files), not from the GitHub Actions artifact (the Vite-built <code>dist/</code>). The action was uploading the correct bundle, but Pages was ignoring it.</p>

      <p><strong>Why this was hard to catch:</strong> The site looked fine. HTML and CSS render without JS. The button was visible, styled correctly, and appeared interactive. But <code>import.meta.env</code> is a Vite-specific construct — browsers don't understand it natively. The raw <code>app.js</code> crashed on line 4, silently killing every event listener before any were attached. One console error, invisible to anyone not actively looking at DevTools.</p>

      <p><strong>The fix was a one-click settings change:</strong> GitHub repo → Settings → Pages → Source → switch from "Deploy from a branch" to "GitHub Actions." The architecture was always correct; just the wrong source setting.</p>

      <p><strong>The lesson:</strong> "Deploy succeeded" means the CI job completed — not that users can use the app. The only reliable signal is: does the actual user-facing action work? There was no smoke test for "does the CTA button navigate." Add one.</p>

      <p><strong>The feedback telemetry bug was separate:</strong> <code>SESSION_ID</code> was generated correctly but never sent in the POST body to Supabase. Supabase rejected inserts silently — HTTP 400 responses swallowed by a bare catch block. Fixed by adding <code>user_session_id: SESSION_ID</code> to the request. Now every thumbs up/down + comment lands in <code>feedback_events</code> with a session ID for grouping.</p>
    `,
    blogUrl: null,
  },
  {
    date: "May 7, 2026",
    title: "The chatbot was broken (and we built a test to find out)",
    userSummary: "The chatbot now actually uses real community data when answering questions. Before this fix, every response was a fallback — the app was never retrieving anything from the database.",
    userBullets: [
      "Chatbot answers are now grounded in real r/eggfreezing and r/IVF posts",
      "Responses should feel noticeably more specific and human than before",
      "A retrieval eval harness is now in place to measure and track answer quality over time",
    ],
    buildersNote: `
      <p><strong>The bug:</strong> The Edge Function was calling <code>match_posts</code> with the wrong parameter names — <code>filter_subreddit</code> and no <code>match_threshold</code> — while the actual database function expects <code>stage_filter</code> and <code>match_threshold</code>. PostgreSQL function overloading means if the parameter names don't match exactly, it simply doesn't find the function. Supabase returns a schema cache error. The Edge Function caught that error and silently served the fallback response every time. From the outside, the chatbot appeared to work. The answers just had no community grounding at all.</p>

      <p><strong>How we found it:</strong> Built a retrieval eval — a script that runs 23 real user queries through <code>match_posts</code>, scores each returned chunk via Claude Haiku (binary PASS/FAIL: does this chunk help answer the question?), and writes results to a timestamped CSV. The first run returned errors on all 23 queries. Reading the error message from the CSV revealed the parameter name mismatch immediately. The eval found a bug the app had been hiding for weeks.</p>

      <p><strong>The eval itself:</strong> Pass bar is 6/8 chunks relevant = PASS. First clean run: 2/23 queries passed (9%). That's the baseline. Retrieval quality needs work — separate problem from the bug fix, to be investigated next. Runs with <code>npm run eval</code>.</p>

      <p><strong>Watch out for:</strong> <code>match_threshold</code> is now 0.75 in the Edge Function. Too many "I don't have info on that" responses = threshold too strict. Vague or off-topic answers = too loose. The retrieval eval is the instrument for measuring this.</p>
    `,
    blogUrl: null,
  },
  {
    date: "May 4, 2026",
    title: "No more phone frame",
    userSummary: "The app now fills your actual screen — whether you're on your phone, tablet, or desktop browser. No more tiny cutout in the middle of the page.",
    userBullets: [
      "On mobile: the app uses your full screen, exactly like any native app would",
      "On desktop: content centers in a clean column — no phone-shaped box, no gray surround",
      "\"What's new →\" link now appears on all devices, not just desktop",
      "All content is reachable by scrolling — nothing is clipped or hidden off-screen",
    ],
    buildersNote: `
      <p><strong>The problem:</strong> The original UI wrapped everything in a <code>#phone</code> div — literally 375×790px with rounded corners, drop shadow, and a fake status bar showing "9:41" and a battery icon. The intent was to demonstrate the mobile-first design in a browser. The consequence was a broken product: fixed pixel dimensions clipped content, the footer lived outside the fake phone so it was invisible on real phones, and opening the app on an actual device meant seeing a phone-within-a-phone.</p>

      <p><strong>Mobile-first ≠ phone frame:</strong> Mobile-first means your CSS defaults to mobile layout and scales up via media queries. It does not mean render a phone shape. These are completely different things. The frame was a demo artifact that shipped into production.</p>

      <p><strong>The fix:</strong> Deleted the <code>#phone</code> wrapper, fake status bar, and 88 lines of CSS. Replaced with a proper <code>#app</code> flex column filling <code>100dvh</code>, centered at <code>max-width: 560px</code> on desktop, full-width on mobile. Moved the footer inside the app. Fixed S0 scroll so content doesn't clip on short screens.</p>

      <p><strong>What to watch:</strong> The 560px max-width is a reading-comfort choice, not a constraint. If you ever want a two-column layout on wider screens, that's the next lever to pull.</p>
    `,
    blogUrl: null,
  },
  {
    date: "May 4, 2026",
    title: "Real stories, finally",
    userSummary: "The milestone cards throughout the journey map now show real wisdom, quotes, and patterns from women who've actually been through egg freezing — not placeholder text.",
    userBullets: [
      "Journey milestone cards show real community quotes and observed patterns",
      "Each phase reflects what women at that exact stage said they wished they'd known",
      "Content is AI-synthesized from the r/eggfreezing and r/IVF communities",
    ],
    buildersNote: `
      <p><strong>The problem:</strong> The 10-phase journey milestones were built and live, but showing static placeholder content. I needed a pipeline to synthesize community insights and wire them to the UI.</p>

      <p><strong>The levers:</strong> Two parameters controlled quality — <em>match threshold</em> (how similar a post needs to be to qualify) and <em>match count</em> (how many posts to pull per milestone). In real-time chat, you optimize all three: relevance, latency, and cost simultaneously. This is a batch job — it runs once, not per user request. Latency and cost effectively drop out. The only thing worth optimizing for is accuracy of the synthesis.</p>

      <p><strong>The decision:</strong> <code>MATCH_THRESHOLD=0.65</code> (more permissive than the chat threshold of 0.75, to allow broader community context for synthesis) and <code>MATCH_COUNT=40</code>. Also built an ivfflat vector index on the posts table to keep similarity search fast as the dataset grows.</p>

      <p><strong>Watch out for:</strong> If milestone content starts feeling generic or off-topic as the post corpus grows, tighten the threshold back toward 0.70–0.75. The sweet spot moves with the data.</p>
    `,
    blogUrl: null,
  },
  {
    date: "April 29, 2026",
    title: "The full journey, in one view",
    userSummary: 'The app now shows you all 10 phases of the egg freezing journey before you start asking questions — from "Should I even do this?" all the way through "My results are in."',
    userBullets: [
      "10-phase journey map replaces the previous editorial article format",
      "Each phase is its own card: title, key questions women ask, and community wisdom",
      "The chatbot is still accessible at any point — the map gives you context first",
    ],
    buildersNote: `
      <p><strong>The pivot:</strong> The original editorial format was article-style — long, linear, easy to skim past. The goal was to surface the structure of the journey visually so users could orient themselves before asking questions. Two screens collapsed into a different UX pattern.</p>

      <p><strong>Where the phases came from:</strong> 10 phases defined by how women on Reddit actually describe their experience — not clinical stages, but emotional and logistical milestones. The names and sequencing came from reading hundreds of posts, not from a medical framework. That distinction matters for tone.</p>

      <p><strong>Supporting changes:</strong> Tightened the chatbot system prompt (cut filler, sharpened community-grounding instructions). Trimmed the feedback payload from a broad schema to just <code>verdict</code>, <code>optional_text</code>, <code>milestone</code>, and <code>section</code>.</p>

      <p><strong>Watch out for:</strong> The 10-phase structure is a hypothesis. If users consistently ask questions that don't map to any phase, the phases need rewriting — not more prompting.</p>
    `,
    blogUrl: null,
  },
  {
    date: "April 23, 2026",
    title: "A door worth opening",
    userSummary: "WTF now has a proper front door — a homepage that explains what you're about to use and why you should trust it, before asking you to do anything. Chat responses also render as proper lists instead of raw asterisks.",
    userBullets: [
      "New homepage: what WTF is, why it exists, what you'll learn — before any persona selection",
      "Chat now renders bullet and numbered lists cleanly instead of raw markdown symbols",
      "Smoother first impression overall",
    ],
    buildersNote: `
      <p><strong>The front door:</strong> Before this, the app opened directly to the persona selector — asking users to self-identify before they understood what the product was. S0 fixes that with a clear value prop and a single CTA.</p>

      <p><strong>The Google OAuth mistake:</strong> The first version of S0 had a Google sign-in button — added speculatively because "you'll probably want auth eventually." Removed it two days later. The friction wasn't justified, and it was solving a problem that doesn't exist yet. Classic premature feature. The lesson: build for the user you have, not the one you imagine you'll have.</p>

      <p><strong>Markdown rendering:</strong> The Anthropic API returns formatted responses with bullet lists, but the chat UI was rendering them as raw text. Added a lightweight markdown parser — handles bold, bullets, numbered lists, and line breaks. No external library; ~30 lines of JS. Minimal by design: if the chatbot starts using patterns that break it, it's cheaper to add a rule than to constrain the model.</p>
    `,
    blogUrl: null,
  },
  {
    date: "April 21, 2026",
    title: "It goes public",
    userSummary: "WTF is live at a real URL. The app is mobile-optimized and accessible from any phone without installing anything.",
    userBullets: [
      "Live at divyaspatel.github.io/WTFv2",
      "Optimized for mobile screens",
      "Chatbot connected to real community data",
    ],
    buildersNote: `
      <p><strong>The deployment constraint that improved the architecture:</strong> The plan was to embed API keys in the Vite bundle and deploy to GitHub Pages. GitHub's secret scanner blocked the push. That forced moving all API calls into a Supabase Edge Function — the client calls only the Edge Function, no secrets in the bundle, ever.</p>

      <p><strong>The upside:</strong> The Edge Function is the right architecture regardless. Stateless, runs at the edge, no backend server to maintain. Sometimes a blocker is pointing at a better path. Worth remembering.</p>

      <p><strong>First-deploy chaos:</strong> Multiple hotfixes — missing CORS headers on Edge Function errors, Supabase URL not picked up from env vars on GitHub Pages, broken favicon path. Each fix was a one-liner; the pain was deploy cycle time. This is normal. The lesson is to not rush the first deploy — give yourself a day for the long tail of environment-specific issues.</p>
    `,
    blogUrl: null,
  },
  {
    date: "April 21, 2026",
    title: "The community gets a voice",
    userSummary: "The chatbot now draws its answers from real Reddit posts by women who've been through egg freezing. Every answer is grounded in actual community experience, not a model's training data.",
    userBullets: [
      "Every chatbot answer is grounded in real r/eggfreezing and r/IVF posts",
      "Responses reflect actual patterns, not generic medical summaries",
      "The chatbot knows its limits: if the community hasn't discussed something, it says so",
    ],
    buildersNote: `
      <p><strong>The core differentiator, live:</strong> Retrieval-Augmented Generation — embed the user's query, find the most similar community posts via cosine similarity, inject those posts as context before the model generates a response. This is the whole product's reason for existing.</p>

      <p><strong>Why OpenAI for embeddings, not Anthropic:</strong> Anthropic doesn't offer a standalone embedding API. <code>text-embedding-ada-002</code> (1536 dimensions) is the established standard for pgvector deployments. Two different providers is fine — the embedding model and the generation model don't need to be from the same company.</p>

      <p><strong>The model split:</strong> Haiku for query augmentation (fast, cheap, just rewrites the query), Sonnet for the main chat response (quality matters here). Using the right model for the right job reduces cost without sacrificing output quality where it counts.</p>

      <p><strong>The threshold is everything:</strong> <code>match_threshold=0.75</code> for chat. Too high and the chatbot falls back to "I don't have that" constantly. Too low and responses drift toward hallucination. Monitor fallback rate as a proxy for whether the threshold needs adjustment.</p>
    `,
    blogUrl: null,
  },
  {
    date: "April 21, 2026",
    title: "The first draft",
    userSummary: "WTF exists. You can pick your journey stage, read editorial content tailored to that stage, and see the chatbot interface — though the chat wasn't yet connected to anything real.",
    userBullets: [
      "Three-persona selector: Considering, Active, In-process",
      "Editorial column: answers common questions at each stage with zero user input",
      "Chat interface visible — static, not yet connected to community data",
    ],
    buildersNote: `
      <p><strong>The foundational product decision:</strong> The chatbot is never the entry point. Editorial leads. Users read community-grounded content before they can ask questions. This was deliberate — people need to trust the source before they act on its answers. Reversing this order would produce a worse product even if the chatbot were perfect.</p>

      <p><strong>Why no framework:</strong> Vite + vanilla JS. No React, no Vue. The app has four screens and minimal state — a framework adds build complexity and bundle size for no gain. This gets second-guessed regularly, but it's held up. Simpler is faster to ship.</p>

      <p><strong>The persona model:</strong> Three stages (<code>considering</code>, <code>active</code>, <code>in_process</code>) map to meaningfully different user needs. The same question has a different best answer depending on where you are in the journey. Stage-awareness is baked in from day one, even though only "active" is live.</p>

      <p><strong>Watch out for:</strong> "Considering" and "In-process" are marked coming soon. The three-card selector only pays off if those stages are eventually built. If they're never built, it's wasted real estate.</p>
    `,
    blogUrl: null,
  },
];
