from flask import Flask, render_template, jsonify, request, session, redirect
from werkzeug.middleware.proxy_fix import ProxyFix
from pathlib import Path
import json
import hashlib
import secrets
import traceback
from datetime import datetime, timedelta

from data_helpers import (
    BUILD_DIR, DATA_DIR, TULKU_DIR,
    parse_md_sections, load_health_data,
    load_todos, roll_todos, todos_to_sections,
    validate_on_startup,
)
from public_config import filter_for_view, is_public_path
import routes_kitchen
import routes_habits
import routes_todos
import routes_health
import routes_inventory
import routes_money
import routes_terminal

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)
app.config['TEMPLATES_AUTO_RELOAD'] = True

# --- Logging ---
from logging.handlers import RotatingFileHandler
import logging
LOG_PATH = Path(__file__).parent / "server.log"
file_handler = RotatingFileHandler(LOG_PATH, maxBytes=1_000_000, backupCount=1)
file_handler.setFormatter(logging.Formatter(
    "%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
))
file_handler.setLevel(logging.WARNING)
app.logger.addHandler(file_handler)
app.logger.setLevel(logging.INFO)

# Request logging
ACCESS_LOG = Path(__file__).parent / "access.log"
access_handler = RotatingFileHandler(ACCESS_LOG, maxBytes=500_000, backupCount=1)
access_handler.setFormatter(logging.Formatter("%(asctime)s %(message)s", datefmt="%H:%M:%S"))
access_handler.setLevel(logging.INFO)
access_logger = logging.getLogger('access')
access_logger.addHandler(access_handler)
access_logger.setLevel(logging.INFO)

@app.after_request
def log_request(response):
    if request.path.startswith('/api/'):
        access_logger.info(f"{request.method} {request.path} → {response.status_code}")
    return response

# Cache-busting
@app.context_processor
def static_versioning():
    def versioned_static(filename):
        filepath = Path(__file__).parent / "static" / filename
        try:
            mtime = int(filepath.stat().st_mtime)
        except FileNotFoundError:
            mtime = 0
        return f"/static/{filename}?v={mtime}"
    return dict(v_static=versioned_static)

# Session auth
auth_path = Path(__file__).parent / "auth.json"
if auth_path.exists():
    _auth = json.loads(auth_path.read_text())
    app.secret_key = _auth["secret_key"]
    AUTH_HASH = _auth["password_hash"]
else:
    sk = secrets.token_hex(32)
    ph = hashlib.sha256("exocortex".encode()).hexdigest()
    auth_path.write_text(json.dumps({"secret_key": sk, "password_hash": ph}, indent=2))
    app.secret_key = sk
    AUTH_HASH = ph

app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=90)


@app.before_request
def gate():
    request.view_mode = "authed" if session.get('authed') else "public"
    if request.view_mode == "authed":
        return
    if is_public_path(request.path):
        return
    if request.path.startswith('/api/'):
        return jsonify({"error": "unauthorized"}), 401
    return redirect('/login')


@app.context_processor
def inject_view_mode():
    from flask import has_request_context
    if has_request_context():
        return {"view_mode": getattr(request, "view_mode", "authed")}
    return {"view_mode": "authed"}


def get_code_hash():
    h = hashlib.md5()
    for f in sorted(Path(__file__).parent.glob("templates/*.html")):
        h.update(f.read_bytes())
    h.update(Path(__file__).read_bytes())
    return h.hexdigest()[:12]


# --- Page routes ---

# --- Login rate limiting ---
# In-memory sliding window per IP. Per-worker (gunicorn = 2 workers, so effective
# cap is ~2x). Good enough to neuter brute force; not a substitute for a real
# distributed limiter.
import time
_LOGIN_FAILS = {}            # ip -> [timestamp, ...]
LOGIN_WINDOW_SEC = 300       # 5-minute window
LOGIN_MAX_FAILS = 5          # max failures per window before lockout


