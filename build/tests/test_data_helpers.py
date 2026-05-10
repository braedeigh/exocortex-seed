"""Tests for data_helpers.py."""
import json
import pytest
from pathlib import Path


def test_load_json(temp_data_dir, monkeypatch):
    import data_helpers
    monkeypatch.setattr(data_helpers, 'DATA_DIR', temp_data_dir)

    result = data_helpers.load_json("todos.json")
    assert "today" in result
    assert result["today"]["items"][0]["text"] == "Test item"


def test_load_json_missing(temp_data_dir, monkeypatch):
    import data_helpers
    monkeypatch.setattr(data_helpers, 'DATA_DIR', temp_data_dir)

    result = data_helpers.load_json("nonexistent.json", default=[])
    assert result == []


def test_save_json(temp_data_dir, monkeypatch):
    import data_helpers
    monkeypatch.setattr(data_helpers, 'DATA_DIR', temp_data_dir)

    data_helpers.save_json("test_output.json", {"key": "value"})
    saved = json.loads((temp_data_dir / "test_output.json").read_text())
    assert saved["key"] == "value"


def test_parse_md_sections(temp_tulku_dir):
    import data_helpers
    filepath = temp_tulku_dir / "HABITS.md"
    sections = data_helpers.parse_md_sections(filepath)
    assert len(sections) >= 3
    assert sections[0]["name"] == "Morning"
    assert any(i["text"] == "Meditate" for i in sections[0]["items"])


def test_add_and_remove_item(temp_tulku_dir):
    import data_helpers
    filepath = temp_tulku_dir / "HABITS.md"

    data_helpers.add_item_to_file("New habit", "Morning", filepath)
    sections = data_helpers.parse_md_sections(filepath)
    morning_items = [i["text"] for i in sections[0]["items"]]
    assert "New habit" in morning_items

    data_helpers.remove_item_from_file("New habit", filepath)
    sections = data_helpers.parse_md_sections(filepath)
    morning_items = [i["text"] for i in sections[0]["items"]]
    assert "New habit" not in morning_items


def test_load_todos(temp_data_dir, monkeypatch):
    import data_helpers
    monkeypatch.setattr(data_helpers, 'TODOS_PATH', temp_data_dir / "todos.json")

    todos = data_helpers.load_todos()
    assert "today" in todos


def test_todos_to_sections(temp_data_dir, monkeypatch):
    import data_helpers
    monkeypatch.setattr(data_helpers, 'TODOS_PATH', temp_data_dir / "todos.json")

    todos = data_helpers.load_todos()
    sections = data_helpers.todos_to_sections(todos)
    assert len(sections) == 6  # today, tomorrow, this_week, soon, longer_term, done


def test_find_section_key():
    import data_helpers
    assert data_helpers.find_section_key("Today") == "today"
    assert data_helpers.find_section_key("Today — Monday April 28") == "today"
    assert data_helpers.find_section_key("Soon") == "soon"
    assert data_helpers.find_section_key("Nonexistent") is None


def test_validate_on_startup(temp_data_dir, temp_tulku_dir, monkeypatch):
    import data_helpers
    monkeypatch.setattr(data_helpers, 'DATA_DIR', temp_data_dir)
    monkeypatch.setattr(data_helpers, 'TULKU_DIR', temp_tulku_dir)

    from flask import Flask
    test_app = Flask(__name__)
    problems = data_helpers.validate_on_startup(test_app)
    assert len(problems) == 0
