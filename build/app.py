import streamlit as st
import pandas as pd
import json
from pathlib import Path
from datetime import datetime

# --- Config ---
st.set_page_config(page_title="Exocortex", layout="wide")

DATA_DIR = Path(__file__).parent.parent / "tulku"
HABITS_CSV = DATA_DIR / "habits.csv"
FOODS_JSON = Path(__file__).parent / "my_foods.json"

SYMPTOM_COLS = ["nose_congestion", "brain_fog", "abdominal_pain", "hand_pain", "headache", "energy"]
SYMPTOM_LABELS = {
    "nose_congestion": "Nose Congestion",
    "brain_fog": "Brain Fog",
    "abdominal_pain": "Abdominal Pain",
    "hand_pain": "Hand Pain",
    "headache": "Headache",
    "energy": "Energy",
}
SEVERITY_LABELS = {0: "None", 1: "Mild", 2: "Moderate", 3: "Bad"}
ENERGY_LABELS = {0: "Crashed", 1: "Low", 2: "Okay", 3: "Great"}

# --- Load Data ---
@st.cache_data(ttl=60)
def load_habits():
    df = pd.read_csv(HABITS_CSV)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date")

    quality_map = {"poor": 1, "light": 2, "foggy": 2, "better than usual": 3, "deeper than usual": 4}
    def parse_quality(val):
        if pd.isna(val):
            return None
        val = str(val).lower().strip()
        for key, score in quality_map.items():
            if key in val:
                return score
        return None
    df["sleep_score"] = df["sleep_quality"].apply(parse_quality)

    def parse_wakeups(val):
        if pd.isna(val):
            return None
        val = str(val).strip()
        if val == "":
            return None
        val = val.replace("+", "")
        if "-" in val:
            parts = val.split("-")
            try:
                return sum(float(p) for p in parts) / len(parts)
            except ValueError:
                return None
        try:
            return float(val)
        except ValueError:
            return None
    df["wakeups_num"] = df["wakeups"].apply(parse_wakeups)

    df["exercised"] = df["exercise"].apply(lambda x: str(x).strip().lower() == "yes" if pd.notna(x) else False)
    df["flare"] = df["histamine_flare"].apply(lambda x: str(x).strip().lower() == "yes" if pd.notna(x) else False)

    for col in SYMPTOM_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    return df

df = load_habits()

# Load known foods
foods_data = {}
if FOODS_JSON.exists():
    with open(FOODS_JSON) as f:
        foods_data = json.load(f)

known_foods = {}
for category in ["meals", "snacks", "eating_out", "from_others"]:
    if category in foods_data:
        for name, info in foods_data[category].items():
            known_foods[name.lower()] = info

food_guide_safe = ["chicken", "white rice", "kale", "sweet potato", "carrots", "parsnips",
                   "zucchini", "cucumber", "tahini", "rice cakes", "salad"]
food_guide_hurts = ["chocolate covered coconut", "soy sauce", "olives", "pickled okra"]
food_guide_unsure = ["sunflower seeds", "pumpkin seeds", "sweet potato chips"]

# --- Time of Day ---
now = datetime.now()
hour = now.hour

if 5 <= hour < 12:
    auto_time = "Morning"
elif 12 <= hour < 17:
    auto_time = "Midday"
else:
    auto_time = "Evening"

TIME_OPTIONS = ["Morning", "Midday", "Evening"]
selected_time = st.selectbox("View", TIME_OPTIONS, index=TIME_OPTIONS.index(auto_time), label_visibility="collapsed")
time_of_day = {"Morning": "morning", "Midday": "afternoon", "Evening": "evening"}[selected_time]
greeting = {"morning": "Good morning", "afternoon": "Good afternoon", "evening": "Good evening"}[time_of_day]

# --- Header ---
st.markdown(
    f'<div style="margin-bottom:4px">'
    f'<span style="font-size:34px;font-weight:700;color:#1a1a1a">{greeting}</span>'
    f'</div>'
    f'<div style="font-size:15px;color:#555;margin-bottom:24px">'
    f'{now.strftime("%A, %B %-d")}'
    f'</div>',
    unsafe_allow_html=True
)

