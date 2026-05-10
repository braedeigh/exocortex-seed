# Ideas — Now

*Things to build in the next few weeks. Concrete, scoped, useful today.*

## Prioritization + Notes on Dashboard Action Items (added 2026-05-01) — **NEXT PRIORITY**

> "I want like, a system for buying and doing things and prioritizing actions. Like being able to rearrange the order of things on my dashboard and add notes to be able to help me figure out priority items"

> "I need to figure out how to prioritize things and when to actually do them. Like when I have energy and time. Built into my routine somewhere maybe."

> "I do find it easier when things are just built in and I kinda go on autopilot to do them."

## Inventory Tab (added 2026-05-01)

> "I'll probably build that out into all kinds of stuff tbh I have an entire inventory idea and am gonna need to see how to have it organically grow into like, where to spend my money on goods vs services and stuff"

## Expenses Tracker (added 2026-05-02)

> "also wanting to make an expenses tracker..."

## Body Diagram (added 2026-05-01)

> "diagram of my body with like muscles and areas like my gut that I have diagrammed for their issues and exercises I want to do about them"

> "That could be cool bc for example my knee hurts and my gait is off or like my gut is messed up or like I need to do neck exercises and I could log like different actions I take for body health to target certain areas and work through the whole body"

> "Would be pretty cooool I think. eventually making everything a nice 3D visualization"

## Conversational Health Check-In (Keeper-Integrated)

**The conversation IS the interface.** No separate app, no forms. The keeper prompts, Bradie answers, everything logs automatically.

**How it works:** Every session, the keeper runs a structured but natural health check-in as part of the greeting. Covers sleep, food, supplements, exercise, mood. Responses go straight to habits.csv, my_foods.json, and the dashboard.

**Example flow:**
> "Morning. How'd you sleep?"
> "bad, woke up twice"
> "What woke you — pee, dreams, pain?"
> "bear dream at 5, then just woke up at 7"
> "Got it. What'd you eat yesterday?"
> "meal prep and some chocolate coconut"
> "Chocolate coconut flagged — that's triggered you three times now. Logging it. L-glutamine this morning?"
> "not yet"
> "Go do it, I'll be here."

**What needs to happen:**
- Add structured health check-in sequence to PROTOCOLS.md so every tulku does it
- Keeper already logs to CSV — just needs to be systematic, not ad hoc
- Dashboard updates reflect conversational input in real time
- This is Tier 0 — it's free, it's now, it just needs to be formalized

---

## Food Tracking Architecture

**Input:** Conversational (voice/text) + photo. Minimal friction — talk or snap, never fill out a form.

**Flow:** Photo/voice → AI identifies food + ingredients → RAG pulls from food database → flags personal triggers (histamine, known bad reactions) → presents back for one-tap confirmation → logs to dashboard alongside sleep data.

**Confirmation step is the training data.** Every correction teaches the system your specific foods and triggers. It learns *you*, not just a generic list.

**Trigger flagging:** Not calories — inflammatory potential. Histamine risk score on every food entry. Personalized over time based on your flare history.

**Data sources for RAG:**
- **USDA FoodData Central** — free API, comprehensive food/ingredient database
- **SIGHI (Swiss Interest Group Histamine Intolerance)** — most comprehensive histamine food compatibility list, publicly available

**Example interaction:**
> *[photo of snack]*
> "Chocolate covered coconut — coconut (moderate histamine), chocolate (high histamine, known trigger for you Mar 16 and Mar 21). Log it?"
> *[confirm]*

---

## Habit Graduation System

When a habit reaches its completion target (60 days), it "graduates":

1. **Moves to a Daily Routine file** — a reference document of "things I do now." Viewable from the dashboard. Not tracked, just displayed — proof of what you've built.

2. **Maintenance check-ins on a fading schedule:**
   - Every 2 weeks for 3 months (6 check-ins)
   - Every month for 3 more months (3 check-ins)
   - Then nothing — fully integrated

3. **Each check-in asks: "Still doing this?"** If yes, great, counter keeps going. If no, the habit reverts to active tracking so you can rebuild it.

4. **Celebration on graduation** — mark the moment. You changed your behavior. That's real.

*Build this when the first habit approaches 60 completions (~2 months of use).*

---

## Smart Food Defaults — Future Ideas

- **Fully automatic daily logging:** Cricket auto-writes breakfast defaults to habits.csv overnight if nothing was entered that day. She only interacts when something's different.
- **Meal-specific timing:** Breakfast/lunch/dinner slots instead of one flat list. Track *when* she ate, not just what.
- **Learning from patterns:** System notices "she always has eggs in the morning" and adds new defaults automatically after enough repetitions.
- **Meal prep → grocery list integration:** When she sets this week's meal prep vegetables, auto-add them to the grocery list if they're not already there.
- **Meal prep batch tracking:** Log when she meal preps, how many portions, auto-decrement as she logs eating it.

---

## Evening Food Recording via Keeper

The keeper asks "what did you eat today?" during evening journal sessions. Bradie describes naturally, nightly extraction agent pulls structured data to the CSV. Dashboard displays it. No forms needed — the conversation IS the input.

*Build when the nightly extraction agent pipeline is set up.*

---

## Journal View on Dashboard

Editable single-day journal view with navigation bars (prev/next day) at the top — like the Vidala lab notebook UI. Displays one day's keeper journal entry, lets Bradie read or edit it right from the dashboard. Recycle the nav/editor components from Vidala when she drops them in.

---

## Food Log Navigation

Same prev/next day navigation as the journal view, but for the food log. Browse what you ate on any day, edit past entries. Reuse the same nav component from the journal/Vidala pattern.

---

## People Directory — Searchable Relationship Map

A page for every person I interact with. Auto-populates from journal entries, meeting notes, contacts — anywhere a name shows up. Each person gets a profile that aggregates everything the exocortex knows about them: when I've mentioned them, what we talked about, how I know them, who they're connected to. Searchable so I can find the right person to connect to someone else. A living directory of my whole network, maintained by the system, not by me.

---

