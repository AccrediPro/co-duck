# Ralph - Autonomous Development System

Ralph is an iterative AI development loop that enables autonomous coding sprints with Claude Code.

## Quick Start

### Run a Development/Testing Sprint

```bash
cd /home/premium-accredipro/code-projects/coaching-platform/ralph
./ralph.sh --tool claude 30
```

### Check Progress

```bash
cat progress.txt
```

### See Remaining Stories

```bash
jq '.userStories[] | select(.passes == false) | {id, title}' prd.json
```

## How It Works

1. **PRD defines the sprint** - `prd.json` contains user stories
2. **Ralph loops** - `ralph.sh` runs Claude Code iteratively
3. **Claude works autonomously** - Reads CLAUDE.md instructions, picks next story, implements, commits
4. **Progress tracked** - `progress.txt` logs what was done
5. **Completion signal** - When all stories pass, Ralph stops

## Files

| File              | Purpose                                   |
| ----------------- | ----------------------------------------- |
| `ralph.sh`        | Main loop script                          |
| `CLAUDE.md`       | Instructions for Claude during iterations |
| `ORCHESTRATOR.md` | High-level orchestration strategy         |
| `prd.json`        | Current sprint's user stories             |
| `progress.txt`    | Progress log and codebase patterns        |
| `archive/`        | Previous sprint PRDs and progress         |

## Usage Patterns

### Development Sprint

Create PRD with features to implement:

```bash
./ralph.sh --tool claude 30
```

### Testing Sprint

Create PRD with test stories:

```bash
./ralph.sh --tool claude 20
```

### Overnight Run

Long autonomous session:

```bash
./ralph.sh --tool claude 100
```

## PRD Format

```json
{
  "project": "Coaching Platform",
  "branchName": "ralph/sprint-name",
  "description": "Sprint goals",
  "userStories": [
    {
      "id": "US-001",
      "title": "Story title",
      "description": "User story description",
      "acceptanceCriteria": ["criteria 1", "criteria 2"],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

## Workflow

### With Human Oversight

1. Human + Claude plan the sprint
2. Claude creates PRD
3. Human runs `./ralph.sh --tool claude N`
4. Review results
5. Repeat

### Fully Autonomous

1. Human gives macro goal
2. Claude creates PRD, runs Ralph
3. Claude creates testing PRD, runs Ralph
4. Claude creates optimization PRD, runs Ralph
5. Claude reports back

## Requirements

- Claude Code CLI installed
- Node.js project with npm
- Playwright for UI testing (optional but recommended)

### Installing Playwright

```bash
npm install -D @playwright/test
npx playwright install chromium
```

## Tips

- Always include "Typecheck passes" in acceptance criteria
- Keep stories small and focused
- Include testing stories in every sprint
- Check progress.txt for patterns learned

## Troubleshooting

### Ralph stuck on a story

- Check `progress.txt` for errors
- Manually fix the issue
- Update prd.json to mark story as passed
- Resume Ralph

### Build failing

- Run `npm run build` manually to see error
- Fix the error
- Resume Ralph

### Context limit reached

- Ralph handles this by working story-by-story
- Each iteration starts fresh with context from files
