# Document Control Standards
**Version**: v1.0.0
**Last Updated**: [YYYY-MM-DD]
**Purpose**: ISO-inspired conventions for document metadata, versioning, and lifecycle tracking.
**Applies to**: All project documents except ephemeral notes and raw input files.

---

## 1. Document Metadata Header

Every document must begin with a metadata block:

```markdown
# [Document Title]
**Version**: v[MAJOR].[MINOR].[PATCH]
**Author**: [Name(s)]
**Date Created**: [YYYY-MM-DD]
**Last Updated**: [YYYY-MM-DD]
**Purpose**: [One-line description of what this document does]
**Status**: [Draft | Active | Under Review | Approved | Superseded | Archived]
**Related Files**: [Links to dependent/related documents]
```

### Required Fields
| Field | Required | Notes |
|-------|----------|-------|
| Version | Yes | Semantic versioning (see below) |
| Author | Yes | Who created or owns the document |
| Date Created | Yes | ISO 8601 date |
| Last Updated | Yes | Updated on every edit |
| Purpose | Yes | What this document does, in one line |
| Status | Yes | Current lifecycle status |
| Related Files | If applicable | Cross-references to dependent docs |

### Optional Fields
| Field | When to Use |
|-------|-------------|
| AI Model | When Claude generated or co-authored the content |
| Supersedes | When this doc replaces an older one |
| Review Date | When the doc is due for periodic review |
| Classification | If you need confidentiality levels (Internal, Public, Confidential) |

---

## 2. Versioning (Semantic)

Format: `v[MAJOR].[MINOR].[PATCH]`

| Level | When to Increment | Example |
|-------|-------------------|---------|
| **MAJOR** | Breaking structural change, complete rewrite, paradigm shift | v1.0.0 → v2.0.0 |
| **MINOR** | New section added, significant content update, scope expansion | v1.0.0 → v1.1.0 |
| **PATCH** | Typo fix, clarification, minor edit, formatting | v1.1.0 → v1.1.1 |

### Rules
- New documents start at `v1.0.0`
- Draft documents can use `v0.x.0` to signal "not yet stable"
- Claude auto-increments PATCH on minor edits; asks before MINOR or MAJOR bumps
- Every version change gets a line in the Version History section

---

## 3. Document Lifecycle

```
Draft → Active → [Under Review] → Approved → [Superseded] → Archived
```

| Status | Meaning |
|--------|---------|
| **Draft** | Work in progress, not yet reliable |
| **Active** | Current, maintained, can be relied upon |
| **Under Review** | Being evaluated for accuracy or relevance |
| **Approved** | Reviewed and confirmed correct (for formal docs) |
| **Superseded** | Replaced by a newer document (link to successor) |
| **Archived** | No longer maintained, kept for historical reference |

### Transitions
- Draft → Active: When content is complete enough to use
- Active → Under Review: Triggered by scheduled review or significant change
- Active → Superseded: When a replacement document is created
- Any → Archived: When no longer relevant

---

## 4. Document Classes

| Class | Versioned? | Examples |
|-------|-----------|----------|
| **Operational** | Yes (semantic) | Playbooks, standards, project plans, deliverables |
| **Tracking** | No (append-only) | Session log, lessons learned, decision log |
| **Ephemeral** | No | Meeting notes, scratch work, input files |
| **Reference** | Rarely | External docs, imported research, templates |

### Rules by Class
- **Operational docs**: Full metadata header, version history, review dates
- **Tracking docs**: Metadata header (version optional), reverse-chronological entries
- **Ephemeral docs**: No metadata required, can be deleted freely
- **Reference docs**: Metadata header noting source and retrieval date

---

## 5. Version History Section

Every operational document should end with a version history:

```markdown
## Version History

**v1.1.0 (YYYY-MM-DD):**
- [What changed and why]

**v1.0.0 (YYYY-MM-DD):**
- Initial version
```

---

## 6. File Format Policy

**Internal files are the single source of truth.** Export formats are derived products.

| Format | Use For | Role |
|--------|---------|------|
| `.md` (Markdown) | Unstructured content, narratives, instructions, playbooks | Source of truth |
| `.yaml` / `.json` | Structured data, configuration, registries, metadata | Source of truth |
| `.docx` | Documents for external consumption | Export (derived) |
| `.xlsx` | Spreadsheets for external consumption | Export (derived) |
| `.pdf` | Read-only distribution | Export (derived) |

### Rules
- All project knowledge lives in `.md`, `.yaml`, or `.json` files
- Exports are generated from source files, placed in `output/`, and annotated with their source
- If an export needs updating, update the source file and regenerate — never edit the export directly
- Exports are not version-controlled (add `*.docx`, `*.xlsx`, `*.pdf` to `.gitignore` if they clutter the repo)

---

## 7. File Naming Conventions

| Convention | Example |
|-----------|---------|
| Lowercase with underscores | `cover_letter_template.md` |
| Descriptive, not numbered | `competitive_analysis.md` not `doc_003.md` |
| Date prefix for time-bound docs | `2026-03-02_meeting_notes.md` |
| Version NOT in filename | Version lives in the metadata header, not the name |

### Exceptions
- `00_start_here.md` uses a number prefix to sort first in directory listings
- System files use UPPERCASE: `CLAUDE.md`, `SESSION_LOG.md`, `ACTIVE_WORK.md`

---

## 8. Cross-Reference Conventions

When one document references another:
- Use relative paths: `See [Document Control](standards/document_control.md)`
- When referencing a specific section: `See [Versioning](standards/document_control.md#2-versioning-semantic)`
- Update `DOCUMENTATION_INDEX.md` whenever you create a cross-reference to a new file

---

## 9. Review Schedule (Optional)

For projects that need periodic review:

| Document Type | Review Frequency |
|--------------|-----------------|
| Playbooks | After every 5 uses, or quarterly |
| Standards | Quarterly or when issues arise |
| Project plans | Monthly or at phase transitions |
| Lessons learned | Monthly (promote to playbooks) |
