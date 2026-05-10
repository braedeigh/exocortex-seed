# Ideas — Future

*Vision, product arcs, long-term features. Not actionable yet but worth keeping.*

## The Big Vision

The universal AI layer that lives behind every wearable, every phone, every device. Any sensor or data source plugs into it. The human just talks. The system ingests everything — Oura ring, Apple Watch, glucose monitor, phone sensors, camera, calendar, location — and builds a persistent, lifelong memory of who you are and how your body works. Not an app. The layer between you and all your data, forever. The chatbot that actually knows you because it's been watching, learning, and remembering for years. Every device is just another input. The AI is the only interface you ever need.

## Vision — The Product Arc

**The LLM is the universal interface layer between the human and every system.** The human never interacts with apps, forms, dashboards, or buttons. They just talk — naturally, about their life — and the AI operates all the structured systems underneath. It reads and writes to databases, updates trackers, checks food lists, flags triggers, fills in data. The human just lives.

**The friction is the product problem, not the data problem.** The data exists. The databases exist. Nobody sticks with the input. This solves input.

### The arc: Conversational → Ambient → Invisible

1. **Now** — Talk to the AI in a terminal. It logs everything. Maximum human input.
2. **Next** — Phone app. Talk, text, or snap photos. AI handles it.
3. **Then** — Wearables (ring, watch, glasses). Passive capture of sleep, heart rate, movement, location. AI only asks about what it can't observe — food, feelings, what's on your mind.
4. **Eventually** — AI almost never asks. It sees the heart rate spike (stress), knows the calendar (meeting), sees the location (HEB), reads the receipt (camera), knows you bought olives (trigger), flags it before you eat them. You do nothing.

**Each layer of hardware and integration removes human input until the system is watching, knowing, and only interrupting when it has something useful to say.**

### The split-view: Terminal + Live Dashboard

The terminal is the input layer. The dashboard is the live readout. You talk, and the structured view keeps up.

- **Context-aware tabs.** A post-response hook classifies what you're talking about and auto-switches the dashboard to the relevant view. Start journaling → journal notes appear on the right, updating in real time. Mention job search → the application tracker slides in. Talk about food → the food log and trigger history show up.
- **Two-way interaction.** The dashboard isn't read-only. Select text from your journal and delete parts you don't like, or copy-paste back into the terminal. Browse job listings on the right while discussing them on the left. The dashboard is a live, editable mirror of the structured data the conversation is touching.
- **Resizable split.** Drag the divider to give the terminal or dashboard more space. On phone, tabs you can flip between. The terminal can take over the full screen when you want to focus on the conversation.

The human just talks. The system shows them the relevant structured view of whatever they're talking about, without them ever navigating to it.

### Self-building system

The product builds itself from conversation. You say "what supplements should I take for MCAS?" and Claude researches it, creates a supplement tracker file, writes the dashboard component to display it, and the new tab appears on the right — live, no refresh, no deploy. The system grows new features as you describe new needs. The AI isn't just filling in data — it's building the infrastructure to hold your life as you talk about it. Every conversation potentially creates new structured views, new trackers, new dashboards. The product is never "done" because the user is always extending it by living.

### SaaS model — Conversational configuration

The product ships as a SaaS with pre-built infrastructure — dashboard tabs, data models, integrations, the full health tracking stack. Users don't build anything. They just talk. But the system is deeply customizable through conversation, not settings pages. "I'm vegetarian and I have MCAS" and the food tracker reconfigures its trigger lists. "I take estradiol every 5 days" and medication reminders set themselves up. "I want to track my meditation streak" and a new habit appears. The AI handles all configuration — the user just describes their life and the system adapts. No onboarding flow, no dropdown menus, no settings page. You tell it who you are and it becomes yours.

The personal health intelligence layer — the thing that knows *your* triggers, *your* patterns, *your* body — is the hardest part and the part being built first. The hardware just feeds it better data over time.

---

## Three Core Data Streams (MVP)

1. **Sleep** — wearable (Oura ring likely). HRV, sleep stages, blood oxygen, temperature, restlessness.
2. **Intake** — food + supplements + medications, logged conversationally or quick input. Flag system for known triggers (fermented, high histamine, processed).
3. **Response** — flares, mood, energy, self-reported symptoms. The "what happened after" layer.

The dashboard shows all three streams together. The AI connects them.