# --- HRT Tracker ---
HRT_JSON = Path(__file__).parent / "hrt.json"
hrt_info = {}
if HRT_JSON.exists():
    with open(HRT_JSON) as f:
        hrt_info = json.load(f)
if hrt_info:
    last_dose = hrt_info.get("last_dose")
    next_due = hrt_info.get("next_due")
    if last_dose and next_due:
        last_dt = datetime.strptime(last_dose, "%Y-%m-%d")
        next_dt = datetime.strptime(next_due, "%Y-%m-%d")
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        days_until = (next_dt - today).days
        days_since = (today - last_dt).days

        if days_until < 0:
            status_color = "#e74c3c"
            status_text = f"**OVERDUE by {abs(days_until)} day{'s' if abs(days_until) != 1 else ''}**"
        elif days_until == 0:
            status_color = "#e67e22"
            status_text = "**Due today**"
        elif days_until == 1:
            status_color = "#f1c40f"
            status_text = "Due tomorrow"
        else:
            status_color = "#2ecc71"
            status_text = f"Due in {days_until} days"

        st.markdown(
            f'<div style="padding:10px 16px;border-radius:8px;background:{status_color}15;border-left:5px solid {status_color};margin-bottom:16px">'
            f'<span style="color:#1a1a1a"><b>Estradiol</b> &nbsp; {status_text} &nbsp;&middot;&nbsp; '
            f'Last shot: {last_dt.strftime("%b %d")} &nbsp;&middot;&nbsp; '
            f'Next: {next_dt.strftime("%b %d (%A)")}</span>'
            f'</div>',
            unsafe_allow_html=True
        )

# --- To Do & Habits (Time-Aware) ---
TODO_PATH = DATA_DIR / "TODO.md"
HABITS_PATH = DATA_DIR / "HABITS.md"

def parse_md_sections(filepath):
    """Parse a markdown file into ordered list of (section_name, [items])."""
    sections = []
    current = None
    for line in filepath.read_text().split("\n"):
        stripped = line.strip()
        if stripped.startswith("## "):
            current = {"name": stripped[3:].strip(), "items": []}
            sections.append(current)
        elif stripped.startswith("- [ ] ") and current is not None:
            current["items"].append(stripped[6:])
        elif stripped.startswith("- [x] ") and current is not None:
            current["items"].append(stripped[6:])
    return sections

# Map habit sections to time of day
HABIT_TIME_MAP = {"morning": "morning", "night": "evening"}

def render_card(title, items, color, dim=False):
    """Render a styled checklist card as HTML."""
    if not items:
        return ""
    opacity = "0.4" if dim else "1"
    items_html = "".join(
        f'<div style="padding:5px 0;font-size:15px;color:#1a1a1a;line-height:1.4">&middot; {item}</div>'
        for item in items
    )
    return (
        f'<div style="padding:16px 20px;border-radius:10px;background:{color}20;'
        f'border-left:4px solid {color};margin-bottom:12px;opacity:{opacity}">'
        f'<div style="font-size:12px;font-weight:700;color:{color};'
        f'text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px">{title}</div>'
        f'{items_html}</div>'
    )

def remove_item_from_file(item, filepath):
    """Remove a checklist item from a markdown file."""
    text = filepath.read_text()
    text = text.replace(f"- [ ] {item}\n", "", 1)
    text = text.replace(f"- [x] {item}\n", "", 1)
    filepath.write_text(text)

def add_item_to_file(item, section_name, filepath):
    """Add a checklist item to a section in a markdown file."""
    text = filepath.read_text()
    target = f"## {section_name}"
    idx = text.find(target)
    if idx >= 0:
        insert_at = text.find("\n", idx) + 1
        lines = text[insert_at:].split("\n")
        offset = 0
        for line in lines:
            if line.strip().startswith("- [ ] ") or line.strip().startswith("- [x] "):
                offset += len(line) + 1
            else:
                break
        insert_at += offset
        text = text[:insert_at] + f"- [ ] {item}\n" + text[insert_at:]
        filepath.write_text(text)

