# Claude Project Configuration — Best Practices
**Version**: v1.1.0
**Last Updated**: 2026-04-18
**Purpose**: How to configure Claude across different deployment surfaces — Claude Desktop, Claude Code, Claude.ai Projects
**Status**: Active

---

## Core Principle: CLAUDE.md Is a Pointer, Not a Manual

CLAUDE.md competes for context tokens. Keep it short and procedural — a bootstrap that points to `PROJECT.md` for all project context:

**What goes IN CLAUDE.md:**
- "Read PROJECT.md" — the one essential instruction
- Session lifecycle protocols (startup, closing)
- Hard constraints that must never be violated
- Claude-specific operational rules

**What stays OUT of CLAUDE.md:**
- Architecture, domain knowledge, contacts → `PROJECT.md`
- Process details → `playbooks/` or `docs/`
- Domain-specific data → loaded on-demand

**Test**: If you deleted CLAUDE.md, could someone still work in this project using only the other files? If yes — good architecture.

---

## How Claude Loads Files

### Claude Desktop / Claude Code (CLI + IDE)

| Source | When Loaded | Notes |
|--------|-------------|-------|
| Root `CLAUDE.md` | Session startup | Always loaded, full content |
| Ancestor `CLAUDE.md` | Session startup | Loaded if launched from a subdirectory |
| Subdirectory `CLAUDE.md` | On-demand | Supposed to load when Claude reads files there — behavior varies |
| Submodule `CLAUDE.md` | **Never auto-loaded** | Submodules are invisible by default |
| `.claude/rules/*.md` | Session startup | Modular, can be path-scoped with frontmatter |
| `@path` imports in CLAUDE.md | Session startup | Recursively expanded (max 5 hops), requires one-time approval |

**Key implication**: Submodule CLAUDE.md files are invisible to the parent session. Don't rely on them for cross-module coordination.

### Claude.ai Projects (Web)

| Source | When Loaded | Notes |
|--------|-------------|-------|
| Custom Instructions | Every conversation | The system prompt — always in context |
| Uploaded files | On-demand | Available but not always in active context |
| CLAUDE.md | **Not a concept** | No file auto-loading — paste into Custom Instructions or upload |

**Key implication**: Claude.ai Projects have no CLAUDE.md equivalent. Any CLAUDE.md-based workflow must be translated for Projects users (see Pattern D below).

---

## Configuration Patterns

### Pattern A: Pointer CLAUDE.md + PROJECT.md (this template)

```
project-root/
  CLAUDE.md        ← ~30 lines: "Read PROJECT.md" + Claude-specific protocols
  PROJECT.md       ← Full project context, LLM-agnostic
  SOUL.md          ← OpenClaw equivalent pointer
  INDEX.md         ← Complete file inventory
  docs/            ← Reference material, read on-demand
  playbooks/       ← Reusable SOPs
```

**Pros**: LLM-agnostic PROJECT.md works for any tool. CLAUDE.md stays small.  
**Cons**: Two files to keep in sync conceptually (but they serve different purposes).  
**When to use**: Default — this template uses this pattern.

### Pattern B: Modular Rules (`.claude/rules/`)

```
project-root/
  CLAUDE.md
  .claude/
    rules/
      code-style.md
      api-design.md   ← path-scoped: only loads for src/api/**
```

Rules files support path-scoped frontmatter:
```markdown
---
paths:
  - "src/api/**/*.ts"
---
```

**Pros**: Context-efficient — rules only load when relevant.  
**Cons**: Claude Desktop / Claude Code only. Doesn't translate to Claude.ai Projects.  
**When to use**: Large codebases with directory-specific conventions.

### Pattern C: Import-Based (`@path` syntax)

```markdown
# CLAUDE.md
@./docs/session-protocol.md
@./docs/coding-standards.md
```

**Pros**: CLAUDE.md assembles context from real docs.  
**Cons**: Approval dialog on first use. Max 5 hops. Claude Desktop/Code only.  
**When to use**: When you want CLAUDE.md to feel like a config file.

### Pattern D: Claude.ai Projects Deployment

For non-technical users who won't use Claude Desktop or Code:

```
project-root/
  docs/ai-project-setup/
    project_instructions.md  ← paste into Custom Instructions
    upload_manifest.md       ← which files to upload and in what order
    test_script.md           ← 3-4 scenarios to verify the Project works
```

`project_instructions.md` is the Claude.ai Projects equivalent of CLAUDE.md. It must be:
- Self-contained (no `@path` imports, no auto-loading assumptions)
- Written as a system prompt ("You are helping a...")
- Version-controlled in the repo even though it lives as text in Claude.ai

**Cons**: Manual sync — changes must be re-pasted into the Project.  
**When to use**: Any deployment where participants aren't using Claude Desktop/Code.

---

## Settings Files Reference

| File | Committed? | Purpose | Costs tokens? |
|------|-----------|---------|---------------|
| `CLAUDE.md` | Yes | Session instructions | Yes |
| `CLAUDE.local.md` | No (gitignored) | Personal overrides | Yes |
| `.claude/settings.json` | Yes | Tool permissions, MCP servers, env vars | No |
| `.claude/settings.local.json` | No | Local permission overrides | No |
| `.claude/rules/*.md` | Yes | Modular path-scoped rules | Yes (matching paths only) |
| `~/.claude/CLAUDE.md` | N/A (home dir) | Global personal instructions | Yes |

**Rule of thumb**: Instructions/context cost tokens. Configuration/permissions don't.

---

## Anti-Patterns

**Monolith CLAUDE.md** — A 400-line CLAUDE.md with architecture, standards, and domain knowledge. Burns context, impossible to translate to Claude.ai Projects.

**Submodule CLAUDE.md reliance** — Claude Desktop/Code never auto-loads submodule CLAUDE.md. Put cross-module coordination in the parent.

**Duplicate CLAUDE.md and Custom Instructions** — Maintain one canonical source (`PROJECT.md` or `project_instructions.md`) and derive both from it.

**Credentials in CLAUDE.md** — CLAUDE.md is committed to git. Use environment variables or `.env` (gitignored) for secrets.

**Claude-only documentation** — If a human can't read your CLAUDE.md and understand what to do, it's too Claude-specific. Good CLAUDE.md files are useful onboarding docs that also happen to work as AI instructions.

---

## Checklist: Setting Up a New Project

- [ ] Create `CLAUDE.md` at root (< 50 lines: "Read PROJECT.md" + protocols)
- [ ] Create `PROJECT.md` — LLM-agnostic project context
- [ ] Create `SOUL.md` if OpenClaw deployment is planned
- [ ] Create `INDEX.md` — complete file inventory
- [ ] Set up `intake/` and `output/` folders
- [ ] If multi-operator: create `ACTIVE_WORK.md` + `SESSION_LOG.md`
- [ ] If Claude.ai Projects users: create `docs/ai-project-setup/` with translation layer
- [ ] Verify portability: mentally delete CLAUDE.md — can someone still work?
- [ ] Check context budget: is CLAUDE.md under ~50 lines?

---

## Version History

**v1.1.0 (2026-04-18):**
- Moved from project root to `docs/`; removed project-specific examples
- Updated pattern A to reflect PROJECT.md / SOUL.md / INDEX.md architecture
- Updated checklist to match current template structure

**v1.0.0 (2026-03-02):**
- Initial version
