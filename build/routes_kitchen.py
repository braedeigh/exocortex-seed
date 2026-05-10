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
        data = request.json
        old = data["old_name"].strip().lower()
        new = data["new_name"].strip().lower()
        kitchen_path = DATA_DIR / "kitchen.json"
        gdata = json.loads(kitchen_path.read_text()) if kitchen_path.exists() else {"items": [], "category_map": {}}
        cat_map = gdata.get("category_map", {})
        counts = gdata.get("purchase_counts", {})
        if old in cat_map:
            cat_map[new] = cat_map.pop(old)
        if old in counts:
            counts[new] = counts.pop(old)
        for item in gdata.get("items", []):
            if item["name"].lower() == old:
                item["name"] = new.capitalize()
        kitchen_path.write_text(json.dumps(gdata, indent=2))
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
    SESSIONS_PATH = BUILD_DIR / "sessions.json"
    TMUX_SOCKET = "/tmp/tmux-1000/default"

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
        if not GROCERY_RECEIPTS_DIR.exists():
            return jsonify({"receipts": []})
        results = []
        for parsed in sorted(GROCERY_RECEIPTS_DIR.glob("*.parsed.json")):
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
        path = GROCERY_RECEIPTS_DIR / filename
        if not path.exists() or not str(path.resolve()).startswith(str(GROCERY_RECEIPTS_DIR.resolve())):
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
        path = GROCERY_RECEIPTS_DIR / filename
        if not path.exists() or not str(path.resolve()).startswith(str(GROCERY_RECEIPTS_DIR.resolve())):
            return jsonify({"error": "File not found"}), 404
        pdata = json.loads(path.read_text())

        # Build the trip entry
        included = [s for s in selections if s.get("include")]
        trip = {
            "date": pdata.get("date") or datetime.now().strftime("%Y-%m-%d"),
            "store": pdata.get("store", ""),
            "total": pdata.get("total", 0),
            "saved": pdata.get("saved", 0),
            "items": len(included),
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

        # Update kitchen catalog + pantry from chosen catalog_names
        kitchen_path = DATA_DIR / "kitchen.json"
        gdata = json.loads(kitchen_path.read_text()) if kitchen_path.exists() else {"items": [], "category_map": {}, "pantry": {}}
        cat_map = gdata.setdefault("category_map", {})
        pantry = gdata.setdefault("pantry", {}) if update_pantry else {}
        today = datetime.now().strftime("%Y-%m-%d")
        for s in included:
            cn = (s.get("catalog_name") or "").strip().lower()
            if not cn:
                continue
            cat_map[cn] = s.get("category", "other")
            if update_pantry:
                pantry[cn] = {"added": today}
        kitchen_path.write_text(json.dumps(gdata, indent=2))

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