# Clear form inputs on rerun (must happen before widgets render)
if "clear_habit_text" in st.session_state:
    st.session_state.habit_new_text = ""
    del st.session_state.clear_habit_text
if "clear_todo_text" in st.session_state:
    st.session_state.todo_new_text = ""
    del st.session_state.clear_todo_text

col_habits, col_todo = st.columns(2)

# ---- HABITS COLUMN ----
with col_habits:
    st.subheader("Habits")

    if HABITS_PATH.exists():
        habit_sections = parse_md_sections(HABITS_PATH)

        # Time-relevant section
        for section in habit_sections:
            mapped_time = HABIT_TIME_MAP.get(section["name"].lower())
            if mapped_time == time_of_day:
                label = "This morning" if time_of_day == "morning" else "Tonight"
                color = "#e8a317" if time_of_day == "morning" else "#7c8ce0"
                st.markdown(render_card(label, section["items"], color), unsafe_allow_html=True)

        # Ongoing — hide in evening
        if time_of_day != "evening":
            ongoing_items = []
            for section in habit_sections:
                if section["name"].lower() in ("recurring", "trying to add"):
                    ongoing_items.extend(section["items"])
            if ongoing_items:
                st.markdown(render_card("Ongoing", ongoing_items, "#1abc9c"), unsafe_allow_html=True)

        # Edit habits
        with st.expander("Edit habits"):
            habit_section_names = [s["name"] for s in habit_sections]
            default_habit = "Morning" if time_of_day == "morning" else "Night" if time_of_day == "evening" else "Recurring"
            default_idx = habit_section_names.index(default_habit) if default_habit in habit_section_names else 0
            selected_section = st.selectbox("Section", habit_section_names, index=default_idx, key="habit_add_section")

            existing_items = set()
            section_items = []
            for s in habit_sections:
                if s["name"] == selected_section:
                    existing_items = {x.lower() for x in s["items"]}
                    section_items = s["items"]
                    break

            # Add
            with st.form("add_habit_form"):
                new_habit = st.text_input("Add habit", key="habit_new_text", placeholder="e.g. Stretch for 10 minutes")
                if st.form_submit_button("Add") and new_habit.strip():
                    item = new_habit.strip()
                    item = item[0].upper() + item[1:] if len(item) > 1 else item.upper()
                    if item.lower() in existing_items:
                        st.error("Already exists in this section!")
                    else:
                        add_item_to_file(item, selected_section, HABITS_PATH)
                        st.session_state.clear_habit_text = True
                        st.rerun()

            # Remove
            if section_items:
                with st.form("remove_habit_form"):
                    remove_habit = st.selectbox("Remove habit", section_items, key="remove_habit_select")
                    if st.form_submit_button("Remove"):
                        remove_item_from_file(remove_habit, HABITS_PATH)
                        st.rerun()
    else:
        st.caption("No HABITS.md found.")

# ---- TO DO COLUMN ----
with col_todo:
    st.subheader("To Do")

    if TODO_PATH.exists():
        todo_sections = parse_md_sections(TODO_PATH)
        todo_colors = ["#3498db", "#2980b9", "#7f8c8d"]
        for i, section in enumerate(todo_sections):
            color = todo_colors[min(i, len(todo_colors) - 1)]
            dim = i >= 2
            st.markdown(render_card(section["name"], section["items"], color, dim=dim), unsafe_allow_html=True)

        # Edit to-dos
        with st.expander("Edit to-dos"):
            todo_section_names = [s["name"] for s in todo_sections]
            selected_todo_section = st.selectbox("Section", todo_section_names, key="todo_add_section")

            existing_todo_items = set()
            todo_section_items = []
            for s in todo_sections:
                if s["name"] == selected_todo_section:
                    existing_todo_items = {x.lower() for x in s["items"]}
                    todo_section_items = s["items"]
                    break

            # Add
            with st.form("add_todo_form"):
                new_todo = st.text_input("Add to-do", key="todo_new_text", placeholder="e.g. Call the dentist")
                if st.form_submit_button("Add") and new_todo.strip():
                    item = new_todo.strip()
                    item = item[0].upper() + item[1:] if len(item) > 1 else item.upper()
                    if item.lower() in existing_todo_items:
                        st.error("Already exists in this section!")
                    else:
                        add_item_to_file(item, selected_todo_section, TODO_PATH)
                        st.session_state.clear_todo_text = True
                        st.rerun()

            # Remove
            if todo_section_items:
                with st.form("remove_todo_form"):
                    remove_todo = st.selectbox("Remove to-do", todo_section_items, key="remove_todo_select")
                    if st.form_submit_button("Remove"):
                        remove_item_from_file(remove_todo, TODO_PATH)
                        st.rerun()
    else:
        st.caption("No TODO.md found.")