def _check_login_rate(ip):
    """Return (allowed, retry_after_sec). Prunes stale entries as a side-effect."""
    now = time.time()
    fails = [t for t in _LOGIN_FAILS.get(ip, []) if now - t < LOGIN_WINDOW_SEC]
    _LOGIN_FAILS[ip] = fails
    if len(fails) >= LOGIN_MAX_FAILS:
        retry = int(LOGIN_WINDOW_SEC - (now - fails[0])) + 1
        return False, retry
    return True, 0


def _record_login_fail(ip):
    _LOGIN_FAILS.setdefault(ip, []).append(time.time())


def _clear_login_fails(ip):
    _LOGIN_FAILS.pop(ip, None)


@app.route("/login", methods=["GET", "POST"])
def login():
    ip = request.remote_addr or "unknown"
    if request.method == "POST":
        allowed, retry_after = _check_login_rate(ip)
        if not allowed:
            app.logger.warning(f"Login rate-limited: {ip} (retry in {retry_after}s)")
            mins = max(1, retry_after // 60)
            resp = render_template(
                "login.html",
                error=f"Too many attempts. Try again in ~{mins} minute{'s' if mins != 1 else ''}.",
            )
            return resp, 429, {"Retry-After": str(retry_after)}
        pw = request.form.get("password", "")
        if hashlib.sha256(pw.encode()).hexdigest() == AUTH_HASH:
            _clear_login_fails(ip)
            session.permanent = True
            session['authed'] = True
            return redirect('/')
        _record_login_fail(ip)
        app.logger.warning(f"Login failed: {ip}")
        return render_template("login.html", error="Wrong password")
    return render_template("login.html", error=None)


@app.route("/logout")
def logout():
    session.clear()
    return redirect('/login')


@app.route("/api/version")
def version():
    return jsonify({"hash": get_code_hash()})


@app.route("/api/auth-check")
def auth_check():
    return "", 204


VALID_TABS = ("today", "map", "kitchen", "inventory", "money")
LANDING_HOSTS = ("mudscryer.org", "www.mudscryer.org")


def _split_response(active_tab, item_name=""):
    resp = app.make_response(render_template("split.html", active_tab=active_tab, item_name=item_name))
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return resp


def _request_host():
    return (request.host or "").split(":")[0].lower()


@app.route("/")
@app.route("/dashboard")
def split_today():
    if _request_host() in LANDING_HOSTS:
        return render_template("mudscryer.html")
    return _split_response("today")


@app.route("/map")
def split_map():
    return _split_response("map")


@app.route("/kitchen")
def split_kitchen():
    return _split_response("kitchen")


@app.route("/inventory")
def split_inventory():
    return _split_response("inventory")


@app.route("/money")
def split_money():
    return _split_response("money")


@app.route("/item/buy/<path:name>")
def split_item_buy(name):
    return _split_response("inventory", item_name=name)


@app.route("/tab/<name>")
def tab_view(name):
    """Iframe content endpoint — renders index.html for the given tab."""
    if name not in VALID_TABS:
        return redirect("/")
    item_name = request.args.get("item", "")
    resp = app.make_response(render_template("index.html", active_tab=name, item_name=item_name))
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return resp


@app.route("/about")
def about_page():
    return render_template("about.html")


@app.route("/mudscryer")
def mudscryer_page():
    return render_template("mudscryer.html")


# --- Dev Notes (per-tab friction log) ---

def _load_dev_notes():
    p = DATA_DIR / "dev_notes.json"
    if not p.exists():
        return {"tabs": {}}
    return json.loads(p.read_text())


def _save_dev_notes(d):
    (DATA_DIR / "dev_notes.json").write_text(json.dumps(d, indent=2))


@app.route("/api/devnote/add", methods=["POST"])
def add_devnote():
    data = request.json
    tab = (data.get("tab") or "").strip()
    text = (data.get("text") or "").strip()
    if not tab or not text:
        return jsonify({"error": "tab and text required"}), 400
    d = _load_dev_notes()
    d.setdefault("tabs", {}).setdefault(tab, []).append({
        "id": secrets.token_hex(4),
        "text": text,
        "created": datetime.now().strftime("%Y-%m-%d %H:%M"),
    })
    _save_dev_notes(d)
    return jsonify({"ok": True})


@app.route("/api/devnote/remove", methods=["POST"])
def remove_devnote():
    data = request.json
    tab = data.get("tab", "")
    nid = data.get("id", "")
    d = _load_dev_notes()
    notes = d.get("tabs", {}).get(tab, [])
    d["tabs"][tab] = [n for n in notes if n.get("id") != nid]
    _save_dev_notes(d)
    return jsonify({"ok": True})


# --- Journal ---

@app.route("/journal-view")
def journal_view():
    return render_template("journal.html")


@app.route("/api/journal/dates")
def journal_dates():
    daily_dir = TULKU_DIR / "Journal" / "Daily"
    dates = sorted(f.stem for f in daily_dir.glob("*.md"))
    return jsonify({"dates": dates})


@app.route("/api/journal/<date>")
def journal_get(date):
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "invalid date"}), 400
    path = TULKU_DIR / "Journal" / "Daily" / f"{date}.md"
    content = path.read_text() if path.exists() else ""
    daily_dir = TULKU_DIR / "Journal" / "Daily"
    dates = sorted(f.stem for f in daily_dir.glob("*.md"))
    idx = dates.index(date) if date in dates else -1
    prev_date = dates[idx - 1] if idx > 0 else None
    next_date = dates[idx + 1] if idx >= 0 and idx < len(dates) - 1 else None
    return jsonify({"date": date, "content": content, "prev": prev_date, "next": next_date})


