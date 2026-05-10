# Shipping Plan — Restricted-Diet Grocery & Health Tracker

*April 18, 2026*

## What It Is

A grocery + pantry + symptom tracker built for people with dietary restrictions (MCAS, histamine intolerance, autoimmune). Track what you buy, what you have, what hurts you, what helps. The app that knows your body.

## Target Market

- 10-20 million Americans with histamine intolerance (3-6% of population)
- 33 million with food allergies broadly
- Beachhead: MCAS / histamine intolerance communities (r/MCAS, Facebook groups, 50k+ active members)
- Demographic: mostly middle-aged women, willing to pay for health tools

## Revenue Target

- $2k/mo minimum viable income
- 250 users at $8/mo or 400 at $5/mo
- No VC, no team, no app store. Just a PWA and Stripe

## What Already Exists (from the exocortex)

- Grocery list with catalog + quick-add chips + batch selection
- Pantry tracking with purchase dates
- Per-item notes for reactions/inflammation
- Food guide (safe/hurts/unsure)
- Symptom logging (numbered circles, color-coded)
- Habit tracking with dot grid
- Mobile PWA
- Time-of-day color theming

## What Needs to Be Built

### Must Have (v1)
- [ ] User accounts — signup/login, each user gets own data (Flask-Login)
- [ ] Database — move from flat JSON to SQLite (one table per data type)
- [ ] Onboarding — "what conditions do you have?" → preload relevant triggers
- [ ] Strip personal stuff — no journal, keeper, terminal, job search. Product is grocery/food/symptom tracker only
- [ ] Landing page — what it does, who it's for, pricing, sign up
- [ ] Stripe integration — $5-8/mo subscription
- [ ] Privacy policy / terms (legally required for health data)

### Should Have (v1)
- [ ] SIGHI histamine data integrated (auto-flag items by histamine risk)
- [ ] USDA nutrition data per item (API integration)
- [ ] "What works" section — curated supplements/strategies
- [ ] Mobile-first responsive design
- [ ] Data export (users own their data)

### Don't Need for v1
- AR glasses
- Cricket / AI agents
- Predictive restocking / ML
- Supply chain data
- Carbon footprint
- Meal planning
- Conversational AI input
- Food photography / barcode scanning

## Tech Stack

- Python / Flask (already know it)
- SQLite → Postgres later
- PWA (no app store submission needed)
- Stripe for payments
- Host on VPS to start, move to proper hosting with users
- Claude Code as dev partner

## Build Order

1. Fork exocortex grocery/symptom code into standalone repo
2. Add user auth (Flask-Login + SQLite)
3. Migrate data models from JSON to SQLite
4. Build onboarding flow (condition selection → trigger preloading)
5. Integrate SIGHI histamine list
6. Integrate USDA nutrition API
7. Build landing page
8. Add Stripe billing
9. Beta test with 5-10 people from MCAS communities
10. Launch post in r/MCAS, r/histamineintolerance, Facebook groups
11. Iterate based on feedback

## Marketing Plan

- Post in MCAS/histamine communities (you're already in them, you have the condition)
- "I built this for myself because nothing else worked" is the most compelling pitch
- Show the grocery list + reaction tracking in action (screenshots, short video)
- Free trial → paid conversion
- Word of mouth in chronic illness communities (these people share what works)
- The "what works" supplement section is shareable content that drives organic traffic

## Timeline

- 2-3 weeks focused building for v1
- 1 week beta with community members
- Launch and iterate

## Revenue Streams

### 1. Subscription (core)
- $5-8/mo for full app access
- Free tier possible later (basic tracking, limited history) to drive signups

### 2. Affiliate Links
- Supplement recommendations with affiliate links (Amazon, iHerb, Thorne)
- Typical commission: 4-10%
- Only list things users report actually help — transparency is non-negotiable with this community
- Partner directly with brands that serve MCAS/histamine community: Seeking Health, Thorne, Pure Encapsulations
- Scales passively with user count

### 3. Guides
- "Getting started with low histamine eating"
- "How to stock a MCAS-friendly kitchen"
- "Understanding your triggers — a 2-week protocol"
- Could be free (marketing funnel / SEO) or premium (one-time purchase)
- Free guides bring people in, the app keeps them

### 4. Community Recipes
- User-submitted recipes tagged by condition (low histamine, GF, dairy free, FODMAP, etc.)
- Filter, rate, comment
- "47 people with MCAS made this with no reactions" — social proof on recipes
- Free feature — drives retention and word of mouth

## AI Features (premium differentiator)

- Natural language food logging ("had chicken and kale, felt bloated after")
- Pattern detection across food + symptoms + supplements + sleep + HRT
- "Why did I flare?" analysis — cross-references all data streams
- Personalized suggestions based on history
- Pantry freshness alerts (histamine builds in aging produce)
- Supplement interaction awareness
- This is what people pay the subscription for — the intelligence layer

## Later (v2+)

- Crowdsourced supplement/food effectiveness ratings (Layer 3 from IDEAS.md)
- Predictive restocking from grocy-predict algorithm
- Barcode scanning via Open Food Facts
- Meal planning with nutritional completeness
- USDA nutrition integration
- EWG pesticide data integration
- Supply chain / origin tracking
- Conversational input (the keeper model for other users)
- AR grocery shopping overlay (long-term vision)
- Neurotype-adaptive interface modes (ADHD, anxiety, autism)