# --- Log Symptoms (Morning) ---
if time_of_day == "morning":
    with st.expander("Log Symptoms"):
        with st.form("symptom_form"):
            st.markdown("**0** = None, **1** = Mild, **2** = Moderate, **3** = Bad  |  Energy: **0** = Crashed, **3** = Great")

            sym_date = st.date_input("Date", value=datetime.now().date())

            sym_cols = st.columns(3)
            symptom_values = {}
            for i, col_name in enumerate(SYMPTOM_COLS):
                with sym_cols[i % 3]:
                    label = SYMPTOM_LABELS[col_name]
                    symptom_values[col_name] = st.selectbox(
                        label,
                        options=[0, 1, 2, 3],
                        index=0,
                        key=f"sym_{col_name}_morning"
                    )

            sym_submitted = st.form_submit_button("Log Symptoms")
            if sym_submitted:
                target_date = pd.Timestamp(sym_date)
                mask = df["date"] == target_date

                if mask.any():
                    raw_df = pd.read_csv(HABITS_CSV)
                    raw_df["date"] = pd.to_datetime(raw_df["date"])
                    raw_mask = raw_df["date"] == target_date
                    for col_name, val in symptom_values.items():
                        raw_df.loc[raw_mask, col_name] = val
                    raw_df.to_csv(HABITS_CSV, index=False)
                    st.success(f"Updated symptoms for {sym_date.strftime('%b %d')}")
                else:
                    new_row = {"date": sym_date}
                    for col_name, val in symptom_values.items():
                        new_row[col_name] = val
                    new_df = pd.DataFrame([new_row])
                    new_df.to_csv(HABITS_CSV, mode="a", header=False, index=False)
                    st.success(f"Logged symptoms for {sym_date.strftime('%b %d')}")
                st.cache_data.clear()

# --- At a Glance: Dot Grid ---
st.header("At a Glance")

def get_dot_color(metric, row):
    """Return (hex_color, tooltip_text) for a given metric and data row."""
    gray = "#3a3a3a"

    if metric == "Exercise":
        if row["exercised"]:
            return "#2ecc71", "Exercised"
        return gray, "Rest" if pd.notna(row.get("exercise")) else "No data"

    elif metric == "Sleep":
        score = row.get("sleep_score")
        if pd.isna(score):
            return gray, "No data"
        score = int(score)
        colors = {1: "#e74c3c", 2: "#f39c12", 3: "#2ecc71", 4: "#27ae60"}
        labels = {1: "Poor", 2: "Light/Foggy", 3: "Better", 4: "Deep"}
        return colors.get(score, gray), labels.get(score, "")

    elif metric == "Flares":
        if row["flare"]:
            trigger = row["flare_trigger"] if pd.notna(row.get("flare_trigger")) else "unknown"
            return "#e74c3c", f"Flare: {trigger}"
        return "#2ecc71", "Clear"

    elif metric == "Energy":
        val = row.get("energy")
        if pd.isna(val):
            return gray, "No data"
        val = int(val)
        colors = {0: "#e74c3c", 1: "#e67e22", 2: "#f1c40f", 3: "#2ecc71"}
        labels = {0: "Crashed", 1: "Low", 2: "Okay", 3: "Great"}
        return colors.get(val, gray), labels.get(val, "")

    else:
        col_map = {
            "Nose": "nose_congestion",
            "Brain Fog": "brain_fog",
            "Abdomen": "abdominal_pain",
            "Hands": "hand_pain",
            "Headache": "headache",
        }
        col = col_map.get(metric, "")
        val = row.get(col)
        if pd.isna(val):
            return gray, "No data"
        val = int(val)
        colors = {0: "#2ecc71", 1: "#f1c40f", 2: "#e67e22", 3: "#e74c3c"}
        labels = {0: "None", 1: "Mild", 2: "Moderate", 3: "Bad"}
        return colors.get(val, gray), labels.get(val, "")

