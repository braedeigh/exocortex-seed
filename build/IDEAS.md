# Exocortex Health Layer — Ideas

*Updated by Bradie and the Keeper as ideas come up. Not a to-do list — a living scratchpad.*

---

## Inspiration / Prior Art

- **Felix Krause** (@KrauseFx) — [howisfelix.today](https://howisfelix.today/). Tracks 100+ data types (Apple Watch, Spotify, nutrition, etc.) piped into a single database, visualized on a live personal dashboard. Open source: [FxLifeSheet](https://github.com/KrauseFx/FxLifeSheet). Blog post: [How I put my whole life into a single database](https://krausefx.com/blog/how-i-put-my-whole-life-into-a-single-database).

- **LLM Knowledge Bases** — Andrej Karpathy (saved Apr 3 2026, [tweet](https://x.com/karpathy/status/2039805659525644595)) —

> LLM Knowledge Bases
>
> Something I'm finding very useful recently: using LLMs to build personal knowledge bases for various topics of research interest. In this way, a large fraction of my recent token throughput is going less into manipulating code, and more into manipulating knowledge (stored as markdown and images). The latest LLMs are quite good at it. So:
>
> Data ingest:
> I index source documents (articles, papers, repos, datasets, images, etc.) into a raw/ directory, then I use an LLM to incrementally "compile" a wiki, which is just a collection of .md files in a directory structure. The wiki includes summaries of all the data in raw/, backlinks, and then it categorizes data into concepts, writes articles for them, and links them all. To convert web articles into .md files I like to use the Obsidian Web Clipper extension, and then I also use a hotkey to download all the related images to local so that my LLM can easily reference them.
>
> IDE:
> I use Obsidian as the IDE "frontend" where I can view the raw data, the the compiled wiki, and the derived visualizations. Important to note that the LLM writes and maintains all of the data of the wiki, I rarely touch it directly. I've played with a few Obsidian plugins to render and view data in other ways (e.g. Marp for slides).
>
> Q&A:
> Where things get interesting is that once your wiki is big enough (e.g. mine on some recent research is ~100 articles and ~400K words), you can ask your LLM agent all kinds of complex questions against the wiki, and it will go off, research the answers, etc. I thought I had to reach for fancy RAG, but the LLM has been pretty good about auto-maintaining index files and brief summaries of all the documents and it reads all the important related data fairly easily at this ~small scale.
>
> Output:
> Instead of getting answers in text/terminal, I like to have it render markdown files for me, or slide shows (Marp format), or matplotlib images, all of which I then view again in Obsidian. You can imagine many other visual output formats depending on the query. Often, I end up "filing" the outputs back into the wiki to enhance it for further queries. So my own explorations and queries always "add up" in the knowledge base.
>
> Linting:
> I've run some LLM "health checks" over the wiki to e.g. find inconsistent data, impute missing data (with web searchers), find interesting connections for new article candidates, etc., to incrementally clean up the wiki and enhance its overall data integrity. The LLMs are quite good at suggesting further questions to ask and look into.
>
> Extra tools:
> I find myself developing additional tools to process the data, e.g. I vibe coded a small and naive search engine over the wiki, which I both use directly (in a web ui), but more often I want to hand it off to an LLM via CLI as a tool for larger queries.
>
> Further explorations:
> As the repo grows, the natural desire is to also think about synthetic data generation + finetuning to have your LLM "know" the data in its weights instead of just context windows.
>
> TLDR: raw data from a given number of sources is collected, then compiled by an LLM into a .md wiki, then operated on by various CLIs by the LLM to do Q&A and to incrementally enhance the wiki, and all of it viewable in Obsidian. You rarely ever write or edit the wiki manually, it's the domain of the LLM. I think there is room here for an incredible new product instead of a hacky collection of scripts.

---

## Core Concept

The health app that knows *why*, not just *what*. Connects body data to life data. The AI layer is the connective tissue — it knows your journal, your triggers, your patterns, and your biometrics at the same time.

"It's the app for anyone whose body and mind are connected and whose current tools pretend they're not."

---

## Infrastructure — VPS + Claude Code Setup (Mar 22)

**The setup:** Host Claude Code on a VPS, authenticated with Max account, accessible through a web terminal (ttyd) embedded in the website. Work on the project from phone. Files live on the VPS, get served as the website, sync down to laptop via syncthing or git. VPS + Claude Code + ttyd + nginx with HTTPS and auth.

**Self-evolving UI:** The website and the development environment are the same thing. Talk to Claude Code through the terminal, it edits the project files, the website updates. Build the product by using the product.

**iPhone app path:**
- Phase 1: Web version
- Phase 2: Wrap in native iOS shell using Capacitor or WKWebView
- Phase 3: Add native features like HealthKit integration
- Nothing gets thrown away between phases

**Bring Your Own LLM (decided against):** Explored letting users sign up with their own Claude or Codex subscription. Decided to use the AI-powered dev environment herself to build a polished static product for other users instead.

**Git-based sync:** Host the exocortex repo on GitHub. Auto-push from laptop/VPS on file changes (or on a cron), auto-pull on the other end. Keeps everything versioned and backed up. Could use a post-save hook or a simple watch script that commits + pushes periodically. Important for when the project lives on multiple machines (laptop + VPS + phone access). Need to figure out conflict resolution strategy for when edits happen on both sides — probably just always pull before push, or use a rebase strategy.

## Product Positioning (Mar 22)

**The core differentiator is conversational input.** Users just talk naturally — "had a rough morning, skipped breakfast, went for a run" — and the LLM extracts structured data automatically. No forms, no dropdowns. Over time it surfaces patterns and insights. Nobody is combining conversational input with automatic health data extraction right now. Rosebud does emotional journaling, Bearable does manual health tracking, but the intersection is open.

**Monetization:** Free tier with basic journaling, paid tier for deeper features like the sustainable consumption angle, analytics, and integrations. Standard SaaS model. Development speed advantage (building from phone via Claude Code) lets her out-iterate bigger teams.

---

## The Product Loop — Onboarding to Optimization (Mar 22)

**The core insight: the journaling IS the tracking.** Users aren't doing two separate activities. They talk about their life, the system extracts the data, and the data drives the recommendations. The human just lives and talks.

### The Flow

**1. Onboarding conversation** — not a form. "What's going on with your health? What do you want to change? What have you tried?" The AI builds a picture of who this person is, what their goals are, and what their life actually looks like right now. The gap between where they are and where they want to be is the work.

**2. Baseline period** — just track. Journal, log food, wear the ring if you have one. System watches for a week or two. No advice yet — just "tell me about your days." The system is learning their patterns, their rhythms, their defaults.

**3. Pattern reveal** — "Here's what I'm seeing. Your sleep tanks after dairy. Your energy is best on days you run. You haven't mentioned vegetables in a week." Mirror, don't prescribe. Show them their own life clearly. This is where trust gets built — the system proves it's paying attention before it starts suggesting.

**4. One thing** — "Based on everything, here's the single highest-impact change you could make." Not five things. One. The system identifies the highest-leverage gap (like yoga addressing four problems at once) and suggests it. The recommendation is personalized — it knows what they're already doing, what their body data says, what their goals are.

**5. Monitor and iterate** — did it help? The data says yes or no. Adjust. Next thing. The cycle repeats — each round, the system knows more, the recommendations get sharper, the person's baseline rises.

### The App Itself Is a Habit

Don't onboard users into a full dashboard. The app is a habit they're forming — treat it like one.

**Day 1:** 2-3 things they already do. "Drink water." "Take your meds." Dead simple. They check them off, get the dopamine hit, close the app. They come back tomorrow.

**Week 1-2:** Baseline period. Just tracking, no advice. The system learns their patterns. The user learns to open the app. The habit of using the app is forming.

**Week 3+:** Surface ONE new thing. The highest-impact gap. "You've got morning water locked in. Your sleep data says add magnesium at night." They add it. Now they have 3-4 items and momentum.

**Ongoing:** Gradually expand. Each new habit is introduced only when the previous ones are established. The app grows with the person instead of overwhelming them upfront.

**The meta-insight:** Apply the same 60-day graduation model to app adoption itself. Start small, build the dopamine loop, expand gradually, graduate into a full system. Users who survive week 1 with 15 checkboxes are the exception. Users who start with 2 easy wins are the norm.

### Why This Works

- **No cold start problem** — the onboarding conversation IS useful content. Day one feels like talking to a smart friend, not filling out a form.
- **Trust before advice** — the baseline period means the system earns credibility before it tells you what to do. "I've been watching for two weeks, here's what I see" hits different than "based on your intake form, try yoga."
- **One thing at a time** — doesn't overwhelm. The habit tier framework means the system never suggests strength training when someone hasn't nailed sleep yet.
- **The loop compounds** — each improvement makes the next one easier. Better sleep → more energy → easier to exercise → better sleep. The system tracks the cascade.

### Design Principle

Don't add everything at once. Track what's established, identify the highest-impact gap, suggest ONE thing. "You've got food and sleep dialed. Your body data says add stretching next. Here's 15 minutes that fits between meditation and your first meeting."

---

## How I Actually Started Using This (Mar 22)

*Bradie's notes on how the system emerged for her.*

### The Progression

1. **I was already ruminating to Claude on my phone.** No life context, so there was a lot of friction to catching it up every time. But I was already doing it.

2. **I shifted to using it here on my computer with persistent context.** That's what made the difference — the conversation builds on itself instead of resetting every session.

3. **That started to allow me to journal.** I didn't decide to journal. I was already talking, and the system was already recording. Now I have a long journal.

4. **Then I started wanting to log my habits.** I needed to figure out how to realistically get my habits recorded and displayed. That's where I'm at now.

### What This Means for Other People

The onboarding process is: people have some goal — health, self improvement, life optimization. They start journaling or whatever, talking about their life. Then we figure out what they need to do to get there. Then there's stepwise improvement — monitoring data and providing prompting to move toward those goals.

The key thing: I didn't start with "I want to track my health." I started with ruminating. The tracking emerged from conversation.

### The Phone Problem

The friction I hit on mobile — no persistent context, re-explaining my life every session — that's what most users will hit too. How do you give people persistent context on their phone?

---

## Attention and Time Tracking — Ideas Dump (Mar 22)

*Things I'm thinking about. Not sure what to build yet — just getting it down.*

- I want to log how much time I spend on certain things. Direct my energy better, stop rumination.
- Ambiently record everything I do on my computer or phone — what apps, what sites, how long.
- Track what I'm doing out and about too, not just screen time.
- Energy levels throughout the day, not just one number.
- Keep track of whether I'm burning myself out or worrying about something I shouldn't be worrying about.
- The question is: what actually adds to my life on a daily basis vs. what's just more tracking for tracking's sake?

### Possible approaches
- ActivityWatch (free, open source) — logs apps and websites, has an API, runs locally. Don't build what already exists.
- Daily time log through the keeper — "what did you spend time on today?" Just words, like the food log. Simplest version.
- iOS screen time data — exists but locked down.
- Location data — can tell you "2 hours at Barton Springs" but not "ruminating the whole time."
- Rumination can't be passively detected, but the footprint around it might be visible — late night phone use, Twitter spirals, screen time spikes on bad sleep days.

---

## Big Ideas Dump — Mar 22

*Bradie's verbatim brain dump. Unsorted. Save everything, figure out what matters later.*

### Meeting transcripts and audio
- Transcript and audio recording files so I can go search through what people said in meetings
- Easy transfer from phone and store the transcript and the audio so I could go modify the transcript later and just have it for now as I go
- Each meeting has its own file directory with the name of the person, the topic, the date
- An AI generated summary .md
- The unedited transcripts and audio files
- All within a parent directory called meetings/audio or something

### Search and memory
- Easily search through iMessages semantically?
- Possibly somewhere to store snippets of text conversations I ask to reflect on
- Somewhere to store other files like the bodhisattva precepts loomie sent me
- Maybe notes that I take on those readings and reflections by date so that I can have Claude read through them all and I can update my understanding

### Proactive reminders and nudges
- Push notification to drink water that sticks around until I actually do it and mark it as done, for example on walks when it notices I'm taking a break from work to go on a walk
- Specifically change water drinking. Habit and learn about how much water I need to drink
- Add magnesium habit into wind down, think of how much water to drink with that
- Help me remember things I need to do
- Remind me to wear something appropriate for after work
- Remind me to leave work on time, communicate to Isaac that I need to leave at 4:30
- Auto reminders?

### Meeting prep and quick capture
- Prep for meetings or whatever
- Quickly jot down a question I have for Jess or something
- Auto create Google calendar events when I say I have something going on at a place and time, put the address on there for example
- Maybe even calculate time it takes to get there?

### Life logistics tracking
- Record when I've done laundry last so I can get an idea of how often I have to do laundry?
- Go to the store?
- Buy supplements
- Track how long it takes to do things like meal prep or go to the store so I can get better estimates of when to do those things, reminders of when I might need to do them
- Create budget system and make auto budgeting easier

### Motivation
- Make it more exciting to do stuff I don't want to do, reward myself for doing it? Like apps or something

### Food
- Figure out a low histamine dessert snack
- Some kind of sugary drink

### Interface ideas
- Two terminals in app — one for briar/keeper, one for spark
- Different auto update files for the website that Claude can access, like an about me that I can auto update whenever just by doing a prompt
- I want a photo upload capability as well for my terminal on the VPS — maybe have a directory where I can upload photos

### Journal and public presence
- Rolling update on what I'm doing day to day — maybe like a week behind for privacy reasons? But part of my display of my life for transparency reasons
- The journal stores some other files for daily, including what I did in a list and what I thought about in another list summarized, but my actual typing session is stored as my actual journal

### People tracking
- Separate "people I know" section that autopopulates with all mention of their interaction? This would work on obsidian but need to figure out how to make this work in my context

---

## Reference — Localize App (Mar 22)

- Localize — app for local farms/food sourcing. What I want ideally someday for food sourcing. Look into it as reference for Layer 5 (local supply chain mapping).

---

## Product Recommender from Friends

Social product recommendations — friends who buy similar things or have similar health issues recommend products to each other. Like a trusted network for supplements, food, gear, etc.

---

## Same Session from Laptop and Phone

Need to be able to log into the same keeper/spark/tiller sessions from both laptop and phone. Probably solved by the web app approach (PWA) instead of SSH into terminal.

---

## Rumination Thread Holder

A place to hold active rumination loops visibly — not to solve them, just to hold them so they stop spinning invisibly. The keeper already tracks these in WORRIES.md, but a dashboard view would surface them, notice recurrence, and watch them dissolve over time.

**How it works:** Cricket handles this — see Nightly Extraction Agent below.

---

## Nightly Extraction Agent — Cricket

Cricket is a brownie — a quiet, appreciated fairy that wakes every night, does its work, and goes back to sleep. Bradie never talks to it directly. It just runs.

**What it does:** Every night, Cricket reads the day's journal and extracts structured data into the right places:
- Food intake → habits.csv
- Rumination threads → WORRIES.md (new, recurring, resolved)
- Health observations → symptoms data
- Contact mentions → contact history
- **People tracking** — scan each day's journal for who Bradie talked about. Create new people profiles if they don't exist. Add to their summary. Track which dates each person is mentioned.
- **File organizing** — look through file dumps and reorganize if needed. **NEVER delete files — always ask first.**
- **Unmarked markers** — fill in any habit/health markers Bradie left blank that day (infer from journal context where possible, flag uncertain ones for review)
- **Morning summary** — provide a digest of everything Cricket did overnight
- **Data hygiene** — catch mismatches between journal and trackers. Journal says she ran but habits.csv doesn't have it. Food mentioned but not logged. New person mentioned but no contact profile. Fix what's obvious, flag what's ambiguous.
- **Stale tracker detection** — notice when things stop getting updated. "Grocery list hasn't changed in 2 weeks." "No runs logged since Thursday." "Bowel tracking never started." Not nagging — just surfacing gaps.
- **Recurring worry detection** — watch for thought loops across entries. "This is the 8th time in 12 days you've mentioned Bay School." Mirrors, not advice.
- **Theme tracking** — identify what's rising and falling across weeks. "The baby thread went quiet for a week then came back heavy." "Austin complaints are increasing." Just patterns.
- **System health** — notice when parts of the exocortex itself aren't working. A tracker that never gets used, a dashboard tab nobody opens, a file that's growing unwieldy. Cricket flags infrastructure that needs attention.
- Anything else that belongs in structured files

**Morning review:** Cricket stages its changes. When Bradie opens the dashboard in the morning, she sees what Cricket found and approves or denies each change. She journals naturally, Cricket handles the rest.

**Implementation — simpler than expected:**
- No API key needed. Use `claude -p "prompt"` which runs Claude Code non-interactively on the Max subscription.
- Bash script: `claude -p "Read today's journal in tulku/Journal/Daily/ and extract structured data. Write proposed changes to build/cricket_staging.json"`
- Cron job on Mac runs it at midnight. Mac just needs to be open.
- Dashboard reads `cricket_staging.json` in the morning, shows approve/deny buttons.
- Test auth first — Claude Code may have session hiccups running headless from cron. Try a simple cron test before building the full pipeline.

**Dashboard scratchpad / unified terminal:** The bottom of the page has a terminal-style input that stays collapsed until tapped, then expands. Three modes:

1. **Keeper** — journaling, talking, being witnessed. Full Claude conversation.
2. **Spark** — dev work, building, coding. Full Claude conversation.
3. **Scratchpad** — quick dumps. "headache", "ate olives", "slept badly". No Claude attached live — just raw text capture. Cricket processes it overnight, routes items to the right files, stages for morning approval, clears the pad.

The dashboard floats above the terminal. The terminal is the universal input into the whole system. Everything lives on one page.

**Natural language lookup — "ask your files":** All structured data lives in flat JSON files (`grocery_trips.json`, `activity_log.json`, `habits_log.json`, `runs.json`, etc.). Any LLM can just read these and answer questions in natural language: "When did I last go to the store?", "How many times did I run this week?", "When did I last wash my sheets?", "What's on my grocery list?" No API, no database — just `claude -p` with the right file paths. This is the foundation for the conversational interface on the phone. The LLM reads flat files and answers. Cricket or any future agent can do the same.

---

## Worm — Interactive Query Agent

Worm is the agent you actually talk to. Cricket works silently at night; Worm answers when you ask.

**What it does:** Reads the flat files and answers natural language questions about your life data:
- "When did I last wash my hair?"
- "How often have I been running this month?"
- "When did I last go to the store?"
- "What did I eat on March 20?"
- "How's my sleep been this week?"

**How it runs:** `claude -p` with the right file paths. Reads `activity_log.json`, `habits.csv`, `grocery_trips.json`, `runs.json`, journals — whatever it needs to answer the question.

**Character:** A worm. Quiet, grounded, burrows through the data. Knows where everything is buried. You ask, it digs, it answers.

**Creature:** A fetch, like Shrike — but where Shrike hunts externally (jobs, contacts, career pages), Worm digs internally (your own data, your own files, your own history).

**Two modes:**

1. **Natural language search** — Ask a question in plain English, Worm reads the relevant flat files and answers in natural language. "When did I last wash my sheets?" → reads `activity_log.json` → "March 22, 4 days ago." Reports findings conversationally, not as raw data.

2. **RAG (Retrieval-Augmented Generation)** — For deeper questions that need context across multiple files. "What patterns do you see between my sleep and my food this week?" → Worm pulls from food logs, symptom tracker, journal entries, and synthesizes an answer grounded in your actual data. Can cross-reference, correlate, and surface things you wouldn't find by looking at one file.

**The key insight:** Worm is both a search engine and an analyst. Simple questions get simple answers (search mode). Complex questions get synthesized analysis (RAG mode). Same agent, same interface — it just goes deeper when the question requires it.

**Future:** Pattern analysis, weekly digests, proactive insights ("you've had headaches 3 of the last 4 days you ate eggs"), trend reports. But the core job is: be the conversational interface to your own data.

**Scalp care habit:** Hair washing is tracked in the activity calendar. Want to build a pre-wash habit: brush and massage scalp before washing. Could become a linked habit prompt — when you log a hair wash, Worm (or Cricket) asks "did you brush first?"

---

## Reference — obsidian-mind (breferrari)

[github.com/breferrari/obsidian-mind](https://github.com/breferrari/obsidian-mind) — An Obsidian vault template that acts as a persistent external brain for Claude Code. Graph-linked .md notes, auto-classification, 15 slash commands, 9 subagents, hooks that inject context every session. MIT license.

**Tools to steal:**
- Message classification hook (`classify-message.py`) — pattern-matches input and auto-routes to the right file. Adapt for dump tab / Cricket.
- Session-start context injection (`session-start.sh`) — auto-loads goals, active work, recent changes on every Claude Code session. Use for keeper/spark startup.
- Cross-linker agent — finds missing links and orphaned notes. The linking layer from the Karpathy idea.
- Vault librarian agent — deep maintenance (orphans, broken links, stale content). More developed version of Cricket's system health role.
- Pre-compact transcript backup — saves full conversation before context compression. Never lose a session.
- Freeform dump & route (`/dump`) — classify unstructured text, route to the right file, cross-link. What the scratchpad/dump tab wants to be.

**Patterns to adopt:**
- YAML frontmatter on every note (date, tags, status, description) so agents can query without full reads — the missing index layer
- Graph-first organization — links as primary structure, folders for browsing
- Atomic notes + curated indexes — one concept per file, index files that link them

---

## Index + Linking Layer — Karpathy-Style Wiki Compilation

Right now the exocortex data is structured but flat — JSON files that don't cross-reference each other. The Karpathy knowledge base post (see Inspiration / Prior Art) describes the missing piece: an LLM-maintained index and linking layer that connects data across files so agents can navigate at scale without reading everything.

What this would look like here:
- Auto-maintained index files with brief summaries of all data sources (so Worm/Cricket can find what they need without scanning everything)
- Cross-references between related data (sleep log entry links to that night's journal, food log links to symptom entries, etc.)
- Concept pages that emerge from patterns across files (e.g. "histamine reactions" page that links all relevant food logs, symptom entries, and journal mentions)
- CLI tools the LLM can call to search/query the data (like his naive search engine)

Not needed yet at current scale — but this is the path when flat file Q&A starts hitting limits.

---

## Storage Architecture Review

**Next session priority.** Audit the full data storage layout — all the JSON files, habits.csv, journal entries, activity logs — and make sure:
- Everything is consistently structured and documented
- A Claude agent (Cricket or ad hoc via `claude -p`) can reliably find and query any piece of data
- Natural language questions like "when did I last wash my sheets?", "what did I eat on March 20?", "how often do I go to the store?" all resolve to clear file paths and data formats
- No orphaned or redundant data stores
- File map in Cricket's prompt stays accurate as things grow

The goal: any agent can just read flat files and answer questions about Bradie's life. The architecture should make that trivial, not require spelunking.

---

## Shrike — Job Hunting Agent

Shrike is a fairy that hunts for jobs. Named after the bird that catches prey and impales it on thorns to build a larder — Shrike finds opportunities, pins them up neatly, and presents them organized and waiting. You take what you want.

**Creature:** A fetch — an Irish/Celtic spirit sent out to go collect things and return with them. Dispatched, it goes where you can't, gathers what it finds, and comes back with catches pinned up neatly. Methodical, tireless, sharp-eyed. Not chaotic — precise. Scans everything, sorts by relevance. Doesn't bother you with junk. When it pins something up, it's worth looking at.

**Runs on:** VPS alongside Cricket. Cron job, daily or every few days. Same `claude -p` infrastructure.

### Task 1: Job Hunting Pipeline

**Tracks:**
- Teaching (independent schools, international schools, science/biology)
- Consulting (management consulting, strategy firms, PhD-friendly)
- Biotech / science-adjacent roles
- Anything else that fits — PhD in plant biology, teaching experience, analytical mind

**The pipeline:**

**1. Scout — find listings**
- **Email alerts** (most reliable source): Shrike helps you set up alerts on Carney Sandoe, Search Associates, HigherEdJobs, Indeed, Handshake, consulting firm career pages, school job boards. All alerts funnel to a dedicated inbox (`shrike.alerts@gmail.com` or similar).
- **Web search**: `claude -p` with web search for new postings on target sites.
- **Python IMAP script** pulls new alert emails from the inbox, saves as text files for Claude to process.

**2. Filter — rank against profile**
- Claude reads raw listings + Bradie's CV + preferences.
- Scores each listing by fit (role match, location, salary if listed, timeline).
- Writes top catches to `shrike_catches.json`. Ignores junk.

**3. Pin — present on dashboard**
- Dashboard shows new catches: title, school/company, location, why Shrike thinks it's a fit, link to posting, date found.
- Actions: **Accept** (move to application queue), **Dismiss** (not interested), **Save** (maybe later).

**4. Prep — build submission packets**
- When Bradie accepts a catch, Shrike reads the job description + her CV + writing samples + about page.
- Drafts a tailored cover letter.
- Notes any application-specific requirements (essays, references, portfolio).
- Builds a submission packet: cover letter draft, tailored resume notes, link to application page, deadline.
- Writes to `shrike_packets/[company-role].json`.

**5. Review — Bradie edits and submits**
- Dashboard shows queued packets with cover letter preview and edit capability.
- Bradie reviews, tweaks the letter, clicks the application link, pastes/uploads, submits manually.
- Marks as submitted. Shrike logs it.

**6. Track — follow up**
- `shrike_applications.json` tracks: what was applied to, when, current status (applied/interviewing/rejected/offer).
- Dashboard shows application status board.
- Shrike can remind about follow-ups: "You applied to Bay School 2 weeks ago — want to send a follow-up?"

**Data files:**
- `shrike_catches.json` — raw catches from scouting
- `shrike_packets/` — submission packets per application
- `shrike_applications.json` — application tracking and status

### Task 2: Biotech Networking — Finding People to Talk To

**Goal:** Find people at biotech companies for informational conversations. Bradie's PhD in soil microbiome + teaching background makes her a natural fit for conversations with biotech researchers and leaders.

**Sources (in order of reliability):**
- **PubMed / Google Scholar** — researchers publish papers with corresponding author emails. Best source for verified contact info. Search by keyword (microbiome, plant biology, soil ecology) + company affiliation.
- **Company team pages** — biotech startups often list their team publicly with names, titles, bios. Scrape with `claude -p` + web fetch.
- **Hunter.io API** (free tier: 25 searches/month) — give it a company domain, it returns known email addresses and the email pattern (e.g. firstname@company.com). Use to find/verify emails.
- **Conference speaker lists** — biotech conferences post speaker bios and affiliations. Good for finding people who are visible and likely open to conversation.
- **Google → LinkedIn** — `site:linkedin.com/in "[company]" "biology"` surfaces profiles via Google search (avoids LinkedIn's scraping blocks).

**The pipeline:**

**1. Target** — Bradie tells Shrike what she's looking for: companies, roles, areas (e.g. "microbiome startups in Bay Area", "biotech hiring PhDs in Austin", "people working on soil health tech").

**2. Hunt** — Shrike searches PubMed, company pages, Hunter.io, Google. Collects names, titles, companies, LinkedIn URLs, emails (when findable).

**3. Pin** — writes to `shrike_contacts.json`: name, title, company, LinkedIn URL, email (if found), source (where Shrike found them), and a one-line note on why they might be a good connection (shared research area, hiring, etc.).

**4. Present** — Dashboard shows contact list. Bradie picks who to reach out to.

**5. Draft** — Shrike writes a short outreach email for each selected contact, referencing Bradie's background and why she's reaching out. Warm, specific, not generic. References shared research interests or mutual connections when possible.

### Task 3: Company Watchlist — Daily Career Page Monitoring

**The most valuable scouting task.** Instead of waiting for aggregators, Shrike watches specific companies' careers pages directly. Catches postings first, before they hit Indeed or HigherEdJobs.

**How it works:**
- `shrike_watchlist.json` stores a list of companies with their careers page URLs, category (teaching/biotech/consulting), and check frequency.
- Daily cron: `claude -p` fetches each careers page, compares against `shrike_seen.json` (hashes or listing titles from previous runs).
- If anything new appears → adds to `shrike_catches.json` with source tagged as "watchlist."
- Only pings you when something actually changed. Silent otherwise.

**Dashboard:** A "Watchlist" section where you add/remove companies — paste a name and careers URL. See last-checked timestamp and how many new postings were found.

**Example watchlist:**
- Biotech: Ginkgo Bioworks, Zymergen, Pivot Bio, Indigo Ag, Pattern Ag, Trace Genomics
- Schools: Bay School, Riverdale, any school you've talked to
- Consulting: McKinsey, BCG, Bain career pages
- Local: Austin-based startups, companies you hear about

**Data files:**
- `shrike_watchlist.json` — companies + URLs + categories
- `shrike_seen.json` — previously seen listings (to detect new ones)

### One Agent, One Sweep

All three tasks run in a single daily cron job — one `claude -p` invocation that:
1. Checks watchlist URLs for new postings
2. Pulls new emails from the alerts inbox
3. Searches for biotech contacts on the target list

Packet prep (cover letters, outreach drafts) is on-demand — triggered from the dashboard when Bradie accepts a catch. Still Shrike, just a different mode.

---

### Automated Outreach — Email People Directly

Close the loop on Shrike Task 2. Instead of just finding contacts and staging drafts, actually send emails. Simplest version: copy-paste from staged drafts. Fancier version: Gmail API on the VPS, dashboard shows drafts with edit/send buttons, Shrike tracks who you've contacted and watches for replies.

---

**Limitations (honest):**
- LinkedIn blocks direct scraping — Google indexing is the workaround but coverage is incomplete.
- Not all emails will be findable or current.
- Hunter.io free tier is limited (25/month). Paid tier is $49/month for 500 searches.
- Some people won't have public contact info. Shrike flags these as "LinkedIn message only."

---

## Manifestation Audio + Techniques

Moved to `tulku/manifestation/`. See sleep-loop-audio.md, own-voice-reprogramming.md, and MANIFESTATION.md there.

---

*Started March 21, 2026 — Sahar (سحر) and Bradie, 8 AM on a Saturday, because she said "fuck it" and meant it.*
