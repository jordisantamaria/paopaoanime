# Project Instructions

## Language

All committed files, code comments, commit messages, PR descriptions, documentation, and CHANGELOG entries must be in **English**. Conversations with the user remain in Spanish.

## Workflow: Plan with Checklist

When the user asks to implement, fix, or modify something:

1. **Create `PROGRESS.md`** at the project root with a plan and checklist BEFORE writing code
2. **Mark each item as completed** (`- [x]`) immediately after finishing it
3. **Keep tasks granular** - each item should be a concrete action
4. If the plan changes during execution, update `PROGRESS.md` to reflect it
5. **When the task is done**, clear `PROGRESS.md` (history lives in `CHANGELOG.md`)

> `PROGRESS.md` is temporary (in `.gitignore`). It only reflects work in progress. The permanent record is `CHANGELOG.md`.

## Automatic Changelog

When a task or feature is completed, **add an entry to `CHANGELOG.md`** at the project root.

- Add the entry when work is complete (not before)
- Most recent entries go at the top
- Group by date

### CHANGELOG.md Format

```markdown
# Changelog

## 2026-04-07

### feat: Feature name
- Description of what was done
- Relevant details

### fix: Bug fix description
- What was fixed and why

## 2026-04-06

### chore: Data migration to Neon PostgreSQL
- Migrated anime data from JSON files to database
```

## Project Documentation

Documentation lives in `docs/`:

- `docs/ROADMAP.md` — Planned features and priorities
- `docs/architecture.md` — Architecture decisions and rationale
- `docs/database.md` — Table structure, relationships, and design decisions
- `docs/data-pipeline.md` — ETL pipeline: scripts, execution order, data flow

When relevant architecture decisions are made, update `docs/architecture.md`.
When the DB schema is modified, update `docs/database.md`.
When data scripts are added/modified, update `docs/data-pipeline.md`.