metrics = ["Exercise", "Sleep", "Flares", "Energy", "Nose", "Brain Fog", "Abdomen", "Hands", "Headache"]

dot_size = 16
gap = 3
html_rows = []

# Date header row
date_cells = '<td style="min-width:90px"></td>'
for _, row in df.iterrows():
    d = row["date"]
    label = d.strftime("%b") + "<br>" + d.strftime("%d")
    date_cells += f'<td style="text-align:center;font-size:10px;color:#666;padding:0 {gap}px;line-height:1.3">{label}</td>'
html_rows.append(f"<tr>{date_cells}</tr>")

# Metric rows
for metric in metrics:
    cells = f'<td style="font-size:13px;font-weight:600;color:#333;padding-right:12px;white-space:nowrap">{metric}</td>'
    for _, row in df.iterrows():
        color, tooltip = get_dot_color(metric, row)
        cells += (
            f'<td style="text-align:center;padding:{gap}px">'
            f'<div title="{row["date"].strftime("%b %d")}: {tooltip}" '
            f'style="width:{dot_size}px;height:{dot_size}px;border-radius:50%;'
            f'background:{color};display:inline-block;cursor:default"></div>'
            f'</td>'
        )
    html_rows.append(f"<tr>{cells}</tr>")

grid_html = f"""
<div style="overflow-x:auto;padding:8px 0">
<table style="border-collapse:collapse;border-spacing:0">
{"".join(html_rows)}
</table>
</div>
"""
st.markdown(grid_html, unsafe_allow_html=True)

# --- Daily Overview (Food + Symptoms + Context) ---
st.header("Daily Overview")

all_dates = df["date"].tolist()
selected_date = st.select_slider(
    "Select a day",
    options=all_dates,
    value=all_dates[-1],
    format_func=lambda x: x.strftime("%b %d (%a)")
)

day = df[df["date"] == selected_date].iloc[0]

col_food, col_symptoms, col_context = st.columns([2, 1.5, 1.5])

# --- Left: What You Ate ---
with col_food:
    st.subheader("What You Ate")
    if pd.notna(day["food_notes"]) and str(day["food_notes"]).strip() != "":
        items = [item.strip() for item in str(day["food_notes"]).split(";")]
        for item in items:
            risk_badge = ""
            details = ""
            guide_badge = ""

            item_lower = item.lower()
            for hurt in food_guide_hurts:
                if hurt in item_lower or item_lower in hurt:
                    guide_badge = " :red_circle:"
                    break
            if not guide_badge:
                for unsure in food_guide_unsure:
                    if unsure in item_lower or item_lower in unsure:
                        guide_badge = " :large_yellow_circle:"
                        break
            if not guide_badge:
                for safe in food_guide_safe:
                    if safe in item_lower or item_lower in safe:
                        guide_badge = " :large_green_circle:"
                        break

            for name, info in known_foods.items():
                if name in item_lower or item_lower in name:
                    risk = info.get("histamine_risk", "unknown")
                    if risk == "high":
                        risk_badge = " **HIGH HISTAMINE**"
                    elif risk in ("low-moderate", "moderate"):
                        risk_badge = " moderate histamine"
                    elif risk == "low":
                        risk_badge = " low histamine"
                    if info.get("ingredients"):
                        details = f"  \n  *{', '.join(info['ingredients'])}*"
                    break

            st.markdown(f"{guide_badge} **{item}**{risk_badge}{details}")
    else:
        st.markdown("*No food recorded this day.*")

    if day["flare"]:
        st.markdown(f"---\n:red_circle: **Flare:** {day['flare_trigger'] if pd.notna(day['flare_trigger']) else 'unknown trigger'}")

