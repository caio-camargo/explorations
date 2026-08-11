# Skill Execution Logging
**Version**: v1.0.0
**Purpose**: How to add structured execution logging to skills and query the logs
**Status**: Active

---

## Why log skill executions

- **Audit trail** — know what ran, when, with what inputs and outcome
- **Error diagnosis** — surface recurring failures without asking the user what happened
- **Usage patterns** — understand which skills run most and what inputs they receive
- **Client reporting** — demonstrate measurable throughput and reliability

---

## Log file location

All skill execution logs go to: `logs/skill-executions.jsonl`

One JSON object per line (JSON Lines format). The file is append-only. Archive monthly to `logs/archive/YYYY-MM/`.

---

## Log entry schema

```json
{
  "timestamp": "2026-04-18T14:32:01Z",
  "skill": "blog-post-layout",
  "version": "1.0.0",
  "session_id": "${CLAUDE_SESSION_ID}",
  "status": "success",
  "inputs": {
    "doc_url": "https://docs.google.com/...",
    "slug": "my-post-slug"
  },
  "outputs": {
    "item_id": "abc123",
    "images_injected": 4
  },
  "error": null,
  "duration_ms": 12400
}
```

**Required fields:** `timestamp`, `skill`, `status`
**Optional but recommended:** `version`, `inputs`, `outputs`, `error`, `duration_ms`
**`status` values:** `success` | `error` | `partial` | `skipped`

---

## How to add logging to a skill

### If the skill runs a Python script

Add this to the script (typically at the end of the main function):

```python
import json, datetime, os, pathlib

def log_execution(skill, status, inputs=None, outputs=None, error=None, start_time=None):
    log_dir = pathlib.Path(__file__).parent.parent / "logs"
    log_dir.mkdir(exist_ok=True)
    entry = {
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "skill": skill,
        "version": "1.0.0",  # update when skill version changes
        "status": status,
        "inputs": inputs or {},
        "outputs": outputs or {},
        "error": error,
        "duration_ms": int((datetime.datetime.utcnow() - start_time).total_seconds() * 1000) if start_time else None
    }
    log_file = log_dir / "skill-executions.jsonl"
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
```

Call at the end: `log_execution("my-skill", "success", inputs={...}, outputs={...}, start_time=start)`

### If the skill is Claude-only (no script)

Instruct Claude in the SKILL.md to append a log entry after completion:

```markdown
## Logging

After completing the task, append one line to `logs/skill-executions.jsonl`:
{"timestamp": "[ISO UTC]", "skill": "my-skill", "version": "1.0.0", "status": "success", "inputs": {...}, "outputs": {...}}
```

---

## Querying the log

To see recent executions, ask Claude: *"Show me the last 10 skill runs"* or *"Show errors from blog-post-layout this week."*

Claude can read and filter `logs/skill-executions.jsonl` inline without a dedicated skill. A `/skill-log` skill is worth building once log volume makes filtering useful (typically 100+ entries).

---

## What not to log

- Full document content or user-provided text (keep inputs to identifiers and metadata)
- Credentials, tokens, or API keys
- PII from processed documents
