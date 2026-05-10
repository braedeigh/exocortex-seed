# Claude Code Tools & Techniques

*Reference file for hooks, patterns, and tools to learn from and adapt for the exocortex.*

---

## 8 Claude Code Hooks — @zodchiii

[tweet](https://x.com/zodchiii/status/2040000216456143002) — Saved Apr 3 2026

> 8 Claude Code Hooks That Automate What You Keep Forgetting
>
> CLAUDE.md is a suggestion. Claude reads it and follows it about 80% of the time. Hooks are different. They're automatic actions that fire every time Claude edits a file, runs a command, or finishes a task.
>
> How hooks work:
> - PreToolUse runs before Claude does something. You can block it by returning exit code 2 (bouncer).
> - PostToolUse runs after Claude does something. Cleanup, formatting, tests, logging (quality control).
> - Hooks live in .claude/settings.json (project-level, shared via git), ~/.claude/settings.json (user-level), or .claude/settings.local.json (local only).
>
> 1. Auto-format every file Claude touches — Prettier runs automatically after every Write/Edit via PostToolUse hook.
> 2. Block dangerous commands — PreToolUse hook that pattern-matches rm -rf, git reset --hard, DROP TABLE, curl|sh etc. Exit code 2 blocks and tells Claude to propose a safer alternative.
> 3. Protect sensitive files from edits — PreToolUse hook blocking edits to .env, .git/*, lock files, *.pem, secrets/*.
> 4. Run tests after every edit — PostToolUse hook runs test suite after Write/Edit. Claude sees failures and fixes immediately. "Giving Claude a feedback loop improves output quality by 2-3x."
> 5. Require passing tests before creating a PR — PreToolUse hook on PR creation. Hard gate: no green tests, no PR.
> 6. Auto-lint and report errors — PostToolUse hook runs ESLint after edits. Chain with auto-format.
> 7. Log every command Claude runs — PreToolUse hook appends every Bash command to .claude/command-log.txt with timestamps. Audit trail for debugging.
> 8. Auto-commit after each completed task — Stop hook that git add -A && git commit after Claude finishes a response. Atomic commits per task.

---

## Anatomy of the Claude Folder — Isaac (Daily Dose of DS)

[blog.dailydoseofds.com/p/anatomy-of-the-claude-folder](https://blog.dailydoseofds.com/p/anatomy-of-the-claude-folder) — From Isaac. Read through to understand how Claude Code file editing works, then review and improve CLAUDE.md files and protocols.

---

## obsidian-mind — breferrari

[github.com/breferrari/obsidian-mind](https://github.com/breferrari/obsidian-mind) — Saved Apr 3 2026

Obsidian vault template as a persistent external brain for Claude Code. Graph-linked .md notes, auto-classification, 15 slash commands, 9 subagents, hooks that inject context every session. MIT license.

**Tools to grab:**
- Message classification hook (`classify-message.py`) — pattern-matches input and auto-routes to the right file. Adapt for dump tab / Cricket.
- Session-start context injection (`session-start.sh`) — auto-loads goals, active work, recent changes on every Claude Code session. Use for keeper/spark startup.
- Cross-linker agent — finds missing links and orphaned notes. The linking layer from the Karpathy idea.
- Vault librarian agent — deep maintenance (orphans, broken links, stale content). More developed version of Cricket's system health role.
- Pre-compact transcript backup — saves full conversation before context compression. Never lose a session.
- Freeform dump & route (`/dump`) — classify unstructured text, route to the right file, cross-link. What the scratchpad/dump tab wants to be.

**Patterns to adopt:**
- YAML frontmatter on every note (date, tags, status, description) so agents can query without full reads — the missing index layer
- Graph-first organization — links as primary structure, folders for browsing
- Atomic notes + curated indexes — one concept per file, index files that link them