@app.route("/api/journal/<date>", methods=["POST"])
def journal_save(date):
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "invalid date"}), 400
    data = request.json or {}
    content = data.get("content", "")
    path = TULKU_DIR / "Journal" / "Daily" / f"{date}.md"
    path.write_text(content)
    return jsonify({"ok": True})


# --- Data loading helpers ---

FOOD_GUIDE = {
    "safe": ["chicken", "white rice", "kale", "sweet potato", "carrots", "parsnips",
              "zucchini", "cucumber", "tahini", "rice cakes", "salad"],
    "hurts": ["chocolate covered coconut", "soy sauce", "olives", "pickled okra"],
    "unsure": ["sunflower seeds", "pumpkin seeds", "sweet potato chips"]
}


def _common_data():
    now = datetime.now()
    hour = now.hour
    if 5 <= hour < 11:
        time_of_day = "morning"
    elif 11 <= hour < 18:
        time_of_day = "afternoon"
    else:
        time_of_day = "evening"
    return {
        "time_of_day": time_of_day,
        "server_hour": now.hour + now.minute / 60,
        "server_day_of_year": now.timetuple().tm_yday,
        "server_date": now.strftime("%Y-%m-%d"),
        "date": now.strftime("%A, %B %-d"),
    }


def _load_hrt():
    now = datetime.now()
    hrt = {}
    hrt_path = DATA_DIR / "hrt.json"
    if hrt_path.exists():
        hrt = json.loads(hrt_path.read_text())
        if hrt.get("last_dose") and hrt.get("next_due"):
            last_dt = datetime.strptime(hrt["last_dose"], "%Y-%m-%d")
            next_dt = datetime.strptime(hrt["next_due"], "%Y-%m-%d")
            today = now.replace(hour=0, minute=0, second=0, microsecond=0)
            hrt["days_until"] = (next_dt - today).days
            hrt["last_formatted"] = last_dt.strftime("%b %d")
            hrt["next_formatted"] = next_dt.strftime("%b %d (%A)")
    return hrt


