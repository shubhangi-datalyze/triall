# Analytics agent: content for the Datalyze MCP connector

This folder holds what the MCP server serves: how the AI should work (principles, workflows, modules, suspects notes) and what Datalyze knows (knowledge chunks built from the playbook and the blog). The server itself lives elsewhere. `SPEC.md` is the product spec.

## What's here

| Path | What it is | Returned by |
|---|---|---|
| `principles.md` | 14 principles for every task | `start_task`, always |
| `workflows/*.md` | 8 task types: answer-question, pull-number, explain-change, find-opportunities, reconcile-numbers, audit, plan, judge-result | `start_task`, the one that matches |
| `modules/*.md` | 6 shared methods: data-health-check, funnel-deep-dive, metric-tree-rate-mix, story-output, analytics-strategy and tracking-plan (the last two condensed from the updated Claude skills) | `start_task`, the ones the workflow lists |
| `suspects/*.md` | "Usual suspects" per topic: retention, activation-onboarding, payments-revenue, attribution | `start_task`: only notes the workflow lists in `suspects`, and of those only the ones whose `topic` matches the request |
| `knowledge/` | Generated chunks and full documents | `search_knowledge`, `get_chapter` |
| `tests/analytics_question_bank.csv` | 392 questions, 55 problems (M8 was added to test pull-number) | Routing test |
| `tests/routing.csv` | Expected workflow, suspects, chapters and blog posts per problem | Routing test |
| `CONTENT-MAP.md` | Which chapter feeds what, gaps, answers to the spec's open questions | People |

## File format

Every instruction file starts with YAML frontmatter, then markdown. Fields:

- `id`: matches the filename.
- `name`: display name.
- `use_when`, `not_for`, `examples` (workflows only): for routing. Embed `use_when` + `examples` per workflow and match the user's request against them, or pass them to a classifier prompt.
- `modules`, `suspects` (workflows): which other files to return with it.
- `knowledge`: playbook chapter slugs most relevant to the file. Use as a boost or a fallback when search comes back thin.
- `used_by` (modules), `problems` and `topic` (suspects): reference only.

Strip the frontmatter before returning a file to the AI if you like; the body stands on its own. Inline references look like `` `modules/story-output` ``.

**Before serving to users:** `npm run agent:check` must pass with no `[ANSH: ...]` warnings. An open flag is a decision Ansh still has to make.

## Steps

Every workflow is split into `## Step N: Title` sections, served one at a time. Each step starts with a block the AI never sees:

```
<!-- step
id: data-check
report: What the AI must send back before it gets the next step.
modules: [data-health-check]
suspects: true
ask: true
knowledge: [sense-checking-numbers, reading-data]
branches: [funnel, retention]
-->
```

- `report` is required. It makes the AI do the step before moving on, so write it as something checkable: definitions, numbers with counts, what the user confirmed, what was assumed or skipped.
- `modules` are handed over with that step only. `suspects: true` hands over the topic's suspects note.
- `fields: [a, b]` lists what `next_step` must get in `fields` with the report (snake_case; the server refuses a report without them). The renderer's `FIELD_HELP` says what goes in each. A data-check step lists `broken` and `clean_subset`: reporting something broken without a clean subset is refused unless the AI switches workflow. Every workflow's last step lists `write_up`, the answer as given to the user.
- `ask: true` marks a step that needs the user's answer. The server adds a rule to its footer: ask in one batch with proposed answers, end the turn, and run no analysis query until the user replies (unless they already answered or said to go ahead on defaults). Use it on every step where the user has to confirm a definition, the context or the hypotheses; without it, the AI assumes and flags instead of asking. Its report should ask for the user's answer in their words.
- `knowledge` lists playbook chapters to boost in that step's search.
- `branches` makes the step a choice between `### Branch <id>: Title` sections, each with its own `<!-- branch -->` block (report, modules, knowledge). The AI picks one and gets only that case.
- Values are plain `key: value` lines, not YAML, so report lines need no quoting.

`npm run agent:check` validates all of it.

## How the MCP serves it

The server is `app/api/datalyze/mcp/route.ts`, built on `lib/analytics-agent/` (content.ts parses, serve.ts renders, task.ts moves through steps, search.ts searches). Four tools, all behind the subscription:

