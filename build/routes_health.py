"""Health, HRT, supplements, contacts, food, symptoms, runs, activity, and meetings routes."""
from flask import request, jsonify
from datetime import datetime, timedelta
from data_helpers import DATA_DIR, TULKU_DIR
import json
import pandas as pd


def _activity_log_add(date, atype):
    """Add (date, type) to activity_log.json if not already present."""
    activity_path = DATA_DIR / "activity_log.json"
    adata = json.loads(activity_path.read_text()) if activity_path.exists() else {"entries": []}
    if not any(e["date"] == date and e["type"] == atype for e in adata["entries"]):
        adata["entries"].append({"date": date, "type": atype})
        adata["entries"].sort(key=lambda e: e["date"])
        activity_path.write_text(json.dumps(adata, indent=2))


def _activity_log_remove(date, atype):
    activity_path = DATA_DIR / "activity_log.json"
    if not activity_path.exists():
        return
    adata = json.loads(activity_path.read_text())
    adata["entries"] = [e for e in adata["entries"] if not (e["date"] == date and e["type"] == atype)]
    activity_path.write_text(json.dumps(adata, indent=2))


def register(app):

    # --- HRT ---

    @app.route("/api/hrt/done", methods=["POST"])
    def hrt_done():
        hrt_path = DATA_DIR / "hrt.json"
        hrt = json.loads(hrt_path.read_text())
        hrt["prev_last_dose"] = hrt.get("last_dose")
        hrt["prev_next_due"] = hrt.get("next_due")
        data = request.json or {}
        dose_date = data.get("date") or datetime.now().strftime("%Y-%m-%d")
        cycle = hrt.get("cycle_days", 5)
        dose_dt = datetime.strptime(dose_date, "%Y-%m-%d")
        next_due = (dose_dt + timedelta(days=cycle)).strftime("%Y-%m-%d")
        hrt["last_dose"] = dose_date
        hrt["next_due"] = next_due
        hrt_path.write_text(json.dumps(hrt, indent=2))
        _activity_log_add(dose_date, "estradiol")
        return jsonify({"ok": True, "next_due": next_due})

    @app.route("/api/hrt/undo", methods=["POST"])
    def hrt_undo():
        hrt_path = DATA_DIR / "hrt.json"
        hrt = json.loads(hrt_path.read_text())
        if hrt.get("prev_last_dose") is not None:
            undone_dose = hrt.get("last_dose")
            hrt["last_dose"] = hrt.pop("prev_last_dose")
            hrt["next_due"] = hrt.pop("prev_next_due")
            hrt_path.write_text(json.dumps(hrt, indent=2))
            if undone_dose:
                _activity_log_remove(undone_dose, "estradiol")
            return jsonify({"ok": True})
        return jsonify({"error": "Nothing to undo"}), 400

    # --- Contacts ---

    @app.route("/api/contacts/log", methods=["POST"])
    def log_contact():
        data = request.json
        name = data["name"]
        method = data.get("method")
        contacts_path = DATA_DIR / "contacts.json"
        cdata = json.loads(contacts_path.read_text())
        date = data.get("date") or datetime.now().strftime("%Y-%m-%d")
        for c in cdata["contacts"]:
            if c["name"] == name:
                if not c["last_contact"] or date >= c["last_contact"]:
                    c["last_contact"] = date
                    c["method"] = method
                if "history" not in c:
                    c["history"] = []
                c["history"] = [h for h in c["history"] if h["date"] != date]
                c["history"].append({"date": date, "method": method})
                break
        contacts_path.write_text(json.dumps(cdata, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/contacts/add", methods=["POST"])
    def add_contact():
        data = request.json
        name = data["name"].strip()
        threshold = data.get("threshold_days", 14)
        contacts_path = DATA_DIR / "contacts.json"
        cdata = json.loads(contacts_path.read_text())
        if any(c["name"].lower() == name.lower() for c in cdata["contacts"]):
            return jsonify({"error": "Contact already exists"}), 400
        cdata["contacts"].append({
            "name": name,
            "threshold_days": threshold,
            "last_contact": None,
            "method": None,
        })
        contacts_path.write_text(json.dumps(cdata, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/contacts/remove", methods=["POST"])
    def remove_contact():
        data = request.json
        name = data["name"]
        contacts_path = DATA_DIR / "contacts.json"
        cdata = json.loads(contacts_path.read_text())
        cdata["contacts"] = [c for c in cdata["contacts"] if c["name"] != name]
        contacts_path.write_text(json.dumps(cdata, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/contacts/history/remove", methods=["POST"])
    def remove_contact_history():
        data = request.json
        name = data["name"]
        date = data["date"]
        method = data.get("method")
        contacts_path = DATA_DIR / "contacts.json"
        cdata = json.loads(contacts_path.read_text())
        for c in cdata["contacts"]:
            if c["name"] == name:
                history = c.get("history", [])
                for i in range(len(history) - 1, -1, -1):
                    if history[i]["date"] == date and (method is None or history[i]["method"] == method):
                        history.pop(i)
                        break
                c["history"] = history
                if history:
                    latest = max(history, key=lambda h: h["date"])
                    c["last_contact"] = latest["date"]
                    c["method"] = latest["method"]
                else:
                    c["last_contact"] = None
                    c["method"] = None
                break
        contacts_path.write_text(json.dumps(cdata, indent=2))
        return jsonify({"ok": True})

    # --- Meetings ---

    @app.route("/api/meeting/<filename>")
    def get_meeting(filename):
        filepath = TULKU_DIR / "meetings" / filename
        if not filepath.exists():
            return jsonify({"error": "Not found"}), 404
        return jsonify({"content": filepath.read_text()})

    # --- Food ---

    @app.route("/api/food/log", methods=["POST"])
    def log_food():
        data = request.json
        csv_path = TULKU_DIR / "habits.csv"
        target_date = data.get("date") or datetime.now().strftime("%Y-%m-%d")
        food = data["food"].strip()
        df = pd.read_csv(csv_path)
        df["date"] = pd.to_datetime(df["date"], format="mixed")
        target = pd.Timestamp(target_date)
        mask = df["date"] == target
        if mask.any():
            existing = df.loc[mask, "food_notes"].iloc[0]
            if pd.notna(existing) and str(existing).strip():
                df.loc[mask, "food_notes"] = str(existing) + "; " + food
            else:
                df.loc[mask, "food_notes"] = food
        else:
            new_row = {"date": target_date, "food_notes": food}
            df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
        df.to_csv(csv_path, index=False)
        return jsonify({"ok": True})

    # --- Symptoms ---

    @app.route("/api/symptoms", methods=["POST"])
    def log_symptoms():
        data = request.json
        csv_path = TULKU_DIR / "habits.csv"
        target_date = data["date"]
        symptoms = data["symptoms"]
        df = pd.read_csv(csv_path)
        df["date"] = pd.to_datetime(df["date"], format="mixed")
        target = pd.Timestamp(target_date)
        mask = df["date"] == target
        if mask.any():
            for col, val in symptoms.items():
                df.loc[mask, col] = val
        else:
            new_row = {"date": target}
            new_row.update(symptoms)
            df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
        df["date"] = pd.to_datetime(df["date"], format="mixed").dt.strftime("%Y-%m-%d")
        df.to_csv(csv_path, index=False)
        return jsonify({"ok": True})

    # --- Runs ---

    @app.route("/api/runs/log", methods=["POST"])
    def log_run():
        data = request.json
        date = data.get("date") or datetime.now().strftime("%Y-%m-%d")
        minutes = data.get("minutes")
        notes = data.get("notes", "").strip()
        run_path = DATA_DIR / "runs.json"
        rdata = json.loads(run_path.read_text()) if run_path.exists() else {"target_per_week": 3, "runs": []}
        rdata["runs"] = [r for r in rdata["runs"] if r["date"] != date]
        rdata["runs"].append({"date": date, "minutes": minutes, "notes": notes})
        rdata["runs"].sort(key=lambda r: r["date"])
        run_path.write_text(json.dumps(rdata, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/runs/remove", methods=["POST"])
    def remove_run():
        data = request.json
        date = data["date"]
        run_path = DATA_DIR / "runs.json"
        rdata = json.loads(run_path.read_text())
        rdata["runs"] = [r for r in rdata["runs"] if r["date"] != date]
        run_path.write_text(json.dumps(rdata, indent=2))
        return jsonify({"ok": True})

    # --- Activity ---

    @app.route("/api/activity/log", methods=["POST"])
    def log_activity():
        data = request.json
        date = data.get("date") or datetime.now().strftime("%Y-%m-%d")
        atype = data["type"]
        activity_path = DATA_DIR / "activity_log.json"
        adata = json.loads(activity_path.read_text()) if activity_path.exists() else {"entries": []}
        adata["entries"] = [e for e in adata["entries"] if not (e["date"] == date and e["type"] == atype)]
        adata["entries"].append({"date": date, "type": atype})
        adata["entries"].sort(key=lambda e: e["date"])
        activity_path.write_text(json.dumps(adata, indent=2))
        return jsonify({"ok": True})

    @app.route("/api/activity/remove", methods=["POST"])
    def remove_activity():
        data = request.json
        date = data["date"]
        atype = data["type"]
        activity_path = DATA_DIR / "activity_log.json"
        adata = json.loads(activity_path.read_text())
        adata["entries"] = [e for e in adata["entries"] if not (e["date"] == date and e["type"] == atype)]
        activity_path.write_text(json.dumps(adata, indent=2))
        return jsonify({"ok": True})