def _load_contacts():
    now = datetime.now()
    contacts = []
    contacts_path = DATA_DIR / "contacts.json"
    if contacts_path.exists():
        contacts = json.loads(contacts_path.read_text()).get("contacts", [])
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        for c in contacts:
            if c.get("last_contact"):
                last_dt = datetime.strptime(c["last_contact"], "%Y-%m-%d")
                c["days_since"] = (today - last_dt).days
            else:
                c["days_since"] = None
    return contacts


def _load_habits_log():
    habits_log_path = DATA_DIR / "habits_log.json"
    if habits_log_path.exists():
        return json.loads(habits_log_path.read_text())
    return {}


def _load_habits():
    habits_path = TULKU_DIR / "HABITS.md"
    return parse_md_sections(habits_path) if habits_path.exists() else []


def _load_habit_settings():
    habit_settings_path = DATA_DIR / "habit_settings.json"
    if habit_settings_path.exists():
        return json.loads(habit_settings_path.read_text())
    return {"hidden": []}


def _load_habit_starts():
    habit_starts_path = DATA_DIR / "habit_start_dates.json"
    if habit_starts_path.exists():
        return json.loads(habit_starts_path.read_text())
    return {}


def _load_activity_log():
    activity_path = DATA_DIR / "activity_log.json"
    if activity_path.exists():
        return json.loads(activity_path.read_text()).get("entries", [])
    return []


def _load_meal_defaults():
    meal_defaults_path = DATA_DIR / "meal_defaults.json"
    if meal_defaults_path.exists():
        return json.loads(meal_defaults_path.read_text())
    return {}


def _load_kitchen_data():
    kitchen_list = []
    kitchen_category_map = {}
    kitchen_purchase_counts = {}
    kitchen_item_notes = {}
    kitchen_pantry = {}
    kitchen_category_order = ['vegetables','produce','fruit','grains','drinks','snacks','dessert','other','dairy','protein','pharmacy','supplements']
    kitchen_path = DATA_DIR / "kitchen.json"
    if kitchen_path.exists():
        gdata = json.loads(kitchen_path.read_text())
        kitchen_list = gdata.get("items", [])
        kitchen_category_map = gdata.get("category_map", {})
        kitchen_purchase_counts = gdata.get("purchase_counts", {})
        kitchen_item_notes = gdata.get("item_notes", {})
        kitchen_pantry = gdata.get("pantry", {})
        kitchen_category_order = gdata.get("category_order", kitchen_category_order)
    return {
        "kitchen_list": kitchen_list,
        "kitchen_known_items": kitchen_category_map,
        "kitchen_purchase_counts": kitchen_purchase_counts,
        "kitchen_item_notes": kitchen_item_notes,
        "kitchen_pantry": kitchen_pantry,
        "kitchen_category_order": kitchen_category_order,
    }


# --- Tab-specific data endpoints ---

@app.route("/api/data/today")
def get_data_today():
  try:
    data = _common_data()

    habits = _load_habits()
    todo_data = load_todos()
    todo_data = roll_todos(todo_data)

    growth_path = DATA_DIR / "growth_notes.json"
    growth_notes = []
    if growth_path.exists():
        growth_notes = json.loads(growth_path.read_text()).get("items", [])

    applications = []
    apps_path = DATA_DIR / "shrike_applied.json"
    if apps_path.exists():
        applications = json.loads(apps_path.read_text())

    data.update({
        "hrt": _load_hrt(),
        "habits": habits,
        "habit_settings": _load_habit_settings(),
        "habit_starts": _load_habit_starts(),
        "growth_notes": growth_notes,
        "todos": todos_to_sections(todo_data),
        "habits_log": _load_habits_log(),
        "health_data": load_health_data(),
        "contacts": _load_contacts(),
        "applications": applications,
        "meal_defaults": _load_meal_defaults(),
        "food_guide": FOOD_GUIDE,
        "activity_log": _load_activity_log(),
    })
    return jsonify(filter_for_view(data, request.view_mode))
  except Exception as e:
    app.logger.error(f"/api/data/today failed: {e}\n{traceback.format_exc()}")
    return jsonify({"error": str(e)}), 500