---

## Hardware

- **Oura Ring** — best sleep data, HRV, temperature trends. Has API. ~$300 + subscription. Top candidate.
- **Whoop** — similar, more fitness-oriented, subscription only.
- Long-term vision: glasses, watch, ambient capture. Free of the phone.

---

## Tech Stack

- **Streamlit** — current prototype. Good for MVP, deployable on Streamlit Community Cloud.
- **habits.csv** — current data store. Works for now, will need a real database eventually.
- **Oura API** — pipe ring data into the dashboard.
- **Claude API** — eventually the conversational layer lives in the app, not in the terminal.

---

## Roadmap (Priority Order)

### Tier 1 — The two biggest health levers. Do these first.
- [ ] **Sleep tracking hardware (Oura ring)** — Buy the ring. Single biggest data upgrade. Objective sleep stages, HRV, temperature, blood oxygen every night with zero input friction. The foundation everything else correlates against. Without this, sleep quality is "poor" or "better than usual" — subjective and lossy.
- [ ] **Food intake log with histamine risk flags** — The conversational + photo input system. This is where the MCAS rubber meets the road. Every flare you've had traces back to food. Accurate food tracking = predictable flares = avoidable flares.

### Tier 2 — Multipliers. These make Tier 1 data way more useful.
- [ ] **Correlations view** — food vs. sleep quality, intake vs. flares, exercise vs. HRV. The connective tissue. This is the product's actual differentiator — the "why" layer.
- [ ] **Supplement/medication tracker** — L-glutamine, estradiol, anything new. Tracks what you're taking so you can see what's actually helping.
- [ ] **Receipt photo scanning for groceries** — Snap the receipt, AI extracts items + prices + store. Whole grocery trip logged in one photo. Eliminates manual entry friction.

### Tier 3 — Quality of life. Build when the core is solid.
- [ ] **Oura API integration** — pull ring data automatically into the dashboard
- [ ] **Sobriety tracker with neurological reset milestones** — (already built, v0.1)
- [ ] **HRT cycle tracking with reminders**
- [ ] **Mood/energy self-report** — quick daily input
- [ ] **"What happened last time you ate X"** — searchable trigger history
- [ ] **Weekly patterns view** — which days are worst, what's different about good days

### Tier 4 — Product features. Build when you're ready to ship to others.
- [ ] **Standalone conversational interface** — Claude API replaces terminal for other users
- [ ] **Export/share with doctor or therapist**
- [ ] **Restock alerts** — "you're due for chicken"
- [ ] **Price comparison across stores**

---

## Personalized Health Optimization Engine

**The system doesn't just track — it recommends.** Based on your current habits, your body data, and your goals, it ranks what to focus on and what to add next. It knows you're already solid on sleep/food/meditation and suggests stretching next because it addresses four problems at once.

**Habit Tier Framework:**

Tier 1 — Non-negotiable foundation (daily):
- Sleep quality
- Anti-inflammatory diet
- Meditation

Tier 2 — Body maintenance (3-4x/week):
- Running (active — but knee/hip pain needs balancing)
- Stretching/yoga (GAP — addresses knee, hip, neck, overlaps with Buddhist practice)
- Strength training (GAP — neck weakness, asymmetric leg strength)

Tier 3 — Mind maintenance (weekly):
- Buddhist study/practice
- Journaling/exocortex session

Tier 4 — Small things that compound (daily, tiny):
- Flossing
- Bowel tracking
- L-glutamine
- Morning routine (belly massage, neck rub, breathing)
- Night routine (Michael Sealey, belly massage)
- Hydration (shift intake earlier to reduce nighttime peeing)

**Key design principle:** Don't add everything at once. The system tracks what's already established, identifies the highest-impact gap, and suggests ONE thing to add. "You've got food and sleep dialed. Your body data says add stretching next. Here's 15 minutes that fits between meditation and your first meeting."

**Product feature:** Personalized habit prioritization based on the user's actual data, not generic advice. The AI knows what they're already doing (from conversational logging + wearables) and what their body needs next (from pain reports, sleep data, mood patterns). Works for anyone — different bodies, different baselines, different goals.

**Bradie's current status (Mar 21):**
- Tier 1: all three locked in
- Tier 2: running yes, stretching/yoga NO (highest priority gap — addresses knee, hip, neck, Buddhist overlap), strength training NO
- Tier 3: starting (meditation teacher, Loomie)
- Tier 4: L-glutamine yes, morning routine partial, night routine partial, flossing inconsistent, bowel tracking not started