- `start_task(request, workflow, topic, connected_tools)`: the AI picks the workflow and topic from the tool's description (built from each workflow's `use_when` and `not_for`, and each suspects note's `topic`). Returns the plan, the principles and step 1.
- `start_task` also takes `previous_task`: the last token of an earlier task in the same conversation, whose saved fields (confirmed definitions, data problems) carry into the new task.
- `next_step(task, report, fields?, user_said?, user_answer?, branch?, switch_to?)`: returns the next step, or the chosen case at a step with branches, or the first step of another workflow. Before moving on it runs the checks in `lib/analytics-agent/gates.ts` and sends the report back with what to fix when one fails:
  - **Answers:** at an `ask: true` step, `user_answer` must be there and in the user's words (compared with `user_said` and what they said earlier in the task), and `fields.answers` has a line per question; a "no answer" line goes back to be asked once more, and "asked twice, no answer" or "user said go ahead" lets it through.
  - **Checklists:** a step's `checklist` items, plus the topic's usual suspects when it has `suspects_list`, each need a line in `fields.checklist` saying what was done, that it doesn't apply, or that the tool couldn't (with what was tried).
  - **Hypotheses:** `hypotheses` must be numbered (H1, H2...), and `hypotheses_tested` at the end must give a verdict for every one listed earlier in the task.
  - **No time excuses:** a report that skips work for lack of time is refused.
  - **Told the user:** `definition_used` that differs from the confirmed definition, and `tool_limits` other than "none", must say "user told: yes".
  - **Write-up:** `write_up` holds the answer itself, and with `ruled_out` it must say what was checked and ruled out. Broken data needs a `clean_subset` or a switch.

  `npm run agent:gates-test` runs these on real and made-up reports.
- `search_knowledge(query)` and `get_chapter(id)`.

Each step comes with its modules, its suspects note, and the top 3 knowledge sections for the request plus the step (sections sent earlier in the task are skipped). Task state is a signed token the AI carries between calls. What the AI sends (the request, `user_said`, `user_answer`, reports and fields) is kept in `mcp_task_messages` for 30 days, with emails and phone numbers removed, unless the account turned it off on the Usage page (`lib/mcp/conversations.ts`).

## Usage log

`mcp_task_events` gets one row per step served: workflow, step, event, the task id, seconds since the reported step was served, and whether an `ask` step got the user's answer. It also logs each refusal by kind (`ask_refused`, `answer_refused`, `unanswered_refused`, `checklist_refused`, `hypotheses_refused`, `time_refused`, `definition_refused`, `tool_limits_refused`, `fields_refused`, `broken_refused`) and `topic_unused:<topic>` (the AI picked a topic the workflow has no suspects note for). `npm run agent:usage -- --days=30` reports completion by workflow, where unfinished tasks stop, whether the AI waited at ask steps, and unused topics. Pass the production `MCP_DATABASE_URL` on the command line; the one in `.env.local` is an old database.

## Knowledge chunks

Build: `npm run agent:knowledge` (needs `GHOST_CONTENT_API_KEY` in `.env.local`; `-- --no-ghost` for playbook only). Output in `knowledge/`:

- `chunks.jsonl`, one per line:
  ```json
  { "id": "playbook:rate-and-mix-analysis#how-do-you-measure-the-rate-effect",
    "docId": "playbook:rate-and-mix-analysis",
    "source": "playbook | playbook-faq | blog | case-study | tutorial",
    "title": "Rate and mix analysis: why your conversion rate moved",
    "heading": "How do you measure the rate effect?",
    "url": "https://www.joindatalyze.com/playbook/rate-and-mix-analysis#how-do-you-measure-the-rate-effect",
    "text": "breadcrumb\n\nbody (embed this)",
    "problems": ["D7", "D8"],
    "chars": 1534 }
  ```
- `documents.jsonl`: one full document per line (`docId`, `source`, `slug`, `title`, `url`, `summary`, `updated`, `text`) for `get_chapter`.
- `manifest.json`: counts and build time.

Playbook chapters split on H2 (on H3 when an H2 section runs over 3,200 characters), so every chunk URL lands on a real heading anchor. Each chapter also gets a summary chunk (summary + takeaways) and one chunk per FAQ. Blog posts go through the same chunker as Ask Ansh's AI (`lib/kb/chunk.ts`). Current build: 106 documents, 870 chunks, longest 3,197 characters.

Ranking suggestion: rank `playbook` above `blog` (where they disagree, the playbook is the source of truth), and down-weight `tutorial` and `case-study` slightly against both, the same way `lib/kb` does, so how-tos and proof points don't outrank method content on strategy questions.

## Routing test

`tests/routing.csv` has one row per problem: the expected workflow, other acceptable workflows, the suspects note, the chapters and blog posts a good answer should retrieve, and a coverage grade. Join it to the question bank on `Problem ID`. A question passes when `start_task` picks the expected or an acceptable workflow and at least one expected chapter or post is in the top chunks. Workflow examples are paraphrases, never bank questions (`npm run agent:check` enforces this), so the test doesn't grade itself. Problems graded `gap` have no expected chapter coverage yet; score them on workflow only.