@app.route("/api/data/map")
def get_data_map():
  try:
    data = _common_data()

    supplements = []
    supps_path = DATA_DIR / "supplements.json"
    if supps_path.exists():
        supps_data = json.loads(supps_path.read_text())
        supplements = supps_data.get("supplements", [])

    runs_data = {"target_per_week": 3, "runs": []}
    runs_path = DATA_DIR / "runs.json"
    if runs_path.exists():
        runs_data = json.loads(runs_path.read_text())

    kitchen_trips = []
    trips_path = DATA_DIR / "kitchen_trips.json"
    if trips_path.exists():
        kitchen_trips = json.loads(trips_path.read_text()).get("trips", [])

    data.update({
        "health_data": load_health_data(),
        "habits_log": _load_habits_log(),
        "habits": _load_habits(),
        "habit_starts": _load_habit_starts(),
        "habit_settings": _load_habit_settings(),
        "supplements": supplements,
        "runs": runs_data,
        "kitchen_trips": kitchen_trips,
        "activity_log": _load_activity_log(),
        "meal_defaults": _load_meal_defaults(),
        "food_guide": FOOD_GUIDE,
        "contacts": _load_contacts(),
    })
    return jsonify(filter_for_view(data, request.view_mode))
  except Exception as e:
    app.logger.error(f"/api/data/map failed: {e}\n{traceback.format_exc()}")
    return jsonify({"error": str(e)}), 500


@app.route("/api/data/inventory")
def get_data_inventory():
  try:
    data = _common_data()

    buy_list = []
    buy_path = DATA_DIR / "buy_list.json"
    if buy_path.exists():
        buy_list = json.loads(buy_path.read_text()).get("items", [])

    active_inventory = []
    active_path = DATA_DIR / "active_inventory.json"
    if active_path.exists():
        active_inventory = json.loads(active_path.read_text()).get("items", [])

    priority_notes = ""
    pn_path = DATA_DIR / "priority_notes.json"
    if pn_path.exists():
        priority_notes = json.loads(pn_path.read_text()).get("text", "")

    data.update({
        "buy_list": buy_list,
        "active_inventory": active_inventory,
        "priority_notes": priority_notes,
    })
    return jsonify(filter_for_view(data, request.view_mode))
  except Exception as e:
    app.logger.error(f"/api/data/inventory failed: {e}\n{traceback.format_exc()}")
    return jsonify({"error": str(e)}), 500


@app.route("/api/data/money")
def get_data_money():
  try:
    data = _common_data()

    budget = {"income_monthly": 0, "categories": []}
    bp = DATA_DIR / "budget.json"
    if bp.exists():
        budget = json.loads(bp.read_text())

    expenses = []
    ep = DATA_DIR / "expenses.json"
    if ep.exists():
        expenses = json.loads(ep.read_text()).get("items", [])

    subscriptions = []
    sp = DATA_DIR / "subscriptions.json"
    if sp.exists():
        subscriptions = json.loads(sp.read_text()).get("items", [])

    receipts_map = {}
    rp = DATA_DIR / "expense_receipts.json"
    if rp.exists():
        receipts_map = json.loads(rp.read_text())

    tax_setaside = []
    tp = DATA_DIR / "tax_setaside.json"
    if tp.exists():
        tax_setaside = json.loads(tp.read_text()).get("items", [])

    data.update({
        "budget": budget,
        "expenses": expenses,
        "subscriptions": subscriptions,
        "receipts_map": receipts_map,
        "tax_setaside": tax_setaside,
    })
    return jsonify(filter_for_view(data, request.view_mode))
  except Exception as e:
    app.logger.error(f"/api/data/money failed: {e}\n{traceback.format_exc()}")
    return jsonify({"error": str(e)}), 500


