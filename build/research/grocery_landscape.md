# Grocery AI Landscape — Research Notes

*April 18, 2026*

## Existing Apps

### Frooty (frootyapp.com)
- Auto-generates lists from purchase history
- ML-based cost predictions for trips
- "Magic Auto Sort" reorders list by how you walk through the store (crowdsourced aisle data)
- **Missing:** No pantry tracking, no depletion modeling, no health/reaction logging

### Instacart
- Most sophisticated prediction engine in the space
- Learns *when* you'll reorder, not just what (temporal reorder cadence per item)
- Collaborative filtering (people who buy X also buy Y)
- Transformer-based substitution ranking from acceptance/rejection history
- **Missing:** Optimized for retail conversion, not user wellbeing. No personal health/reaction tracking

### Mealime
- Meal-plan-first: generates grocery lists from selected recipes
- Dietary filters (keto, vegan, etc.) — but static preferences, not learned responses
- **Missing:** No pantry tracking, no purchase prediction, no reaction tracking

### AnyList / OurGroceries
- Shared lists, autocomplete from history, category sorting
- No real intelligence layer — just frequency-based suggestions
- **Missing:** No depletion modeling, no health layer

### Kooper
- Conversational AI interface for list building
- Claims to learn from repeated purchases
- **Missing:** No public technical details on ML. No health tracking

## Open Source

### Grocy (grocy/grocy, ~9k GitHub stars)
- Most complete self-hosted system
- Full product inventory: quantities, purchase dates, expiry dates, locations, barcodes, prices
- Recipe-to-shopping-list integration
- Min-stock thresholds: you set a minimum per product, auto-adds to shopping list when stock drops
- "Due Score" ranks recipes by soon-to-expire ingredients
- Full REST API. Barcode scanning. Active community (Android app, Home Assistant integration)
- **Missing:** No consumption rate learning — thresholds are static/manual. No dietary/health tracking. No reaction logging

### GitHub Generally
- No well-starred projects doing real depletion prediction or ML-based auto grocery list generation
- Top results are student projects tracking expiry dates
- `danslimmon/oscar` (261 stars): barcode scanner → Trello list. Simple, no prediction
- **Consumption-rate-based depletion prediction is genuinely open territory in open source**

## What to Steal

- **Frooty:** Store-route sorting (already have HEB category ordering)
- **Instacart:** Temporal reorder prediction (learn purchase cadence per item, predict when you'll need it)
- **Grocy:** Min-stock threshold as simple first pass before ML; REST API architecture
- **Mealime:** Meal-plan-to-grocery-list pipeline (already have meal_defaults)

## What We Have That Nobody Else Does

- Symptom/reaction notes tied to specific ingredients
- Food guide (safe/hurts/unsure) connected to the grocery list
- Conversational input through the keeper
- Cricket reading journal to infer consumption
- One integrated system instead of five apps
- Personal ownership — no subscription, no data sold, no ads

## The Gap

Nobody connects "what to buy" with "how did this affect me." The health-aware grocery system is a real gap. Grocy is the closest architecture but has zero health awareness. The combination of pantry tracking + consumption prediction + reaction correlation is genuinely novel.

---

# Grocy Companion Project — grocy-predict

*Research: April 18, 2026*

## Why Not Contribute to Core Grocy

- Solo maintainer (Bernd Bestel / berrnd), skeptical of scope expansion
- No CONTRIBUTING.md, no plugin system, no extension hooks
- Was dismissive when consumption-rate prediction was proposed (issue #2559)
- Issue #64 (2018, still open, 9 upvotes) requests consumption rate analysis — acknowledged but never built
- Contributing a PR here would likely get blocked or ignored

## Why Build a Companion Project Instead

- Grocy has a full REST API with Swagger docs
- **pygrocy** (Python API client) already exists — ready to use
- The whole ecosystem is built this pattern: Barcode Buddy, Home Assistant integration, mobile apps — all separate projects talking to the API
- "Shopping List with Grocy" (Home Assistant addon) already has a basic prediction algorithm — reference implementation
- You'd own the project, the repo, the credit

## What grocy-predict Would Do

1. **Read** consumption/purchase data from Grocy's API via pygrocy
2. **Compute** per-item depletion rates from purchase frequency + stock changes
3. **Predict** when each item will hit min-stock or run out
4. **Auto-add** to shopping list before you run out
5. (Stretch) **Suggest** items based on co-purchase patterns and meal plan cadence

## Tech Stack

- Python (pygrocy for API, pandas/numpy for analysis, scikit-learn if ML needed)
- Could start simple (rolling averages) and add ML later (time-series regression on depletion curves)
- Runs as a cron job or lightweight service alongside Grocy

## Why This Is a Good Project

- Real ML portfolio piece — scoped, useful, demonstrable
- Addresses a genuine gap the community has asked for since 2018
- Targets 9k+ Grocy users who'd benefit immediately
- The same depletion prediction algorithm ports directly into the exocortex pantry system
- Built in Python, which is the right language to learn for data/ML work
- Open source credit visible to employers

## Prior Art to Study

- Instacart's temporal reorder prediction (learn per-item cadence)
- "Shopping List with Grocy" HA addon — basic prediction algorithm, good starting point
- Grocy issue #64 comments — what the community actually wants

## Scoping

**MVP:** Read purchase history → compute average days between purchases per item → flag items approaching their average reorder time → add to shopping list. No ML needed — just rolling averages. Ship this first.

**V2:** Factor in stock quantities and consumption events (not just purchase cadence). Weight recent behavior more than old. Handle seasonal variation.

**V3:** Multi-item correlation (when you buy X you usually also buy Y). Meal plan integration. Actual ML (time-series forecasting per product).