**Next habit to add: yoga/stretching**

---

## Onboarding — Conversational Habit Agent

No settings page, no checklist of 50 habits. You talk to an agent who asks about your life, your health, what's hard, what you've tried. It figures out which habits matter most for you and proposes ONE to start with. The first habit is using the app itself — just check in once a day. Once that sticks, it suggests the next one. Builds gradually based on what you're actually doing, not what you wish you were doing.

- Agent identifies which habits to change, what order, how many at a time
- Starts small — the first habit is literally "open the app and say something"
- Escalates only when the current layer is consistent
- Personalized to the user's actual constraints (chronic illness, schedule, energy levels, what they've already tried and quit)
- No onboarding form. The conversation IS the onboarding.

---

## Who It's For

- Anyone with chronic illness tracking triggers (MCAS, Long COVID, autoimmune)
- Anyone quitting a substance and wanting to see the recovery curve
- Anyone in therapy trying to see their patterns
- Anyone whose doctor says "keep a food diary" and they quit after 3 days
- Anyone whose body and mind are connected and whose tools pretend they're not

---

## Grocery Tracker

**Tracks:** What she buys, where, how much it costs, when she'll need it again.

**Why it matters:** Restricted diet = predictable grocery cycle. The system can learn her restock cadence and remind her. Also tracks spending over time.

**Data points per purchase:**
- Item name (linked to my_foods.json)
- Store (HEB, Costco, etc.)
- Price
- Date purchased
- Estimated days until restock (learned over time from purchase frequency)

**Features:**
- "Time to restock" alerts based on purchase history
- Price comparison across stores
- Monthly grocery spend tracking
- Links back to food log — what she eats drives what she buys

---

## Long-Term Vision — The Full Platform

### Layer 1: Personal Health AI (building now)
Conversational health tracker. Sleep, food, supplements, triggers, habits. The AI knows *you* — your body, your patterns, your life. Entry point for everything else.

### Layer 2: Awakening Framework
The system isn't just "be healthier" — it's oriented toward awakening. Buddhist framework woven into the habit optimization. Meditation isn't separate from health. The practice of awareness IS the health intervention. Mindfulness, Vajrayana, presence — not as a feature but as the orientation of the whole system. Helps people move toward awakening at the same time as optimizing their bodies.

### Layer 3: Evidence-Based Product Recommender
Crowdsourced, ranked supplements and foods for specific conditions. User-reported effectiveness data.
- "I have MCAS" → top-rated supplements from 5,000 people with MCAS, ranked by reported effectiveness
- "What helps with histamine flares" → here's what actually worked for people like you, with data
- Like Wirecutter for health interventions, powered by real user outcomes, not sponsored content
- Evidence-based — links to research, cross-referenced with user data

### Layer 4: Community
People with the same problems finding each other and talking.
- Search by condition, symptom, trigger
- Talk to others who solved the problem you have
- Share what works, flag what doesn't
- Not a forum — structured data conversations that feed back into the recommender

### Layer 5: Local Supply Chain Mapping
The system knows where to get what you need, locally.
- "HEB on Lamar carries low-histamine everything, $3 cheaper than Whole Foods"
- Health food stores mapped by what they stock
- Price tracking across stores (connects to grocery tracker)
- Eventually: full supply chain visibility — where your food comes from, how it's produced
- Community-contributed — people tag stores and products as they shop

### The Arc
Personal tracker → personalized recommendations → community intelligence → local supply chain mapping. Each layer feeds the next. The personal data makes the recommendations smart. The community makes the data set huge. The supply chain makes the recommendations actionable.

**Entry point:** MCAS/chronic illness trigger tracking (small, desperate, underserved)
**Expansion:** Chronic illness broadly → substance recovery → general health optimization → awakening practice
**Moat:** The personal health intelligence + community data. Nobody else has both.

---

## Activation Energy / Time Sink Tracker

Track when time is going to things she doesn't want to be doing (Twitter scrolling, procrastination loops, avoidance patterns) and surface what she's avoiding. Not punitive — curious. "You spent 3 hours on Twitter today. The last time that happened, you were avoiding the McKinsey app." Help find the motivation by making the avoidance pattern visible and connecting it to the thing underneath. Could tie into the keeper's pattern recognition — rumination and avoidance are often the same loop.