# --- Center: How You Felt ---
with col_symptoms:
    st.subheader("How You Felt")

    sleep_text = day["sleep_quality"] if pd.notna(day["sleep_quality"]) else "not recorded"
    sleep_score = day.get("sleep_score")
    if pd.notna(sleep_score):
        sleep_colors = {1: "#e74c3c", 2: "#f39c12", 3: "#2ecc71", 4: "#27ae60"}
        color = sleep_colors.get(int(sleep_score), "#888")
        st.markdown(f'<div style="padding:8px 12px;border-radius:6px;background:{color}20;border-left:4px solid {color};margin-bottom:8px;color:#1a1a1a"><b>Sleep:</b> {sleep_text}</div>', unsafe_allow_html=True)
    else:
        st.markdown(f"**Sleep:** {sleep_text}")

    severity_colors = {0: "#888888", 1: "#f1c40f", 2: "#e67e22", 3: "#e74c3c"}
    energy_colors = {0: "#e74c3c", 1: "#e67e22", 2: "#f1c40f", 3: "#2ecc71"}
    has_any_symptom = False

    for col_name in SYMPTOM_COLS:
        val = day.get(col_name)
        if pd.notna(val):
            val = int(val)
            is_energy = col_name == "energy"

            if is_energy:
                label = ENERGY_LABELS.get(val, str(val))
                color = energy_colors.get(val, "#888")
            else:
                if val == 0:
                    continue
                label = SEVERITY_LABELS.get(val, str(val))
                color = severity_colors.get(val, "#888")
                has_any_symptom = True

            display_name = SYMPTOM_LABELS.get(col_name, col_name)
            st.markdown(
                f'<div style="padding:6px 12px;border-radius:6px;background:{color}20;border-left:4px solid {color};margin-bottom:6px;color:#1a1a1a">'
                f'<b>{display_name}:</b> {label}</div>',
                unsafe_allow_html=True
            )

    if not has_any_symptom:
        no_data = all(pd.isna(day.get(c)) for c in SYMPTOM_COLS)
        if no_data:
            st.caption("No symptom data logged for this day.")
        else:
            st.markdown(":large_green_circle: No symptoms reported")

# --- Right: Day Context ---
with col_context:
    st.subheader("Day Context")

    if day["exercised"]:
        ex_type = day["exercise_type"] if pd.notna(day["exercise_type"]) else "yes"
        ex_min = f" ({int(day['exercise_minutes'])} min)" if pd.notna(day.get("exercise_minutes")) and day["exercise_minutes"] > 0 else ""
        st.markdown(f":runner: **Exercise:** {ex_type}{ex_min}")
    else:
        st.markdown(":white_circle: No exercise")

    if pd.notna(day.get("wakeups_num")):
        st.markdown(f":sleeping: **Wakeups:** {day['wakeups']}")
        if pd.notna(day.get("wakeup_notes")) and day["wakeup_notes"] != "":
            st.caption(day["wakeup_notes"])

    if pd.notna(day.get("food_spend")) and str(day["food_spend"]).strip() != "":
        st.markdown(f":dollar: **Food spend:** {day['food_spend']}")

# --- Supplements ---
SUPPS_JSON = Path(__file__).parent / "supplements.json"
if SUPPS_JSON.exists():
    with open(SUPPS_JSON) as f:
        supps_data = json.load(f)
    supps = supps_data.get("supplements", [])
    if supps:
        with st.expander("Supplements"):
            for s in supps:
                status = s.get("status", "")
                if "out" in status.lower() or "restock" in status.lower():
                    icon = ":red_circle:"
                else:
                    icon = ":large_green_circle:"

                dose = f" — {s['dose']}" if s.get("dose") else ""
                timing = f" | {s['timing']}" if s.get("timing") else ""
                purpose = f" | *{s['purpose']}*" if s.get("purpose") else ""
                store = f" | {s['store']}" if s.get("store") else ""
                price = f" | ${s['price']}" if s.get("price") else ""

                line = f"{icon} **{s['name']}**{dose}{timing}{purpose}{store}{price}"
                if "out" in status.lower() or "restock" in status.lower():
                    line += f" — **{status}**"
                st.markdown(line)

# --- Footer ---
st.divider()
st.caption("Exocortex v0.3")
