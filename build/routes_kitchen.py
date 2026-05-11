"""Kitchen, grocery, pantry, meal notes, and catalog routes."""
from flask import request, jsonify
from datetime import datetime
from pathlib import Path
from data_helpers import DATA_DIR, load_json, save_json
import json
import re
import shlex
import subprocess
import threading
import time
import uuid


def register(app):

    @app.route("/api/kitchen/add", methods=["POST"])
    def add_kitchen_item():
        data = request.json
        name = data["name"].strip()
        kitchen_path = DATA_DIR / "kitchen.json"
        gdata = json.loads(kitchen_path.read_text()) if kitchen_path.exists() else {"items": [], "category_map": {}}
        if any(i["name"].lower() == name.lower() for i in gdata["items"]):
            return jsonify({"error": "Already on the list"}), 400
        cat_map = gdata.get("category_map", {})
        category = data.get("category", "").strip().lower()
        if not category or category == "other":
            category = cat_map.get(name.lower(), "other")
        if category != "other":
            cat_map[name.lower()] = category
            gdata["category_map"] = cat_map
        gdata["items"].append({"name": name, "category": category, "checked": False})
        kitchen_path.write_text(json.dumps(gdata, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/kitchen/add-with-category", methods=["POST"])
    def add_kitchen_item_with_category():
        """Atomic: upsert catalog entry + add to active list with the given category."""
        data = request.json
        name = (data.get("name") or "").strip()
        category = (data.get("category") or "other").strip().lower() or "other"
        if not name:
            return jsonify({"error": "Empty name"}), 400
        kitchen_path = DATA_DIR / "kitchen.json"
        gdata = json.loads(kitchen_path.read_text()) if kitchen_path.exists() else {"items": [], "category_map": {}}
        cat_map = gdata.setdefault("category_map", {})
        cat_map[name.lower()] = category
        if any(i["name"].lower() == name.lower() for i in gdata["items"]):
            # Already on list — just refresh category in catalog and return
            kitchen_path.write_text(json.dumps(gdata, indent=2))
            return jsonify({"ok": True, "already_on_list": True})
        gdata["items"].append({"name": name, "category": category, "checked": False})
        kitchen_path.write_text(json.dumps(gdata, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/kitchen/remove", methods=["POST"])
    def remove_kitchen_item():
        data = request.json
        name = data["name"]
        kitchen_path = DATA_DIR / "kitchen.json"
        gdata = json.loads(kitchen_path.read_text())
        # If the item was checked (counted as purchased) at delete time, decrement
        # the purchase count so the user can undo a mistaken "bought" without
        # polluting buy-frequency stats. Matches toggle's decrement-on-uncheck.
        removed = next((i for i in gdata["items"] if i["name"] == name), None)
        if removed and removed.get("checked"):
            counts = gdata.setdefault("purchase_counts", {})
            key = name.lower()
            counts[key] = max(0, counts.get(key, 0) - 1)
        gdata["items"] = [i for i in gdata["items"] if i["name"] != name]
        kitchen_path.write_text(json.dumps(gdata, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/kitchen/toggle", methods=["POST"])
    def toggle_kitchen_item():
        data = request.json
        name = data["name"]
        kitchen_path = DATA_DIR / "kitchen.json"
        gdata = json.loads(kitchen_path.read_text())
        all_checked = True
        counts = gdata.setdefault("purchase_counts", {})
        for i in gdata["items"]:
            if i["name"] == name:
                was_checked = i.get("checked", False)
                i["checked"] = not was_checked
                if not was_checked:
                    counts[name.lower()] = counts.get(name.lower(), 0) + 1
                else:
                    counts[name.lower()] = max(0, counts.get(name.lower(), 0) - 1)
            if not i.get("checked", False):
                all_checked = False
        kitchen_path.write_text(json.dumps(gdata, indent=2))
        return jsonify({"ok": True, "all_checked": all_checked})

    @app.route("/api/kitchen/clear", methods=["POST"])
    def clear_kitchen_checked():
        kitchen_path = DATA_DIR / "kitchen.json"
        gdata = json.loads(kitchen_path.read_text())
        checked = [i for i in gdata["items"] if i.get("checked")]
        gdata["items"] = [i for i in gdata["items"] if not i.get("checked")]
        pantry = gdata.setdefault("pantry", {})
        today = datetime.now().strftime("%Y-%m-%d")
        for item in checked:
            pantry[item["name"].lower()] = {"added": today}
        kitchen_path.write_text(json.dumps(gdata, indent=2))
        trips_path = DATA_DIR / "kitchen_trips.json"
        trips = json.loads(trips_path.read_text()) if trips_path.exists() else {"trips": []}
        if not trips["trips"] or trips["trips"][-1]["date"] != today:
            trips["trips"].append({"date": today})
        trips_path.write_text(json.dumps(trips, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/kitchen/pantry/need", methods=["POST"])
    def pantry_need_item():
        data = request.json
        name = data["name"].strip()
        kitchen_path = DATA_DIR / "kitchen.json"
        gdata = json.loads(kitchen_path.read_text()) if kitchen_path.exists() else {"items": [], "category_map": {}}
        pantry = gdata.get("pantry", {})
        pantry.pop(name.lower(), None)
        cat_map = gdata.get("category_map", {})
        category = cat_map.get(name.lower(), "other")
        if not any(i["name"].lower() == name.lower() for i in gdata["items"]):
            gdata["items"].append({"name": name, "category": category, "checked": False})
        kitchen_path.write_text(json.dumps(gdata, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/kitchen/pantry/add", methods=["POST"])
    def pantry_add_item():
        data = request.json
        name = data["name"].strip()
        kitchen_path = DATA_DIR / "kitchen.json"
        gdata = json.loads(kitchen_path.read_text()) if kitchen_path.exists() else {"items": [], "category_map": {}}
        pantry = gdata.setdefault("pantry", {})
        today = datetime.now().strftime("%Y-%m-%d")
        pantry[name.lower()] = {"added": today}
        kitchen_path.write_text(json.dumps(gdata, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/kitchen/pantry/remove", methods=["POST"])
    def pantry_remove_item():
        data = request.json
        name = data["name"].strip()
        kitchen_path = DATA_DIR / "kitchen.json"
        gdata = json.loads(kitchen_path.read_text()) if kitchen_path.exists() else {"items": [], "category_map": {}}
        gdata.get("pantry", {}).pop(name.lower(), None)
        kitchen_path.write_text(json.dumps(gdata, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/kitchen/aisle/set", methods=["POST"])
    def set_aisle():
        """Set or clear the aisle number for a catalog item. aisle=null clears.
        Side effect: also updates category_map so the catalog's grouping logic
        knows aisle items sit under the @aisles sentinel.
        """
        data = request.json or {}
        name = (data.get("name") or "").strip().lower()
        aisle = data.get("aisle")
        if not name:
            return jsonify({"error": "Empty name"}), 400
        kitchen_path = DATA_DIR / "kitchen.json"
        gdata = json.loads(kitchen_path.read_text()) if kitchen_path.exists() else {}
        aisles = gdata.setdefault("aisles", {})
        cat_map = gdata.setdefault("category_map", {})
        if aisle in (None, "", 0):
            aisles.pop(name, None)
            # When clearing an aisle, restore to "other" if the category was @aisles
            if cat_map.get(name) == "@aisles":
                cat_map[name] = "other"
        else:
            try:
                aisles[name] = int(aisle)
                cat_map[name] = "@aisles"
            except (TypeError, ValueError):
                return jsonify({"error": "Invalid aisle number"}), 400
        kitchen_path.write_text(json.dumps(gdata, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/kitchen/location/set", methods=["POST"])
    def set_location():
        """Unified picker — set EITHER a section category OR an aisle number for an item.
        Body: { name, location }. location can be:
          - "" or null  → clear (default to 'other')
          - "produce", "dairy", etc. → section category
          - "aisle:5"  → aisle 5
        Atomically updates category_map + aisles to keep them consistent.
        """
        data = request.json or {}
        name = (data.get("name") or "").strip().lower()
        loc = (data.get("location") or "").strip()
        if not name:
            return jsonify({"error": "Empty name"}), 400
        kitchen_path = DATA_DIR / "kitchen.json"
        gdata = json.loads(kitchen_path.read_text()) if kitchen_path.exists() else {}
        aisles = gdata.setdefault("aisles", {})
        cat_map = gdata.setdefault("category_map", {})
        if loc.startswith("aisle:"):
            try:
                n = int(loc.split(":", 1)[1])
            except (ValueError, IndexError):
                return jsonify({"error": "Invalid aisle"}), 400
            aisles[name] = n
            cat_map[name] = "@aisles"
        else:
            aisles.pop(name, None)
            cat_map[name] = loc or "other"
        kitchen_path.write_text(json.dumps(gdata, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/kitchen/category/rename", methods=["POST"])
    def rename_category():
        """Rename a category everywhere it appears: category_order, category_map values, items[].category."""
        data = request.json or {}
        old = (data.get("old") or "").strip().lower()
        new = (data.get("new") or "").strip().lower()
        if not old or not new:
            return jsonify({"error": "old and new required"}), 400
        if old == "@aisles" or new == "@aisles":
            return jsonify({"error": "@aisles is reserved"}), 400
        if old == new:
            return jsonify({"ok": True, "noop": True})
        kitchen_path = DATA_DIR / "kitchen.json"
        gdata = json.loads(kitchen_path.read_text()) if kitchen_path.exists() else {}
        # category_order
        order = gdata.get("category_order") or []
        if new in order and old in order:
            # Avoid duplicates — drop the old slot, keep the existing new
            order = [c for c in order if c != old]
        else:
            order = [new if c == old else c for c in order]
        gdata["category_order"] = order
        # category_map values
        cm = gdata.get("category_map") or {}
        for k, v in list(cm.items()):
            if v == old:
                cm[k] = new
        # items[].category
        for it in gdata.get("items", []) or []:
            if it.get("category") == old:
                it["category"] = new
        kitchen_path.write_text(json.dumps(gdata, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/kitchen/category/delete", methods=["POST"])
    def delete_category():
        """Remove a category. All items in it move to reassign_to (default 'other')."""
        data = request.json or {}
        name = (data.get("name") or "").strip().lower()
        reassign_to = (data.get("reassign_to") or "other").strip().lower()
        if not name:
            return jsonify({"error": "name required"}), 400
        if name == "@aisles":
            return jsonify({"error": "@aisles is reserved"}), 400
        if reassign_to == "@aisles":
            return jsonify({"error": "Cannot reassign to @aisles"}), 400
        kitchen_path = DATA_DIR / "kitchen.json"
        gdata = json.loads(kitchen_path.read_text()) if kitchen_path.exists() else {}
        order = gdata.get("category_order") or []
        gdata["category_order"] = [c for c in order if c != name]
        cm = gdata.get("category_map") or {}
        moved = 0
        for k, v in list(cm.items()):
            if v == name:
                cm[k] = reassign_to
                moved += 1
        for it in gdata.get("items", []) or []:
            if it.get("category") == name:
                it["category"] = reassign_to
                moved += 1
        kitchen_path.write_text(json.dumps(gdata, indent=2))
        return jsonify({"ok": True, "moved": moved})

    @app.route("/api/kitchen/category-order", methods=["POST"])
    def save_category_order():
        data = request.json
        order = data.get("order", [])
        kitchen_path = DATA_DIR / "kitchen.json"
        gdata = json.loads(kitchen_path.read_text()) if kitchen_path.exists() else {"items": [], "category_map": {}}
        gdata["category_order"] = order
        kitchen_path.write_text(json.dumps(gdata, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/kitchen/meal-notes", methods=["GET"])
    def get_meal_notes():
        path = DATA_DIR / "meal_notes.json"
        notes = json.loads(path.read_text()) if path.exists() else []
        return jsonify({"notes": notes})

    @app.route("/api/kitchen/meal-notes", methods=["POST"])
    def add_meal_note():
        data = request.json
        text = data.get("text", "").strip()
        if not text:
            return jsonify({"error": "empty note"}), 400
        path = DATA_DIR / "meal_notes.json"
        notes = json.loads(path.read_text()) if path.exists() else []
        today = datetime.now().strftime("%Y-%m-%d")
        notes.insert(0, {"date": today, "text": text})
        notes = notes[:50]
        path.write_text(json.dumps(notes, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/kitchen/meal-notes/delete", methods=["POST"])
    def delete_meal_note():
        data = request.json
        idx = data.get("index", -1)
        path = DATA_DIR / "meal_notes.json"
        notes = json.loads(path.read_text()) if path.exists() else []
        if 0 <= idx < len(notes):
            notes.pop(idx)
            path.write_text(json.dumps(notes, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/kitchen/catalog/add", methods=["POST"])
    def add_catalog_item():
        data = request.json
        name = data["name"].strip().lower()
        category = data.get("category", "other").strip().lower()
        kitchen_path = DATA_DIR / "kitchen.json"
        gdata = json.loads(kitchen_path.read_text()) if kitchen_path.exists() else {"items": [], "category_map": {}}
        cat_map = gdata.setdefault("category_map", {})
        if name not in cat_map or category != "other":
            cat_map[name] = category
        kitchen_path.write_text(json.dumps(gdata, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/kitchen/catalog/remove", methods=["POST"])
    def remove_catalog_item():
        data = request.json
        name = data["name"].strip().lower()
        kitchen_path = DATA_DIR / "kitchen.json"
        gdata = json.loads(kitchen_path.read_text()) if kitchen_path.exists() else {"items": [], "category_map": {}}
        gdata.get("category_map", {}).pop(name, None)
        gdata.get("purchase_counts", {}).pop(name, None)
        kitchen_path.write_text(json.dumps(gdata, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/kitchen/catalog/rename", methods=["POST"])
    def rename_catalog_item():
        """Rename a catalog item. Migrates ALL related maps + preserves user's display casing.
        new_display preserves the casing the user typed; new_name is the canonical lowercase key.
        """
        data = request.json
        old = data["old_name"].strip().lower()
        new_display = data["new_name"].strip()
        new = new_display.lower()
        if not new or old == new:
            return jsonify({"ok": True, "noop": True})
        kitchen_path = DATA_DIR / "kitchen.json"
        gdata = json.loads(kitchen_path.read_text()) if kitchen_path.exists() else {"items": [], "category_map": {}}
        # Migrate every map that's keyed by the catalog name (lowercase)
        for mapname in ("category_map", "purchase_counts", "aisles", "item_notes", "last_bought", "pantry"):
            m = gdata.get(mapname)
            if isinstance(m, dict) and old in m:
                m[new] = m.pop(old)
        # Update items on the active list — preserve user's display casing
        for item in gdata.get("items", []) or []:
            if item.get("name", "").lower() == old:
                item["name"] = new_display
        kitchen_path.write_text(json.dumps(gdata, indent=2))

        # Migrate catalog_name in grocery_trips so historic line_items still link
        trips_path = DATA_DIR / "grocery_trips.json"
        if trips_path.exists():
            tdata = json.loads(trips_path.read_text())
            changed = False
            for trip in tdata.get("trips", []):
                for li in trip.get("line_items", []) or []:
                    if (li.get("catalog_name") or "").lower() == old:
                        li["catalog_name"] = new
                        changed = True
            if changed:
                trips_path.write_text(json.dumps(tdata, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/kitchen/catalog/note", methods=["POST"])
    def save_catalog_note():
        data = request.json
        name = data["name"].strip().lower()
        note = data.get("note", "").strip()
        kitchen_path = DATA_DIR / "kitchen.json"
        gdata = json.loads(kitchen_path.read_text()) if kitchen_path.exists() else {"items": [], "category_map": {}}
        notes = gdata.setdefault("item_notes", {})
        if note:
            notes[name] = note
        else:
            notes.pop(name, None)
        kitchen_path.write_text(json.dumps(gdata, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/kitchen/trips/log", methods=["POST"])
    def log_kitchen_trip():
        data = request.json
        date = data.get("date") or datetime.now().strftime("%Y-%m-%d")
        trips_path = DATA_DIR / "kitchen_trips.json"
        tdata = json.loads(trips_path.read_text()) if trips_path.exists() else {"trips": []}
        if not any(t["date"] == date for t in tdata["trips"]):
            tdata["trips"].append({"date": date})
            tdata["trips"].sort(key=lambda t: t["date"])
        trips_path.write_text(json.dumps(tdata, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/kitchen/trips/remove", methods=["POST"])
    def remove_kitchen_trip():
        data = request.json
        date = data["date"]
        trips_path = DATA_DIR / "kitchen_trips.json"
        tdata = json.loads(trips_path.read_text()) if trips_path.exists() else {"trips": []}
        tdata["trips"] = [t for t in tdata["trips"] if t["date"] != date]
        trips_path.write_text(json.dumps(tdata, indent=2))
        activity_path = DATA_DIR / "activity_log.json"
        if activity_path.exists():
            adata = json.loads(activity_path.read_text())
            adata["entries"] = [e for e in adata["entries"] if not (e["date"] == date and e["type"] == "kitchen")]
            activity_path.write_text(json.dumps(adata, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/meal-defaults/vegetables", methods=["POST"])
    def update_meal_prep_vegetables():
        data = request.json
        vegetables = data.get("vegetables", [])
        meal_path = DATA_DIR / "meal_defaults.json"
        meal = json.loads(meal_path.read_text()) if meal_path.exists() else {}
        if "meal_prep" not in meal:
            meal["meal_prep"] = {}
        meal["meal_prep"]["vegetables"] = vegetables
        meal_path.write_text(json.dumps(meal, indent=2))
        return jsonify({"ok": True})

    # --- Receipt scanner: upload photo + push to claude in 'receipts' tmux session ---

    BUILD_DIR = Path(__file__).parent
    RECEIPTS_DIR = BUILD_DIR / "receipts"
    GROCERY_RECEIPTS_DIR = RECEIPTS_DIR / "grocery"
    # Fallback location for parsed receipts when grocery/ is unwriteable for Claude
    # (older root-owned uploads). Both dirs are scanned by the list/preview/import endpoints.
    GROCERY_RECEIPTS_DIRS = [RECEIPTS_DIR / "grocery", RECEIPTS_DIR / "grocery_parsed"]
    SESSIONS_PATH = BUILD_DIR / "sessions.json"
    TMUX_SOCKET = "/tmp/tmux-1000/default"

    def _find_parsed_receipt(filename):
        """Locate a .parsed.json across the search dirs. Returns Path or None."""
        for d in GROCERY_RECEIPTS_DIRS:
            p = d / filename
            try:
                if p.exists() and str(p.resolve()).startswith(str(d.resolve())):
                    return p
            except OSError:
                continue
        return None

    def _slug(s):
        s = (s or "").lower()
        s = re.sub(r"[^a-z0-9]+", "-", s)
        return s.strip("-")[:30] or "unknown"

    def _tmux(cmd_str):
        return subprocess.run(
            f"tmux -S {TMUX_SOCKET} {cmd_str}",
            shell=True, capture_output=True, text=True
        )

    def _ensure_receipts_session():
        """Create 'receipts' tmux session running Claude Code, and add to sessions.json."""
        RECEIPTS_DIR.mkdir(parents=True, exist_ok=True)
        # Make sure session is in the persistent list
        sessions = []
        if SESSIONS_PATH.exists():
            try:
                sessions = json.loads(SESSIONS_PATH.read_text())
            except json.JSONDecodeError:
                sessions = []
        if "receipts" not in sessions:
            sessions.append("receipts")
            SESSIONS_PATH.write_text(json.dumps(sessions, indent=2))
        # Create tmux session if missing — auto-start claude in receipts dir
        check = _tmux("has-session -t receipts")
        if check.returncode != 0:
            cmd = f"new-session -d -s receipts -c {shlex.quote(str(RECEIPTS_DIR))} 'claude'"
            _tmux(cmd)
            return True  # newly spawned
        return False

    def _send_receipts_prompt(text, delay=4.0):
        """Send text to the receipts session after a delay (lets Claude finish loading)."""
        def _send():
            time.sleep(delay)
            safe = text.replace("'", "'\\''")
            _tmux(f"send-keys -t receipts -l '{safe}'")
            _tmux("send-keys -t receipts Enter")
        threading.Thread(target=_send, daemon=True).start()

    @app.route("/api/kitchen/scan-receipt", methods=["POST"])
    def scan_receipt():
        if "photo" not in request.files:
            return jsonify({"error": "No photo uploaded"}), 400
        f = request.files["photo"]
        if not f.filename:
            return jsonify({"error": "Empty filename"}), 400

        ext = Path(f.filename).suffix.lower() or ".jpg"
        if ext not in {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".pdf"}:
            return jsonify({"error": f"Unsupported extension: {ext}"}), 400

        date_part = datetime.now().strftime("%Y-%m-%d")
        store_slug = _slug(request.form.get("store") or "receipt")
        ts = datetime.now().strftime("%H%M%S")
        fname = f"{date_part}-{store_slug}-{ts}{ext}"
        GROCERY_RECEIPTS_DIR.mkdir(parents=True, exist_ok=True)
        target = GROCERY_RECEIPTS_DIR / fname
        f.save(str(target))

        # Flask runs as root; Claude-in-tmux runs as bradie. Make dir + photo
        # writable so Claude can drop the sibling .parsed.json next to the photo.
        try:
            import os
            os.chmod(GROCERY_RECEIPTS_DIR, 0o777)
            os.chmod(target, 0o666)
        except OSError:
            pass

        # Path Claude will see (relative to receipts/ — which is the cwd of the receipts session)
        rel_path = f"grocery/{fname}"

        newly_spawned = _ensure_receipts_session()
        prompt = f"new grocery receipt uploaded: {rel_path} — please parse it per CLAUDE.md and append the result to data/grocery_trips.json"
        _send_receipts_prompt(prompt, delay=(6.0 if newly_spawned else 1.5))

        return jsonify({
            "ok": True,
            "filename": fname,
            "session": "receipts",
            "newly_spawned": newly_spawned,
        })

    # --- Rules-based grocery receipt parser (consumes Claude's transcription) ---

    GROCERY_RULES_PATH = DATA_DIR / "grocery_item_rules.json"

    def _load_grocery_rules():
        if not GROCERY_RULES_PATH.exists():
            return {"patterns": []}
        return json.loads(GROCERY_RULES_PATH.read_text())

    def _save_grocery_rules(rules):
        GROCERY_RULES_PATH.write_text(json.dumps(rules, indent=2))

    def _categorize_grocery_item(name, rules, kitchen_catalog):
        """Return (category, catalog_name) by substring match against rules + catalog."""
        nlow = (name or "").lower()
        # 1) Custom rules — first substring match wins
        for p in rules.get("patterns", []):
            if p.get("match", "").lower() in nlow:
                return p.get("category", "other"), p.get("catalog_name", "")
        # 2) Kitchen catalog substring match
        for cat_name, cat in (kitchen_catalog or {}).items():
            if cat_name in nlow:
                return cat, cat_name
        return None, None  # uncategorized — needs user input

    @app.route("/api/kitchen/parsed-receipts/list")
    def list_parsed_receipts():
        """Return parsed-but-not-yet-imported grocery receipts."""
        results = []
        seen = set()
        for d in GROCERY_RECEIPTS_DIRS:
            if not d.exists():
                continue
            for parsed in sorted(d.glob("*.parsed.json")):
                if parsed.name in seen:
                    continue
                seen.add(parsed.name)
                marker = parsed.with_suffix(".imported")
                if marker.exists():
                    continue
                try:
                    pdata = json.loads(parsed.read_text())
                except (json.JSONDecodeError, OSError):
                    continue
                results.append({
                    "filename": parsed.name,
                    "photo": parsed.name.replace(".parsed.json", ""),
                    "store": pdata.get("store", ""),
                    "date": pdata.get("date", ""),
                    "total": pdata.get("total", 0),
                    "items_count": len(pdata.get("line_items", [])),
                })
        return jsonify({"receipts": results})

    @app.route("/api/kitchen/parsed-receipts/preview", methods=["POST"])
    def preview_parsed_receipt():
        data = request.json
        filename = data.get("filename", "")
        path = _find_parsed_receipt(filename)
        if not path:
            return jsonify({"error": "File not found"}), 404
        pdata = json.loads(path.read_text())
        rules = _load_grocery_rules()
        kitchen_path = DATA_DIR / "kitchen.json"
        kitchen_catalog = {}
        if kitchen_path.exists():
            kitchen_catalog = json.loads(kitchen_path.read_text()).get("category_map", {})
        rows = []
        for item in pdata.get("line_items", []):
            cat, catalog = _categorize_grocery_item(item.get("name", ""), rules, kitchen_catalog)
            rows.append({
                "name": item.get("name", ""),
                "qty": item.get("qty", 1),
                "price": item.get("price", 0),
                "unit_price": item.get("unit_price"),
                "category": cat or "",
                "catalog_name": catalog or "",
                "include": True,
            })
        return jsonify({
            "rows": rows,
            "header": {
                "store": pdata.get("store", ""),
                "date": pdata.get("date", ""),
                "subtotal": pdata.get("subtotal", 0),
                "tax": pdata.get("tax", 0),
                "total": pdata.get("total", 0),
                "saved": pdata.get("saved", 0),
            },
        })

    @app.route("/api/kitchen/parsed-receipts/import", methods=["POST"])
    def import_parsed_receipt():
        data = request.json
        filename = data.get("filename", "")
        selections = data.get("selections", [])
        learn_rules = data.get("learn_rules", [])  # [{match, category, catalog_name}]
        update_pantry = bool(data.get("update_pantry", True))
        path = _find_parsed_receipt(filename)
        if not path:
            return jsonify({"error": "File not found"}), 404
        pdata = json.loads(path.read_text())

        # Build the trip entry
        included = [s for s in selections if s.get("include")]
        # Trip item count = total UNITS bought (so 2× rice pudding counts as 2),
        # matching the receipt's "ITEMS PURCHASED" footer convention.
        unit_count = sum(int(s.get("qty") or 1) for s in included)
        trip = {
            "date": pdata.get("date") or datetime.now().strftime("%Y-%m-%d"),
            "store": pdata.get("store", ""),
            "total": pdata.get("total", 0),
            "saved": pdata.get("saved", 0),
            "items": unit_count,
            "line_count": len(included),
            "receipt": f"receipts/grocery/{filename.replace('.parsed.json', '')}",
            "line_items": [
                {
                    "name": s.get("name", ""),
                    "qty": s.get("qty", 1),
                    "price": s.get("price", 0),
                    "category": s.get("category", "other"),
                    "catalog_name": s.get("catalog_name", ""),
                }
                for s in included
            ],
        }

        # Create a Money-tab expense entry for this trip + link the receipt photo to it.
        # Future bank-statement CSV imports should match by (date, amount) within $0.10
        # against entries with category='Groceries' to dedup; that match logic lives in
        # routes_money.py's CSV import handler (TODO).
        expenses_path = DATA_DIR / "expenses.json"
        edata = json.loads(expenses_path.read_text()) if expenses_path.exists() else {"items": []}
        # Idempotency: skip if an expense with same date+amount+receipt already exists
        receipt_rel = trip["receipt"]
        existing_expense = next(
            (e for e in edata["items"]
             if e.get("date") == trip["date"]
             and abs(float(e.get("amount", 0)) - float(trip["total"])) < 0.01
             and e.get("receipt") == receipt_rel),
            None,
        )
        if existing_expense:
            expense_id = existing_expense["id"]
        else:
            expense_id = str(uuid.uuid4())
            store_label = trip["store"] or "Grocery"
            comments_bits = [store_label, f"{trip['items']} units"]
            if trip.get("saved"):
                comments_bits.append(f"saved ${trip['saved']:.2f}")
            edata["items"].append({
                "id": expense_id,
                "date": trip["date"],
                "amount": float(trip["total"]),
                "category": "Groceries",
                "comments": " · ".join(comments_bits),
                "receipt": receipt_rel,
                "source": "receipt_import",
            })
            expenses_path.write_text(json.dumps(edata, indent=2))

        # Stamp expense_id back onto the trip so it's bi-directionally linked
        trip["expense_id"] = expense_id

        # Also register in expense_receipts.json so Money-tab receipt UI shows it
        er_path = DATA_DIR / "expense_receipts.json"
        emap = json.loads(er_path.read_text()) if er_path.exists() else {}
        emap[expense_id] = {"filename": filename.replace(".parsed.json", ""), "parsed": True}
        er_path.write_text(json.dumps(emap, indent=2))

        # Append to grocery_trips.json (or update matching date+store entry)
        trips_path = DATA_DIR / "grocery_trips.json"
        tdata = json.loads(trips_path.read_text()) if trips_path.exists() else {"trips": []}
        merged = False
        for existing in tdata["trips"]:
            if existing.get("date") == trip["date"] and existing.get("store", "") == trip["store"] and not existing.get("line_items"):
                # Update placeholder trip with full data
                existing.update(trip)
                merged = True
                break
        if not merged:
            tdata["trips"].append(trip)
        trips_path.write_text(json.dumps(tdata, indent=2))

        # Update kitchen catalog + pantry + purchase counts + aisles from chosen catalog_names
        kitchen_path = DATA_DIR / "kitchen.json"
        gdata = json.loads(kitchen_path.read_text()) if kitchen_path.exists() else {"items": [], "category_map": {}, "pantry": {}}
        cat_map = gdata.setdefault("category_map", {})
        pantry = gdata.setdefault("pantry", {}) if update_pantry else {}
        counts = gdata.setdefault("purchase_counts", {})
        aisles = gdata.setdefault("aisles", {})
        last_bought = gdata.setdefault("last_bought", {})  # name -> YYYY-MM-DD
        trip_date = trip["date"]
        today = datetime.now().strftime("%Y-%m-%d")
        for s in included:
            cn = (s.get("catalog_name") or "").strip().lower()
            if not cn:
                continue
            cat_map[cn] = s.get("category", "other")
            counts[cn] = counts.get(cn, 0) + int(s.get("qty") or 1)
            last_bought[cn] = trip_date
            # Aisle: only set when provided (non-empty truthy int). Clearing not supported here.
            aisle_val = s.get("aisle")
            if aisle_val not in (None, "", 0):
                try:
                    aisles[cn] = int(aisle_val)
                except (TypeError, ValueError):
                    pass
            if update_pantry:
                pantry[cn] = {"added": today}
        kitchen_path.write_text(json.dumps(gdata, indent=2))

        # Also patch kitchen_trips.json (the trip-log table) with totals so the
        # spend-trend view can use a single source of truth.
        ktrips_path = DATA_DIR / "kitchen_trips.json"
        ktdata = json.loads(ktrips_path.read_text()) if ktrips_path.exists() else {"trips": []}
        patched = False
        for kt in ktdata["trips"]:
            if kt.get("date") == trip["date"]:
                kt["store"] = trip["store"]
                kt["total"] = trip["total"]
                kt["saved"] = trip["saved"]
                kt["items"] = trip["items"]
                kt["receipt"] = trip["receipt"]
                patched = True
                break
        if not patched:
            ktdata["trips"].append({
                "date": trip["date"],
                "store": trip["store"],
                "total": trip["total"],
                "saved": trip["saved"],
                "items": trip["items"],
                "receipt": trip["receipt"],
            })
            ktdata["trips"].sort(key=lambda t: t.get("date", ""))
        ktrips_path.write_text(json.dumps(ktdata, indent=2))

        # Learn new merchant rules (substring match → category + catalog_name)
        rules = _load_grocery_rules()
        learned = 0
        for lr in learn_rules:
            match = (lr.get("match") or "").strip().lower()
            category = (lr.get("category") or "").strip()
            catalog_name = (lr.get("catalog_name") or "").strip()
            if not match or not category:
                continue
            if any(p.get("match", "").lower() == match for p in rules["patterns"]):
                continue
            rules["patterns"].append({"match": match, "category": category, "catalog_name": catalog_name})
            learned += 1
        if learned:
            _save_grocery_rules(rules)

        # Mark the parsed file as imported
        path.with_suffix(".imported").write_text(today)

        return jsonify({
            "ok": True,
            "trip_items": len(included),
            "rules_learned": learned,
        })