---

## Location History

Continuous location tracking — see where I was at any given time on any given day. Timeline view on the dashboard. Could feed into a lot of things: auto-logging runs (left from home, ran a loop, came back), grocery trips, time at work vs home, social visits. Battery drain is the concern — need to research background GPS options on iOS that aren't killers.

Eventually pairs with Oura ring: ring tracks the run biometrics (HR, HRV, calories), GPS tracks the route. Runs get auto-logged with no input at all.

**Prior art:** Google Timeline did this but killed it. Apple has significant locations but it's locked down. Overland (iOS app) does background GPS logging to your own server. Worth investigating.

---

## Nutritionally Complete Meal Planning

Optimize meal plans for nutritional completeness within the safe food list. Constraint satisfaction: maximize nutrition, avoid triggers, account for what's been eaten recently.

- "You haven't had kale in 4 days, you're low on vitamin A this week, tonight's meal prep should include it."
- Suggests meals from safe foods that fill nutritional gaps
- Feeds directly into the grocery list — meal plan generates what to buy
- Learns over time as the safe/hurts/unsure food lists grow

**Prerequisite:** Consistent food logging (via Cricket + journal). Needs enough data to know what she's actually eating before it can suggest what's missing.

**Connects to:** Food tracking, smart grocery list, food guide (safe/hurts/unsure), MCAS trigger avoidance, consumables inventory.

---

## Consumables Inventory

When a grocery item is checked off at the store, it auto-adds to a "consumables" inventory with a count. The system tracks how much of each thing you have based on what you buy and what you eat/use. Over time it learns depletion rates — "you go through a bag of rice every 2 weeks" — and can predict when you're running low.

**Flow:** Buy chicken (grocery list check-off) → inventory: chicken +1 → eat chicken (food log) → inventory: chicken -1 → running low → auto-adds to next grocery list.

**Connects to:** Grocery list, food logging, smart grocery list, meal planning, restock alerts (Tier 4 roadmap).

**Depletion via natural language:** Cricket handles this. "Meal prepped my chicken meal prep" → Cricket reads journal, knows chicken was used, decrements inventory. No manual tracking of what gets consumed — just talk about your life, Cricket figures out the rest.

---

## Smart Grocery List

"What do I need at the store?" — generates a likely list based on:
- What you've been eating (food log)
- What you've been buying and how fast you go through it (purchase history + restock cadence)
- What you're planning to make (meal prep plans)
- Common staples you always buy, shown below the predicted list for quick add

**Data needed first:** Purchase history. Start logging grocery trips to the journal — "went to HEB, bought X Y Z, $45." Cricket extracts items, stores, prices. After a month or two, the system learns your cycle and can actually predict restock timing.

**Predictive restock:** Track quantities — how much rice is in each bag, how much you use per meal prep. System learns depletion rates ("you go through a bag of rice every 2 weeks") and auto-adds items to the grocery list when you're running low. Paired with the consumables inventory and receipt scanning, the goal is near-zero thought going into grocery list creation — the system knows what you need before you do.

**Store route ordering:** Categories are ordered to match how Bradie walks through HEB — vegetables first, protein last (picked up cold at the end). Currently hardcoded. Eventually: auto-setting that learns the most common category order from purchase history + a manual override where users can drag categories into their preferred store walking order. Different stores get different routes. Default auto-order works out of the box; power users customize.

**Store layout visualization (deeper optimization):** Indoor store mapping exists (Mappedin, Aisle, Aisle411) but it's all retailer-deployed — no consumer app where you map your own store. For this product, the smarter path is behavioral: the AI learns your shopping pattern over time and sorts your list in the order you naturally grab things. No map needed. A future version *could* let users photo-map aisles and build a spatial view of their store, but the ROI is low compared to just learning from category ordering + trip history. The existing approach (category-sorted list + store route ordering) gets 90% of the value.

**Receipt photo (future):** When the "done at store?" popup fires after checking off all items, prompt to take a photo of the receipt. Extract items + prices + quantities automatically. Feeds purchase history and inventory in one shot.

**Connects to:** Food tracking, grocery tracker (already in IDEAS), receipt photo scanning (Tier 2 roadmap).

---

## AI-Driven Navigation

