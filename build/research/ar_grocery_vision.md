# AR Grocery Vision

*April 18, 2026*

## The Arc

Manual grocery list → auto-predicted list (grocy-predict) → AR glasses that show you what to grab as you walk past it.

Same algorithm at every stage. Same depletion prediction, same purchase cadence, same reaction history. Different render target.

## What the Glasses Would Do In-Store

- Overlay on shelf items: "You usually buy this every 8 days, last bought 7 days ago"
- Flag items with reaction history: "This triggered you March 16 — mild stomach pain"
- Highlight items on your list (orange dot)
- Green check on things you already have in pantry
- "You're low on eggs based on consumption rate" when you walk past the dairy section
- Route guidance through the store based on your list (Frooty already does this with aisle data on phones)
- Receipt-free checkout tracking — glasses see what you put in the cart

## What Needs to Exist First

1. **grocy-predict** — the depletion prediction engine (companion project, Python, MVP is rolling averages)
2. **Reaction/notes database** — already building this in the exocortex pantry system
3. **Food guide integration** — safe/hurts/unsure connected to product recognition
4. **Product recognition model** — glasses need to identify items on shelves (existing CV models, not novel)
5. **AR glasses hardware** — Meta, Google, Apple all shipping or piloting in 2025-2026

## Connection to LabOS

LabOS does this for lab bench work — glasses watch your hands, compare against protocol, flag errors. The grocery version is the same pattern: glasses watch your environment, compare against your data (pantry, reactions, list), surface relevant info. LabOS is procedural guidance; this is contextual awareness. Same architecture.

## Connection to IDEAS.md Vision

This is Layer 1 (Personal Health AI) + Layer 5 (Local Supply Chain Mapping) converging through AR. The glasses know what you need (prediction engine), what's safe for you (reaction history), and where to find it (store mapping). The full loop: your body data → what to eat → what to buy → where to get it → did it help.

Conversational → Ambient → Invisible. The grocery system is one of the clearest paths through that arc.