@app.route("/api/data/item-buy")
def get_data_item_buy():
  try:
    data = _common_data()
    name = request.args.get("name", "")
    item = None
    buy_path = DATA_DIR / "buy_list.json"
    if buy_path.exists():
        bdata = json.loads(buy_path.read_text())
        for i in bdata.get("items", []):
            if i["name"] == name:
                item = i
                break

    buy_list = []
    if buy_path.exists():
        buy_list = json.loads(buy_path.read_text()).get("items", [])

    active_inventory = []
    active_path = DATA_DIR / "active_inventory.json"
    if active_path.exists():
        active_inventory = json.loads(active_path.read_text()).get("items", [])

    all_categories = set()
    for i in buy_list + active_inventory:
        c = i.get("category", "").strip()
        if c:
            all_categories.add(c)
    known_categories = sorted(all_categories)

    data.update({
        "buy_item": item,
        "known_categories": known_categories,
    })
    return jsonify(filter_for_view(data, request.view_mode))
  except Exception as e:
    app.logger.error(f"/api/data/item-buy failed: {e}\n{traceback.format_exc()}")
    return jsonify({"error": str(e)}), 500


@app.route("/api/data/kitchen")
def get_data_kitchen():
  try:
    data = _common_data()

    meal_notes = []
    meal_notes_path = DATA_DIR / "meal_notes.json"
    if meal_notes_path.exists():
        meal_notes = json.loads(meal_notes_path.read_text())

    data.update(_load_kitchen_data())
    data["meal_notes"] = meal_notes
    data["dev_notes"] = _load_dev_notes().get("tabs", {}).get("kitchen", [])
    return jsonify(filter_for_view(data, request.view_mode))
  except Exception as e:
    app.logger.error(f"/api/data/kitchen failed: {e}\n{traceback.format_exc()}")
    return jsonify({"error": str(e)}), 500


# --- Legacy endpoint (loads everything) ---

@app.route("/api/data")
def get_data():
  try:
    data = _common_data()

    habits = _load_habits()
    todo_data = load_todos()
    todo_data = roll_todos(todo_data)

    growth_path = DATA_DIR / "growth_notes.json"
    growth_notes = []
    if growth_path.exists():
        growth_notes = json.loads(growth_path.read_text()).get("items", [])

    supplements = []
    supps_path = DATA_DIR / "supplements.json"
    if supps_path.exists():
        supps_data = json.loads(supps_path.read_text())
        supplements = supps_data.get("supplements", [])

    buy_list = []
    buy_path = DATA_DIR / "buy_list.json"
    if buy_path.exists():
        buy_list = json.loads(buy_path.read_text()).get("items", [])

    runs_data = {"target_per_week": 3, "runs": []}
    runs_path = DATA_DIR / "runs.json"
    if runs_path.exists():
        runs_data = json.loads(runs_path.read_text())

    kitchen_trips = []
    trips_path = DATA_DIR / "kitchen_trips.json"
    if trips_path.exists():
        kitchen_trips = json.loads(trips_path.read_text()).get("trips", [])

    meal_notes = []
    meal_notes_path = DATA_DIR / "meal_notes.json"
    if meal_notes_path.exists():
        meal_notes = json.loads(meal_notes_path.read_text())

    applications = []
    apps_path = DATA_DIR / "shrike_applied.json"
    if apps_path.exists():
        applications = json.loads(apps_path.read_text())

    data.update({
        "hrt": _load_hrt(),
        "habits": habits,
        "habit_settings": _load_habit_settings(),
        "habit_starts": _load_habit_starts(),
        "growth_notes": growth_notes,
        "todos": todos_to_sections(todo_data),
        "supplements": supplements,
        "health_data": load_health_data(),
        "contacts": _load_contacts(),
        "buy_list": buy_list,
        "habits_log": _load_habits_log(),
        "runs": runs_data,
        "activity_log": _load_activity_log(),
        "meal_defaults": _load_meal_defaults(),
        "food_guide": FOOD_GUIDE,
        "applications": applications,
    })
    data.update(_load_kitchen_data())
    data["meal_notes"] = meal_notes
    data["kitchen_trips"] = kitchen_trips
    return jsonify(data)
  except Exception as e:
    app.logger.error(f"/api/data failed: {e}\n{traceback.format_exc()}")
    return jsonify({"error": str(e)}), 500


