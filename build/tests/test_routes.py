"""Route tests using Flask test client."""
import json
import pytest


class TestTodos:
    def test_add_todo(self, app_client):
        r = app_client.post('/api/todos/add', json={"item": "New task", "section": "Today"})
        assert r.status_code == 200

    def test_add_duplicate_todo(self, app_client):
        app_client.post('/api/todos/add', json={"item": "Dup", "section": "Today"})
        r = app_client.post('/api/todos/add', json={"item": "Dup", "section": "Today"})
        assert r.status_code == 400

    def test_toggle_todo(self, app_client):
        r = app_client.post('/api/todos/toggle', json={"item": "Test item"})
        assert r.status_code == 200

    def test_remove_todo(self, app_client):
        r = app_client.post('/api/todos/remove', json={"item": "Test item"})
        assert r.status_code == 200

    def test_rename_todo(self, app_client):
        r = app_client.post('/api/todos/rename', json={"old": "Test item", "new": "Renamed"})
        assert r.status_code == 200


class TestHabits:
    def test_add_habit(self, app_client):
        r = app_client.post('/api/habits/add', json={"item": "Yoga", "section": "Morning"})
        assert r.status_code == 200

    def test_toggle_habit(self, app_client):
        r = app_client.post('/api/habits/toggle', json={"habit": "Meditate"})
        assert r.status_code == 200

    def test_remove_habit(self, app_client):
        r = app_client.post('/api/habits/remove', json={"item": "Drink water"})
        assert r.status_code == 200

    def test_habit_settings(self, app_client):
        r = app_client.post('/api/habits/settings', json={"hidden": ["Meditate"]})
        assert r.status_code == 200


class TestGrowth:
    def test_add_growth(self, app_client):
        r = app_client.post('/api/growth/add', json={"text": "Learn tarot"})
        assert r.status_code == 200

    def test_add_duplicate_growth(self, app_client):
        r = app_client.post('/api/growth/add', json={"text": "Meditate"})
        assert r.status_code == 400

    def test_incorporate_growth(self, app_client):
        r = app_client.post('/api/growth/incorporate', json={"text": "Meditate"})
        assert r.status_code == 200

    def test_reactivate_growth(self, app_client):
        app_client.post('/api/growth/incorporate', json={"text": "Meditate"})
        r = app_client.post('/api/growth/reactivate', json={"text": "Meditate"})
        assert r.status_code == 200

    def test_remove_growth(self, app_client):
        r = app_client.post('/api/growth/remove', json={"text": "Meditate"})
        assert r.status_code == 200


class TestKitchen:
    def test_add_kitchen(self, app_client):
        r = app_client.post('/api/kitchen/add', json={"name": "Eggs"})
        assert r.status_code == 200

    def test_add_duplicate_kitchen(self, app_client):
        r = app_client.post('/api/kitchen/add', json={"name": "Broccoli"})
        assert r.status_code == 400

    def test_toggle_kitchen(self, app_client):
        r = app_client.post('/api/kitchen/toggle', json={"name": "Broccoli"})
        assert r.status_code == 200

    def test_remove_kitchen(self, app_client):
        r = app_client.post('/api/kitchen/remove', json={"name": "Broccoli"})
        assert r.status_code == 200


class TestContacts:
    def test_log_contact(self, app_client):
        r = app_client.post('/api/contacts/log', json={"name": "Mom", "method": "call"})
        assert r.status_code == 200

    def test_add_contact(self, app_client):
        r = app_client.post('/api/contacts/add', json={"name": "Isaac"})
        assert r.status_code == 200

    def test_add_duplicate_contact(self, app_client):
        r = app_client.post('/api/contacts/add', json={"name": "Mom"})
        assert r.status_code == 400

    def test_remove_contact(self, app_client):
        r = app_client.post('/api/contacts/remove', json={"name": "Mom"})
        assert r.status_code == 200


class TestHRT:
    def test_hrt_done(self, app_client):
        r = app_client.post('/api/hrt/done', json={"date": "2026-04-28"})
        assert r.status_code == 200
        data = r.get_json()
        assert "next_due" in data

    def test_hrt_undo(self, app_client):
        app_client.post('/api/hrt/done', json={"date": "2026-04-28"})
        r = app_client.post('/api/hrt/undo')
        assert r.status_code == 200


class TestBuyList:
    def test_add_buy(self, app_client):
        r = app_client.post('/api/buy/add', json={"name": "Desk lamp", "priority": "medium"})
        assert r.status_code == 200

    def test_remove_buy(self, app_client):
        app_client.post('/api/buy/add', json={"name": "Desk lamp", "priority": "medium"})
        r = app_client.post('/api/buy/remove', json={"name": "Desk lamp"})
        assert r.status_code == 200


class TestAuth:
    def test_unauthed_api_returns_401(self):
        import server
        server.app.config['TESTING'] = True
        with server.app.test_client() as client:
            r = client.get('/api/data')
            assert r.status_code == 401