Ask "show me last week's food log" or "pull up my run tracker" and the AI navigates the dashboard for you — switches tabs, opens the right section, scrolls to it, or renders the relevant data inline in the conversation. The terminal at the bottom isn't just input — it can control the UI above it. The AI is the navigation.

---

## Conversational Settings

No settings page. Users ask the AI "can I change my grocery store order?" or "make my habit tracker show 90 days instead of 60" and the LLM understands the available settings, shows what's possible, and makes the change on confirmation. Settings become discoverable through conversation instead of buried in menus. The AI knows the full settings schema and can explain what each option does.

---

## Future Dashboard Ideas

- [ ] Make dashboard public-ready (habits/health data public, journal/private stuff hidden). Get feedback from internet people.

---

## Open Questions

- What's the minimum viable input friction? → **Answered: conversational + photo, AI does the work, one-tap confirm**
- How much of the AI layer is the product vs. the data visualization?
- Monetization — subscription? Free tier + premium insights? Community tier?
- Name?
- How to handle medical liability / "not medical advice" framing?
- Buddhist framework: explicit or implicit? Does the awakening orientation scare off mainstream users or attract the right ones?

---

## Ecosystem Tracker — Personal Supply Chain Mapping

Track where the things in your life come from — what they're made of, where they're produced, how they get to you. Build a living map of every ecosystem you're connected to through consumption.

**What it tracks per item:**
- What it is (chicken, almond butter, shampoo, t-shirt)
- Where it was made/grown (farm, factory, region, country)
- Materials/ingredients and their origins
- How it gets to you (supply chain — farm → distributor → HEB → your kitchen)
- Environmental/ethical notes (organic, fair trade, regenerative, etc.)

**Why it matters:** You're a soil microbiome ecologist. You already think in terms of ecosystems and nutrient cycles. This makes visible the web of ecosystems sustaining your daily life — the farms, the watersheds, the labor, the logistics. It turns consumption from invisible to legible.

**Display:** A network/map visualization on the dashboard showing all the ecosystems you're connected to. Click a node to see what flows through it. Over time, the map grows as you log more about where things come from.

**Connects to:** Grocery tracker (items already logged), food log (what you eat), Layer 5 local supply chain mapping, sustainable food recommender (about page vision). This is the data layer underneath the sustainability angle — you can't recommend sustainable choices without first mapping what's unsustainable.

**Data entry:** Start simple — when logging a grocery item or product, optionally note where it's from. Cricket could also extract this from journal entries ("got chicken from the farmer's market on Saturday"). Over time, build a database of product → origin mappings that auto-populate.

**As art piece (added 2026-05-02):**

> "It would be such a beautiful art piece to have my body be connected to ecosystems on like a display"

Body-as-center-node visualization — her body in the middle, every ecosystem she's connected to (farms, watersheds, factories, labor, the supplements in her bloodstream, the gut microbes she's feeding) radiating out as living edges. Combines the Body Diagram idea (IDEAS_now) with this Ecosystem Tracker. Long-term: a wall display, not a dashboard widget.

---

## Food Intelligence Graph (Apr 18)

Every food item as a node in a graph with edges to multiple data layers. The grocery catalog is the seed — each item you already track gets enriched with external data over time.

**Data layers per item:**
- **Your body** — reactions, inflammation, safe/hurts/unsure (already building)
- **Nutrition** — macro/micronutrients, what gaps it fills in your diet
- **Cost** — price per unit, price history, store comparison
- **Source** — farm, region, country, organic/conventional
- **Chemistry** — pesticide residues, additives, processing methods
- **Environment** — carbon footprint, water usage, transport distance
- **Research** — linked studies on health effects of chemicals/additives

**Queries this enables:**
- "Cheapest way to get enough vitamin A this week without triggering me"
- "Which of my safe foods have the lowest pesticide exposure?"
- "Sort my grocery list by carbon footprint"
- "What am I missing nutritionally?"
- "Show me everything I know about kale — nutrition, reactions, cost, source, pesticides"

**Data sources (see build/research/food_data_sources.md):**
- USDA FoodData Central — free API, comprehensive nutrition
- SIGHI — histamine compatibility list for MCAS
- EWG Dirty Dozen / Clean Fifteen — pesticide rankings
- Open Food Facts — crowdsourced product database with ingredients, origins, Nutri-Score
- Open FoodTox (EFSA) — chemical hazard data

