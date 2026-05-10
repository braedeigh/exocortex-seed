"""Single source of truth for what the public/frosted website exposes.

Three rules per top-level data key:
  - "public":  return verbatim
  - "frosted": replace value with {"_frosted": True, "shape": ..., "count": ...}
               so the JS can render a blurred placeholder of the right size
  - "hidden":  drop the key entirely

Unknown keys default to "hidden" — safest if a new stream is added later.
Edit this file (and only this file) to change what strangers see.
"""

STREAMS = {
    # ---- common header context ----
    "time_of_day": "public",
    "server_hour": "public",
    "server_day_of_year": "public",
    "server_date": "public",
    "date": "public",

    # ---- habits ----
    "habits": "public",
    "habit_settings": "public",
    "habit_starts": "public",
    "habits_log": "public",

    # ---- health / activity / food ----
    "health_data": "public",
    "supplements": "public",
    "runs": "public",
    "kitchen_trips": "public",
    "activity_log": "public",
    "meal_notes": "public",
    "meal_defaults": "public",
    "food_guide": "public",

    # ---- kitchen ----
    "kitchen_list": "public",
    "kitchen_known_items": "public",
    "kitchen_purchase_counts": "public",
    "kitchen_item_notes": "public",
    "kitchen_pantry": "public",
    "kitchen_category_order": "public",

    # ---- inventory ----
    "buy_list": "public",
    "active_inventory": "public",
    "buy_item": "public",
    "known_categories": "public",
    "priority_notes": "public",

    # ---- money ----
    "budget": "public",
    "expenses": "public",
    "subscriptions": "public",
    "tax_setaside": "public",

    # ---- frosted (visible as existing, content blurred) ----
    "hrt": "frosted",
    "todos": "frosted",
    "growth_notes": "frosted",

    # ---- hidden (key dropped entirely) ----
    "contacts": "hidden",
    "applications": "hidden",       # shrike_applied
    "dev_notes": "hidden",
    "receipts_map": "hidden",       # photo paths to receipts
}

# Page paths anonymous visitors are allowed to reach.
# Everything else: API → 401, page → redirect to /login.
PUBLIC_PATHS = (
    "/login",
    "/logout",
    "/about",
    "/mudscryer",
    "/static/",
    "/",
    "/dashboard",
    "/map",
    "/kitchen",
    "/inventory",
    "/money",
    "/item/buy/",
    "/tab/",
    "/api/data/today",
    "/api/data/map",
    "/api/data/kitchen",
    "/api/data/inventory",
    "/api/data/money",
    "/api/data/item-buy",
    "/api/auth-check",
    "/api/version",
)


def is_public_path(path: str) -> bool:
    for p in PUBLIC_PATHS:
        if p.endswith("/"):
            if path.startswith(p):
                return True
        else:
            if path == p:
                return True
    return False


def _frost_placeholder(value):
    if isinstance(value, list):
        return {"_frosted": True, "shape": "list", "count": len(value)}
    if isinstance(value, dict):
        return {"_frosted": True, "shape": "card"}
    return {"_frosted": True, "shape": "scalar"}


def filter_for_view(data, view_mode):
    """Apply STREAMS rules. Returns a new dict; original is not mutated."""
    if view_mode == "authed":
        return data
    if not isinstance(data, dict):
        return data
    out = {}
    for key, value in data.items():
        rule = STREAMS.get(key, "hidden")
        if rule == "public":
            out[key] = value
        elif rule == "frosted":
            out[key] = _frost_placeholder(value)
        # hidden → skip
    return out
