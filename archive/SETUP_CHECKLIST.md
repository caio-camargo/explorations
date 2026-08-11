# Project Setup Checklist

**Purpose**: One-time steps to initialize a new project from this template.
**Status**: Complete these in order, then move this file to `archive/`.

---

## 1. Customize Project Identity

- [ ] Rename this folder to your project name
- [ ] Edit `AGENTS.md`: replace `[Project Name]` in the title
- [ ] Edit `PROJECT.md`: fill in goals, contacts, scope, current focus
- [ ] Update `INDEX.md` if you add or remove folders
- [ ] Leave `CLAUDE.md` and `SOUL.md` untouched — they are platform shims pointing at `AGENTS.md`; all rule edits go in `AGENTS.md`

## 2. Choose a Coordination Profile

- [ ] Read `docs/coordination.md`
- [ ] **Profile A (file-based)** — default; zero dependencies; right for client work or anywhere you can't provision infrastructure
- [ ] **Profile B (DB-backed)** — right when you control infrastructure and expect routine concurrent sessions; needs a Postgres/Supabase instance
- [ ] Record the choice in the checkbox at the top of `docs/coordination.md`

## 3. Initialize Git (optional but recommended)

```bash
cd your-project-folder
git init
git add .
git commit -m "Initial project setup from template"
```

If the folder lives on a sync layer (Drive/Dropbox), be aware sync engines can interfere with `.git/` internals; consider keeping the repo outside the synced path or using git only for snapshots.

## 4. Verify the Agent Contract Loads

- [ ] Open the project folder in your agent tool (Claude Code, etc.)
- [ ] Verify the session loads the operating contract: Claude Code inlines `AGENTS.md` via the `@AGENTS.md` import in `CLAUDE.md`; tools that read `AGENTS.md` natively (Codex, Cursor) pick it up directly
- [ ] Run a test session: the agent should follow the Session Startup Protocol (PROJECT.md → coordination check → session log → intake) and wait for your go-ahead

## 5. Optional: Add Project-Specific Playbooks

If this project has repeatable workflows, create them in `playbooks/`. See `standards/document_control.md` for versioning and metadata conventions.

## 6. First Session

- [ ] Tell the agent what this project is about
- [ ] Work through the first task together
- [ ] At session end, verify the agent updates `SESSION_LOG.md` and clears its claim
- [ ] Check that `INDEX.md` reflects any new files

---

**Once complete**, move this file to `archive/` (archive over delete — see `docs/architecture-principles.md` §7).