# --- VS Code (code-server) launcher ---
import subprocess

VSCODE_MEMORY_THRESHOLD_MB = 1500


def _code_server_running():
    try:
        r = subprocess.run(["systemctl", "is-active", "code-server"],
                           capture_output=True, text=True, timeout=3)
        return r.stdout.strip() == "active"
    except Exception:
        return False


def _memory_status():
    info = {}
    with open("/proc/meminfo") as f:
        for line in f:
            key, _, val = line.partition(":")
            info[key.strip()] = int(val.strip().split()[0])  # kB
    return {
        "total_mb": info["MemTotal"] // 1024,
        "available_mb": info["MemAvailable"] // 1024,
    }


def _top_processes(n=5):
    try:
        r = subprocess.run(
            ["ps", "-eo", "rss,comm", "--sort=-rss", "--no-headers"],
            capture_output=True, text=True, timeout=3,
        )
        agg = {}
        for line in r.stdout.strip().split("\n"):
            parts = line.strip().split(None, 1)
            if len(parts) != 2:
                continue
            rss, comm = parts
            agg[comm] = agg.get(comm, 0) + int(rss)
        top = sorted(agg.items(), key=lambda x: -x[1])[:n]
        return [{"name": name, "mb": kb // 1024} for name, kb in top]
    except Exception:
        return []


@app.route("/vscode")
def vscode_launcher():
    return render_template("vscode_launcher.html")


@app.route("/api/vscode/status")
def vscode_status():
    mem = _memory_status()
    running = _code_server_running()
    ok_to_start = running or mem["available_mb"] >= VSCODE_MEMORY_THRESHOLD_MB
    return jsonify({
        "running": running,
        "available_mb": mem["available_mb"],
        "total_mb": mem["total_mb"],
        "threshold_mb": VSCODE_MEMORY_THRESHOLD_MB,
        "ok_to_start": ok_to_start,
        "top_processes": _top_processes() if not ok_to_start else [],
    })


@app.route("/api/vscode/start", methods=["POST"])
def vscode_start():
    mem = _memory_status()
    if not _code_server_running() and mem["available_mb"] < VSCODE_MEMORY_THRESHOLD_MB:
        return jsonify({
            "error": "insufficient memory",
            "available_mb": mem["available_mb"],
            "threshold_mb": VSCODE_MEMORY_THRESHOLD_MB,
        }), 409
    try:
        subprocess.run(["systemctl", "start", "code-server"],
                       check=True, timeout=10)
        return jsonify({"ok": True})
    except subprocess.CalledProcessError as e:
        return jsonify({"error": "start failed", "detail": str(e)}), 500


@app.route("/api/vscode/stop", methods=["POST"])
def vscode_stop():
    try:
        subprocess.run(["systemctl", "stop", "code-server"],
                       check=True, timeout=10)
        return jsonify({"ok": True})
    except subprocess.CalledProcessError as e:
        return jsonify({"error": "stop failed", "detail": str(e)}), 500


# --- Register route modules ---
routes_kitchen.register(app)
routes_habits.register(app)
routes_todos.register(app)
routes_health.register(app)
routes_inventory.register(app)
routes_money.register(app)
routes_terminal.register(app)

# --- Startup ---
validate_on_startup(app)

if __name__ == "__main__":
    app.run(debug=True, port=5000)
