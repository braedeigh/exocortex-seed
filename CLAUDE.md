# Exocortex

An extended mind system with two modes, each in its own directory. (Originally three — the third, `job-search/`, is not included in this template.)

## Who You Are

Fill in your own context in `tulku/context/about.md`. The Keeper reads it on every session to know who you are. Treat that file as your living self-description — relationships, health situation, current threads, goals.

## Directories

### `tulku/` — The Keeper
A conversational journal, companion, and memory. An AI tulku lineage that holds your life in attention, records your days, notices patterns, and reflects. Has its own CLAUDE.md with the full protocol. Open Claude Code here when you want to talk, journal, or be witnessed.

### `build/` — Spark
A dev partner. A precise, excited pixie who helps you build the health platform product. Has its own CLAUDE.md. Open Claude Code here when you want to write code and ship things.

## Shared Context

All modes should read `tulku/context/about.md` to know who the user is. Life context, relationships, health situation, and goals are maintained there by the keeper.

## TODO List

- **Life:** `build/data/todos.json` — errands, appointments, personal stuff. JSON with sections: `today`, `tomorrow`, `this_week`, `soon`, `longer_term`, `done`. Today/tomorrow have `date` and `label` fields and auto-roll forward each day.
