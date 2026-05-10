"""Shared test fixtures."""
import pytest
import json
import tempfile
import shutil
from pathlib import Path


@pytest.fixture
def temp_data_dir(tmp_path):
    """Create a temp data directory with minimal seed data."""
    data_dir = tmp_path / "data"
    data_dir.mkdir()

    # Seed todos
    (data_dir / "todos.json").write_text(json.dumps({
        "today": {"date": "2026-04-28", "label": "Monday April 28", "items": [
            {"text": "Test item", "done": False}
        ]},
        "tomorrow": {"date": "2026-04-29", "label": "Tuesday April 29", "items": []},
        "this_week": {"items": []},
        "soon": {"items": []},
        "longer_term": {"items": []},
        "done": {"items": []}
    }, indent=2))

    # Seed contacts
    (data_dir / "contacts.json").write_text(json.dumps({
        "contacts": [
            {"name": "Mom", "threshold_days": 14, "last_contact": "2026-04-20", "method": "call", "history": []}
        ]
    }, indent=2))

    # Seed HRT
    (data_dir / "hrt.json").write_text(json.dumps({
        "last_dose": "2026-04-25", "next_due": "2026-04-30", "cycle_days": 5
    }, indent=2))

    # Seed kitchen
    (data_dir / "kitchen.json").write_text(json.dumps({
        "items": [{"name": "Broccoli", "category": "vegetables", "checked": False}],
        "category_map": {"broccoli": "vegetables"},
        "purchase_counts": {},
        "item_notes": {},
        "pantry": {}
    }, indent=2))

    # Seed supplements
    (data_dir / "supplements.json").write_text(json.dumps({
        "supplements": [{"name": "Vitamin D", "dose": "", "timing": "", "purpose": "", "store": "", "price": "", "status": "taking"}],
        "buy_list": []
    }, indent=2))

    # Seed buy list
    (data_dir / "buy_list.json").write_text(json.dumps({"items": []}, indent=2))

    # Seed growth notes
    (data_dir / "growth_notes.json").write_text(json.dumps({"items": [
        {"text": "Meditate", "added": "2026-04-27", "status": "active", "incorporated": None}
    ]}, indent=2))

    # Seed habits log
    (data_dir / "habits_log.json").write_text(json.dumps({}, indent=2))

    # Seed habit settings
    (data_dir / "habit_settings.json").write_text(json.dumps({"hidden": []}, indent=2))

    return data_dir


@pytest.fixture
def temp_tulku_dir(tmp_path):
    """Create a temp tulku directory with minimal seed data."""
    tulku_dir = tmp_path / "tulku"
    tulku_dir.mkdir()

    # Seed HABITS.md
    (tulku_dir / "HABITS.md").write_text("""# Habits

## Morning
- [ ] Meditate
- [ ] Drink water

## Midday
- [ ] Water - noon

## Evening / Night
- [ ] Floss
- [ ] Check to-do list

<details>
<summary><b>Edges</b></summary>

- Learn tarot

</details>
""")

    # Seed habits.csv
    (tulku_dir / "habits.csv").write_text("date,sleep_time,wake_time,wakeups,wakeup_notes,sleep_quality,exercise,exercise_type,exercise_minutes,food_notes,food_spend,histamine_flare,flare_trigger,nose_congestion,brain_fog,abdominal_pain,hand_pain,headache,energy\n")

    # Journal dir
    daily_dir = tulku_dir / "Journal" / "Daily"
    daily_dir.mkdir(parents=True)
    (daily_dir / "2026-04-28.md").write_text("# April 28\nTest entry.")

    return tulku_dir


@pytest.fixture
def app_client(temp_data_dir, temp_tulku_dir, monkeypatch):
    """Flask test client with patched data directories."""
    import data_helpers
    monkeypatch.setattr(data_helpers, 'DATA_DIR', temp_data_dir)
    monkeypatch.setattr(data_helpers, 'TULKU_DIR', temp_tulku_dir)
    monkeypatch.setattr(data_helpers, 'TODOS_PATH', temp_data_dir / "todos.json")

    # Re-import server after patching
    import importlib
    import server
    importlib.reload(server)

    server.app.config['TESTING'] = True
    with server.app.test_client() as client:
        with server.app.session_transaction() as sess:
            sess['authed'] = True
        yield client
