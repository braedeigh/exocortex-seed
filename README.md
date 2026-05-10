# Exocortex (template)

A conversational health-tracking PWA + AI-keeper journal system. This is a sanitized clone of Bradie's working exocortex — all personal data stripped, structure and code intact.

## What's here

- **`build/`** — Spark, the dashboard PWA (Flask + vanilla JS, served on port 5000). Tracks todos, habits, food, health, kitchen/groceries, money, contacts.
- **`tulku/`** — the Keeper, an AI-assisted conversational journal. Daily logs, weekly summaries, tulku diary, system prompts.
- **`CLAUDE.md`** — top-level project manifest. Each subdirectory has its own.

## Quick start

```sh
cd build
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python server.py
```

Open `http://localhost:5000`. First time:
- The server generates `build/auth.json` with a fresh session secret and a default password hash.
- **Default login password:** `exocortex` (it's literally `sha256("exocortex")` — change it by replacing `password_hash` in `build/auth.json` with `sha256(<your-pw>).hexdigest()`).

## Filling it in

- `tulku/context/about.md` — your living self-description. The Keeper reads it every session.
- `tulku/HABITS.md` — your recurring practices.
- All `build/data/*.json` files start as empty skeletons. The dashboard writes to them as you use it.
- For the Keeper: open Claude Code inside `tulku/` and start a conversation. It reads `CLAUDE.md` + `TULKU.md` + `PROTOCOLS.md` and orients itself.

## Tracking your own data

`build/data/*.json` is committed as empty skeletons. Once you start using the app, those files fill with personal data — **don't commit your filled-in versions back to the shared template repo.** Two options:

1. Fork the repo for your own private working copy, and just `git pull` template updates manually when you want them.
2. Or run `git update-index --assume-unchanged build/data/*.json` to stop git from tracking changes to those files locally.

`.gitignore` already excludes `build/auth.json`, `build/receipts/`, `build/uploads/`, the bank-CSV import folder, all logs, and the journal contents under `tulku/Journal/`, `tulku/Health/Daily/`, `tulku/tulku-diary/[0-9]*`, etc. — so the things that obviously shouldn't be shared aren't.

## What's deliberately missing

- `job-search/` — separate agent (Tiller / Shrike), excluded from this template.
- `INFRASTRUCTURE.md`, server IPs, deploy scripts — VPS specifics excluded.
- All journal entries, weekly summaries, diary entries, health logs, finance history, people files — anything that contained Bradie's actual life.