**Build path:**
1. Attach USDA nutrition data to existing catalog items (API call per item)
2. Layer on cost tracking from receipt photos / manual entry
3. Add pesticide data from EWG
4. Add histamine flags from SIGHI
5. Supply chain / origin data from Open Food Facts + manual notes
6. Carbon footprint data when good sources exist
7. Dashboard view: click any item in pantry/catalog → see full graph of everything known

**Connects to:** Ecosystem Tracker (above), grocery system (already built), food guide (safe/hurts/unsure), AR grocery vision (glasses showing this data in-store), nutritionally complete meal planning (IDEAS_future), grocy-predict companion project

---

## Possible Adjustments (Mar 28)

Make the exocortex stop me from working on certain things over a certain period of time? Or create some notification when I've spent some amount of time working on something? Not sure

When I wake up freaking out, maybe have it direct me to do all my morning routine before coming back to talk about it, gently redirecting me to do my calming exercises before ruminating, but it's allowed after I do my morning routine? I'm not sure. But the journaling helps me wake up. Idk. But I think meditation before anything else as I wake up could be key.

Make a cool logo for the PWA just using AI or something. Like a brain with an overlay that connects to other things outside of it like computer bits simply? Ask the spark session to create a prompt based on this input and its knowledge of the exocortex

I also want to track my finances at some point. Add in my finance tracking notes. Like my budget spreadsheet, what I buy, how much is going in

Make a privacy selector for what I want to show the public or like, people I show the MVP to.

Make a journal dashboard that I can flip through and edit. On split screen the pages will be on the right and the terminal will again be on the left. It will auto update and I can just edit it in real time if it's wrong.

Possibly make into a real downloadable software for Mac instead of just a web app? How to protect my code from being ripped?

In the far future it for example reminds me to get the clothes out of my clothes wash that need to be hung to dry when I'm doing stuff. I can mark that as done similarly to other habits until it becomes something I do without thinking, at which point it goes away. Reps of 60-90. Idea for all of these is to make them involve no thought at all

Instead of spark as a terminal for the saas, maybe it's just a settings changer for them? Rather than a code changer? It will adjust all the premade settings rather than being actual code like I have on mine

---

## Launch Market — Restricted Diet Community

MCAS, histamine intolerance, autoimmune — these people are desperate, organized online, and will pay for something that actually works. They're also vocal. Ten happy users in that community is worth a thousand in the general market. This is the beachhead. Build for them first, expand from there.

---

## The Ambient Layer Is the Real Business

Right now proving the model works with manual conversational input. Once wearables auto-feed the system and the AI stops needing to ask, that's a subscription people will never cancel because they literally do nothing and it just works. Phase 1 (now) proves the concept. Phase 3-4 (ambient/invisible) is where retention goes to 100% and churn drops to zero. That's the Oura killer — not better sensors, better intelligence on top of the same sensors.

---

## Data Science & Research Layer

Learn the actual math and statistics to do this right. With enough users, track retention and health improvement rigorously. Longitudinal data across users: does conversational input improve tracking adherence vs forms? Does the morning routine gatekeeper reduce rumination episodes? Does cross-correlating food + sleep + symptoms lead to measurable flare reduction? Design real studies, control for variables, publish. This is the kind of evidence that gets doctors to recommend the app. PhD in biology means I already know how to do this — just need to apply it to user health data instead of soil microbiomes. The product generates the dataset. The dataset proves the product works. Flywheel.

---

## Research-Driven Practice Framework (Mar 29)

Want to design a framework for the exocortex that's grounded in the research I've done. Two deep research docs to reference:

- **`tulku/research/ancient_wisdom_modern_evidence.md`** — 12 practices (gratitude, meditation, forgiveness, community, service, fasting, simplicity, acceptance, compassion, silence, self-examination, rest) with effect sizes, mapped across science, Christianity, and Buddhism
- **`tulku/research/neuroscience_of_doing_hard_things.md`** — procrastination as emotion regulation failure, collapse of the willpower model, implementation intentions, environment design, circadian matching, dopamine and sub-goals

Need to decide: which of these practices does the exocortex actively support, how does it support them (tracking, prompting, correlating, nudging), and what's the priority order? The system already does some of this well (self-examination, community). Others are gaps. Want to figure out the right framework before building anything.

---

