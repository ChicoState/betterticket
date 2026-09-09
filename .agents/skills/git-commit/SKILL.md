---
name: git-commit
description: Creates a git commit from staged/unstaged changes with an AI-generated commit message based on the diff and agent context. Attaches a git note with the AI reasoning when significant decisions were made.
allowed-tools: Read, Bash, Grep, Glob
---

# Git Commit

Creates well-structured git commits by analyzing the current changes and available agent context.

---

## Auto-Triggers

Auto-triggered by keywords:

- "commit", "save changes", "check in"
- "git commit", "commit my work"

---

## Workflow

### 1. Gather Context

Collect all available information before writing the commit message:

```bash
# Check repo status
git --no-pager status --short

# Get the full diff (staged first, then unstaged)
git --no-pager diff --cached
git --no-pager diff
```

If nothing is staged, stage all changes interactively:
- Show the user what would be staged (`git status --short`)
- Ask the user whether to stage everything or select specific files
- Stage accordingly (`git add -A` or `git add <files>`)

### 2. Check for Agent Context

Look for agent session context that explains **why** changes were made:

- Check the current session state folder for `plan.md` (contains task plan and reasoning)
- Check the SQL `todos` table for task descriptions and status
- Review any conversation context about decisions, trade-offs, or alternatives considered

Agent context is available when the commit is being made as part of an agent-assisted workflow (e.g., after Copilot CLI helped implement a feature). It provides the **intent** and **reasoning** behind the changes.

### 3. Write the Commit Message

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <short summary>

<body - what changed and why>
```

**Types:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`, `ci`, `build`

**Rules:**
- Subject line ≤ 72 characters
- Use imperative mood ("add" not "added")
- Body wraps at 80 characters
- Body explains **what** and **why**, not **how** (the diff shows how)
- Reference issue numbers if found in agent context (e.g., `Fixes #123`)
- If multiple logical changes exist, suggest splitting into separate commits

### 4. Attach AI Reasoning as Git Note (When Applicable)

If any of the following are true, attach a git note after committing:

- **Significant design decisions** were made (e.g., chose one approach over another)
- **Trade-offs** were considered (e.g., performance vs. readability)
- **Alternatives were rejected** (and reasons matter for future maintainers)
- **Non-obvious choices** that someone reading the diff might question
- **Agent plan context** exists with meaningful reasoning

**Do NOT attach a note for:**
- Trivial changes (typo fixes, formatting, simple renames)
- Changes where the commit message already fully explains the reasoning
- Routine changes that follow established patterns

```bash
# Commit first
git commit -m "<message>"

# Then attach the note with reasoning
git notes add -m "## AI Agent Reasoning

### Context
<What task/problem was being solved>

### Decisions Made
- <Decision 1>: <Why this approach was chosen>
- <Decision 2>: <What alternatives were considered and rejected>

### Trade-offs
- <Any trade-offs accepted and why>

### References
- Session: <session-id if available>
- Plan: <brief plan summary if available>
"
```

### 5. Confirm with User

Before executing the commit:

1. Show the proposed commit message
2. Indicate whether a git note will be attached (and show its content)
3. Ask for confirmation or edits
4. Execute the commit (and note if applicable)

---

## Git Notes Reference

Git notes attach metadata to commits without modifying commit history:

```bash
# View notes on a commit
git notes show <commit-sha>

# View log with notes
git --no-pager log --notes --oneline -5

# Push notes to remote
git push origin refs/notes/commits

# Fetch notes from remote
git fetch origin refs/notes/commits:refs/notes/commits
```

**Important:** Notes live in `refs/notes/commits` and must be pushed/fetched separately from regular refs. Remind the user to push notes if they contain valuable context.

---

## Examples

### Simple Change (No Note)

```
fix(workers): handle nil pointer in stage status check

Add nil check for pipeline stage before accessing status field.
Previously this could panic when a stage was deleted mid-processing.
```

### Complex Change (With Note)

Commit:
```
feat(pipelines): add retry backoff for MLOps deployment stages

Implement exponential backoff with jitter for MLOps deployment
polling. Base delay starts at 30s and caps at 5 minutes.

Refs #4521
```

Git Note:
```
## AI Agent Reasoning

### Context
User requested retry improvements for flaky MLOps deployments
that were timing out under load.

### Decisions Made
- Exponential backoff over fixed intervals: Reduces API pressure
  during outages while still detecting completion quickly
- Cap at 5 minutes (not 10): MLOps SLA is 15 min, so 10 min cap
  would leave insufficient time for detection + notification
- Added jitter: Prevents thundering herd when multiple pipelines
  retry simultaneously after an MLOps outage

### Trade-offs
- Slower detection of completed deployments in exchange for
  significantly reduced API load during degraded conditions
```

---

**Version:** 1.0.0 | **Updated:** February 2026
