# Playbooks

**Purpose**: Reusable, updatable instruction docs for repeatable workflows and deliverables.

---

## What Is a Playbook?

A playbook is a **step-by-step process doc that Claude follows like an SOP**. When you find yourself doing the same kind of work more than once, extract the process into a playbook so:
- Quality is consistent across sessions
- You don't re-explain the same instructions
- Improvements compound over time (update the playbook, every future run benefits)

## When to Create a Playbook

- You've done a workflow **twice** and expect to do it again
- A deliverable has a **repeatable structure** (cover letters, research briefs, meeting prep, etc.)
- You've accumulated **lessons learned** about how to do something well

## Before Writing a Playbook

Run `/research-workflow [topic]` first. Every repeatable workflow should be grounded in current best practices, not just intuition. The research doc feeds directly into the Research Basis section of the playbook and ensures quality compounds over time rather than drifting.

## Playbook Format

Every playbook follows this structure:

```markdown
# Playbook: [Name]
**Version**: v1.0.0
**Last Updated**: [YYYY-MM-DD]
**Purpose**: [What this playbook produces]
**Trigger**: [When to use this playbook]

## Research Basis
**Last researched**: YYYY-MM-DD
**Research doc**: [`docs/research/[topic-slug]-best-practices.md`](../docs/research/[topic-slug]-best-practices.md)
**Key findings incorporated**:
- [Finding] *(Source)*
**Review trigger**: [Quarterly / when platform X announces changes]

## Inputs Required
- [What Claude needs from you before starting]

## Process
1. [Step-by-step instructions Claude follows]
2. [Be specific — include quality checks, decision points, formats]

## Output Specification
- [What the deliverable looks like when done]
- [Format, length, tone, structure requirements]

## Quality Checklist
- [ ] [Criteria the output must meet before delivery]

## Best Practices
- [Lessons learned, tips, things to watch for]

## Version History
- v1.0.0 — Initial version
```

## How Claude Uses Playbooks

When a task matches a playbook's trigger, Claude should:
1. Read the relevant playbook
2. Follow the process steps in order
3. Check output against the quality checklist
4. Note any improvements or lessons for the playbook in `LESSONS_LEARNED.md`

## Example Playbooks

Create files here as needed. Some project-type examples:

**Career Management:**
- `cover_letter.md` — How to write a tailored cover letter
- `job_research.md` — How to research a company before applying
- `resume_tailoring.md` — How to adapt a resume for a specific role
- `interview_prep.md` — How to prepare for an interview

**Client Projects:**
- `client_brief.md` — How to produce a client brief from raw notes
- `competitive_scan.md` — How to run a quick competitive analysis
- `deliverable_review.md` — Quality checklist before sending to client

**General:**
- `research_brief.md` — How to research a topic and produce a structured summary
- `meeting_prep.md` — How to prepare a meeting agenda and background doc
