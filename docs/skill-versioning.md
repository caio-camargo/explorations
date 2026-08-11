# Skill Versioning
**Version**: v1.0.0
**Purpose**: How to version skills, write changelogs, and manage the registry
**Status**: Active

---

## Version format

Skills use semantic versioning: `MAJOR.MINOR.PATCH`

| Bump | When |
|------|------|
| **PATCH** | Wording fixes, clarifications, minor instruction tweaks — behavior unchanged |
| **MINOR** | New steps, new output fields, changed defaults — backward-compatible |
| **MAJOR** | Workflow restructured, config format changed, breaking behavior change |

New skills start at `v1.0.0`. Pre-stable work can use `v0.x.0`.

---

## Where versions live

Version is recorded in **two places** (keep them in sync):

1. **`docs/skill-registry.yaml`** — the canonical registry entry
2. **SKILL.md frontmatter** (optional but recommended) — add a `version` field:

```yaml
---
name: my-skill
description: "..."
version: "1.0.0"
last-updated: "YYYY-MM-DD"
---
```

The manifest.json does **not** track versions — it only tracks whether a skill is registered and enabled.

---

## How to update a skill

1. Edit the SKILL.md
2. Decide the version bump (patch / minor / major)
3. Update `docs/skill-registry.yaml`:
   - Increment `version`
   - Update `last_updated`
   - Add a `changelog` entry:
     ```yaml
     - version: "1.1.0"
       date: "2026-05-01"
       notes: "Added batch processing support"
     ```
4. Update `INDEX.md` if the skill's description changed meaningfully
5. Run `/skill-health` to confirm everything is consistent

---

## Deprecating a skill

1. Set `status: deprecated` in the registry
2. Add a changelog entry noting why and what replaces it
3. Leave the SKILL.md in place (for reference) but add a deprecation notice at the top
4. Do NOT remove from the manifest immediately — check if anyone relies on it first

---

## When to create a new skill vs update an existing one

Create a new skill when:
- The trigger phrase changes significantly
- The workflow is restructured end-to-end
- The new version is incompatible with how users currently invoke the skill

Update the existing skill when:
- The trigger stays the same
- The steps change but the goal is the same
- You're adding optional behavior alongside existing behavior
