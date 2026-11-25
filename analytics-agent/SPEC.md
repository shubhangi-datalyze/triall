# Datalyze Analytics Agent: Spec

Status: draft v1, 6 Oct 2026. Owner: Ansh.
Items marked **(added)** are review suggestions, not Ansh's original notes. Keep, edit or delete them.

---

## 1. What we're building

An MCP connector that makes any AI (Claude, ChatGPT, Gemini) do analytics the way Datalyze does.

- The user connects their own data tools (PostHog, Mixpanel, Amplitude, GA4, BigQuery) plus our connector.
- Our connector never touches their data. It tells the AI **how** to work (workflows) and **what Datalyze knows** (knowledge base).
- Their AI runs the queries through their own data connectors and follows our steps.

### Decisions made so far

1. **Don't write 54 problem playbooks.** Use 8 workflows, one per type of task. The topic (retention, payments, attribution) comes from the knowledge base.
2. **The knowledge base is the existing content**: playbook chapters, blog posts and anything new. No rewriting.
3. **Split content by section (H2/H3), not one chunk per chapter.** Every chunk carries its chapter title and URL. Full chapters can still be fetched when needed.
4. **Hybrid search**: keyword plus meaning-based, so exact terms like "ID merge" or "GA4 sessions" still match.
5. **The question bank (392 questions, 55 problems) becomes the test set**, not the content. See `analytics_question_bank.csv`.
6. **A few topics need a "usual suspects" note** (likely causes, in the order to check them) where the chapters don't already cover this. Expect 5 to 8, not 54.

---

## 2. Architecture

```
User's AI (Claude / ChatGPT / Gemini)
  ├── their data connectors (PostHog, Mixpanel, BigQuery...)  ← runs the queries
  └── Datalyze MCP                                             ← says how, and what we know
        ├── Layer 1: principles.md        always returned
        ├── Layer 2: workflows/*.md       8 task types, returned when matched
        ├── Shared modules: modules/*.md  reused steps (funnel deep dive, data health check...)
        └── Layer 3: knowledge chunks     playbook + blog, split by section, searchable
```

### Folder layout (in the repo)

```
analytics-agent/
  principles.md
  workflows/
    answer-question.md
    pull-number.md
    explain-change.md
    find-opportunities.md
    reconcile-numbers.md
    audit.md
    plan.md
    judge-result.md
  modules/
    data-health-check.md
    funnel-deep-dive.md
    metric-tree-rate-mix.md
    story-output.md
    analytics-strategy.md   condensed from the analytics-strategy-creator skill
    tracking-plan.md        condensed from the event-tracking-plan-creator skill
  suspects/            (added) short "usual suspects" notes per topic
    retention.md
    activation-onboarding.md
    payments-revenue.md
    attribution.md
  knowledge/           generated: chunks from playbook + Ghost blog (npm run agent:knowledge)
  tests/
    analytics_question_bank.csv
    routing.csv        expected workflow, suspects and chapters per problem
  CONTENT-MAP.md       what feeds what, gaps, answers to section 6
  README.md            handoff for the MCP server
```

### MCP tools (first version)

| Tool | Input | Returns |
|---|---|---|
| `start_task` | the user's request, the data tools they have connected | Which workflow fits, principles, the workflow steps, related modules, the top 3 knowledge chunks |
| `search_knowledge` | a query | The 5 to 8 best chunks, each with chapter or post title and link |
| `get_chapter` | a chapter or post id | The full text |

**(added)** The tool description for `start_task` must say clearly: "Call this before answering any analytics question or doing any analysis." Otherwise the AI skips it.

---

## 3. Layer 1: Principles (apply to every task)

Ordered in the sequence the agent should follow. **(added: reordered so product context comes first)**

1. **Get product context first.** Use what the AI already knows about the product, or ask the user: what the product does, the business model, who pays, what the main user actions are.
2. **Confirm the definition before pulling any number.** Pin down the event or table, the time range, the time zone and the exclusions. Ask how to exclude test and internal users: do they already have a filter or cohort, or should we figure it out together?
3. **Check the data before analysing it.** There's no point analysing broken data. See `modules/data-health-check.md`.
4. **Ask for business context.** Did something change on a certain day: a release, a pricing change, a campaign, an outage, a tracking change?
5. **Say every assumption out loud.**
6. **Flag numbers that might not be real.** If a result isn't statistically meaningful, show it with a caveat. Never present a shaky number confidently.
   - **(added)** Default rule of thumb: be cautious about any segment with fewer than 30 users or fewer than 10 conversions. Confirmed by Ansh, 6 Oct 2026.
7. **Tell it as a story.** The finding first, then the proof, then what to do. Write for a non-technical founder. See `modules/story-output.md`.
8. **(added) Ask in small batches.** Ask at most 3 questions at a time, and only questions whose answers change the analysis.
9. **(added) Know what you can and can't access.** If the user has no data connector, ask them to paste numbers or exports, or give them the query to run. Never invent data.
10. **(added) Switch workflows when needed.** If a deep dive finds broken data, stop and move to Reconcile or Audit. Tell the user why.

---

## 4. Layer 2: Workflows

### 4.1 Answer a question
For theory and how-to questions: "How do I do an audit?", "Mixpanel or PostHog?"

1. Search the knowledge base. Answer from it and cite the chapter or post.
2. Ask 1 to 2 questions that make the answer specific to their product, not generic.
3. **(added)** If the question is really a task ("why did my retention drop?"), route to that workflow instead.

### 4.2 Pull a number
For example: "What's our D30 retention?", "How many paid users last month?"

1. Apply principles 1 to 3: definition, time range, exclusions, data check.
2. **(added)** Confirm which tool or table is the source of truth for this number.
3. Pull the number.
4. **(added)** Sense-check it against something known: last period, their own dashboard, their billing system.
5. **(added)** Return the number, the exact definition used and the caveats together. Never the number alone.

### 4.3 Explain a change
For example: "Why did retention drop?", "Why is revenue down?"

Base flow (all cases):
1. Pin the definition.
2. Check the change is real (`modules/data-health-check.md`).
3. **(added)** Find out whether it's a sudden drop or a gradual decline. A sudden drop points to a release, a tracking change or an outage. A gradual decline points to mix, product or market.
4. List hypotheses. Use the topic's `suspects/` note and the knowledge base.
5. Confirm the hypotheses with the user and ask what's missing.
6. Pull and break down the data.
7. Watch session replays if the tool has them (PostHog, Mixpanel and Amplitude do). If not, say they were skipped.
8. Write the founder-friendly story (`modules/story-output.md`).

By type of change:

- **A funnel drop:** run `modules/funnel-deep-dive.md`.
- **A retention drop:**
  - Break the retention chart down by segment:
    - behaviour segments, such as first session under 10 seconds vs the rest
    - persona segments, such as marketing source, device, role or plan
  - **(added)** Split by signup cohort (week or month) to see whether new users or existing users changed.
  - If one segment dropped, that segment points to the cause.
  - If no segment stands out, use the business context to help the user list likely overall causes.
- **A sudden drop in a top-line number** (revenue, orders):
  - Build the metric tree for that number.
  - Check every branch.
  - Use rate vs mix analysis to size how much each branch caused (`modules/metric-tree-rate-mix.md`).

### 4.4 Find opportunities
For example: "Where are we losing users?", "What should I look at?"

1. Use the AAARRR funnel. The default core funnel is new user → signup → onboarding complete → activation → revenue → retention → referral. Adapt it to the product.
2. Ask for the definition of each step: event names or tables, and filters. What counts as signup, activation and retention?
3. Build the funnel and find the biggest drop-off.
4. Break the funnel down by the important factors. Ask if there's any other factor they want to break it down by.
5. Show the gaps.
   - **(added)** Rank them by impact: the size of the drop × the number of users affected.
6. If the user asks to go deeper into one funnel, run `modules/funnel-deep-dive.md`.

### 4.5 Reconcile two numbers
For example: "Mixpanel says 1,200 signups, our database says 1,450."

1. Understand how each number is calculated on each platform.
2. Tell the user if the two are comparable or not.
3. Check, in this order:
   - same definition?
   - **(added)** same unit (users vs events vs sessions)?
   - same time zone?
   - duplicate users?
   - filters?
   - lost events (ad blockers, client-side drops)?
   - **(added)** For revenue: taxes, refunds, currency, discounts.
   - **(added)** For marketing: attribution window, and view-through vs click.
4. If they're comparable, give a corrected version that matches on both sides.
5. **(added)** Size the remaining gap and say whether it's within a normal range. The data-loss and data-accuracy-as-a-system chapters cover how far apart analytics and database numbers should be; the thresholds are in `workflows/reconcile-numbers.md` step 5.

### 4.6 Audit
1. Use the audit checklist from the playbook and check it thoroughly.
2. **(added)** Ask which tool, which project, and what access the AI has before starting.
3. **(added)** Output: a score per area, then fixes ranked by severity (breaks decisions / misleading / cleanup).
4. **(added)** Confirm the playbook checklist is complete enough to run step by step. If not, write `workflows/audit.md` as an explicit checklist.

### 4.7 Plan
- **Metrics:** use the analytics strategy method (from the `analytics-strategy-creator` skill).
- **Tracking plan:** use the tracking plan method (from the `event-tracking-plan-creator` skill).
- **Dashboard:**
  - Get a clear objective.
  - Get definitions for the major metrics.
  - Ask what insights they want from it.
  - **(added)** One dashboard per audience. Every chart answers a named question.

### 4.8 Judge a result
For example: "Did the launch work?", "Is this A/B test a win?", "Is this channel worth it?"

1. Check the sample size.
2. Check statistical significance.
3. Check for biases:
   - **(added)** Was the split between groups random and even?
   - Did anything else change at the same time?
   - Is this a novelty spike right after launch?
4. Normalise and re-check.
   - **(added)** Compare rates, not raw counts.
   - Use the same time window, and account for weekday and seasonality.
5. Run rate vs mix analysis.
6. **(added)** Give a verdict in plain words: win / no clear effect / loss / can't tell yet. Say what would make it conclusive.

---

## 5. Shared modules

### modules/data-health-check.md
- Has any relevant event stopped flowing, or dropped from a certain day?
- Are key property values suddenly null or "not set"?
- Has a distribution shifted? Look at platform, app version, country and source mix.
- **(added)** Are events firing twice? Compare events per user over time.
- **(added)** If something is broken, stop. Report what is broken from which date, then switch to Reconcile or Audit.

### modules/funnel-deep-dive.md
Used by Explain a change and Find opportunities. **(added: written once here instead of twice)**

1. Compare users who convert with users who don't:
   - behaviour: actions they take before converting or dropping off
   - persona: role, onboarding choices, device, marketing source
2. Find the few factors that clearly separate converters from non-converters.
   - **(added)** Use a time limit on behaviours ("did X within 7 days"), or the comparison gets distorted by users who were around longer.
3. Combine the strongest segments and re-check funnel conversion. This shows the best and worst performing groups.
4. Watch session replays of non-converters to see why they drop off.
5. Write the findings, plus experiments the team should run.
6. Pull insights from the playbook chapter on this method.
7. **(added)** Treat a strong link as a hypothesis, not proof. "Users who do X convert 3x more" needs a test before pushing everyone to do X.

### modules/metric-tree-rate-mix.md
- Break the number into its parts. For example: revenue = users × conversion × price × repeat.
- For each part, separate "the rate changed" from "the mix of users changed".

### modules/story-output.md
**(added)** Output template:
1. The headline finding, in one sentence with the number.
2. 2 to 3 supporting points, each with a chart or a number.
3. What to do: experiments or fixes, in priority order.
4. Caveats and assumptions.
5. The appendix: definitions and queries used.

---

## 6. Open questions for Ansh

Answered in `CONTENT-MAP.md` (6 Oct 2026). Ansh's answers, 6 Oct 2026: threshold is fewer than 30 users or 10 conversions; serving full playbook text through the connector is intended; the metric-definitions chapter is fixed to the one-day definition; the uncovered topics are out of scope.

1. Which playbook chapters hold the audit checklist, the funnel deep dive method, the metric tree and the "how far apart" numbers? These need confirming against the repo.
2. What's the significance threshold for principle 6?
3. Which topics need a `suspects/` note? Suggested first: retention, payments and revenue, attribution and UTMs, signup and onboarding funnel.
4. Should `start_task` return the whole workflow at once, or one step at a time? Whole is simpler to build. Step-by-step is followed more reliably and protects the content better. Suggest whole for v1.

---

## 7. Next steps

| # | Step | Where | Output |
|---|---|---|---|
| 1 | Add this spec and the question bank CSV to the repo | Repo | Done |
| 2 | Map the content: list every playbook chapter and Ghost post, and fill in the open questions in section 6 | Claude Code | Done: `CONTENT-MAP.md` |
| 3 | Write `principles.md`, the 8 workflows and the 4 modules from this spec. Claude drafts, Ansh reviews each file | Claude Code | Done, reviewed in two independent verification rounds |
| 4 | Write the 3 to 4 `suspects/` notes | Claude Code + Ansh | Done, 4 approved by Ansh |
| 5 | Build the chunker: playbook + Ghost → chunks by section, with title, URL and tags | Claude Code | Done: `scripts/analytics-agent/build-knowledge.ts` |
| 6 | Index with hybrid search (Postgres + pgvector, e.g. Supabase) | Claude Code | Done, in memory instead: BM25 + Voyage embeddings built by `npm run agent:embed` (`lib/analytics-agent/search.ts`) |
| 7 | Build the MCP server with the 3 tools (remote, e.g. Cloudflare Workers) | Claude Code | Done on Vercel (`app/api/datalyze/mcp`), with step-by-step serving: start_task, next_step, search_knowledge, get_chapter |
| 8 | Routing test: run 100 questions from the bank and check each one hits the right workflow and chunks. Fix the misses | Claude Code | Done on all 392: `npm run agent:route-test`, `tests/routing-report.md` |
| 9 | End-to-end test: connect it next to PostHog or Mixpanel on a real project. Run Explain a change, Pull a number and Reconcile | Claude.ai | 3 test transcripts |
| 10 | Then add login, Stripe payments and rate limits | Claude Code | Paid v1 |

Steps 3 and 4 are where Ansh's time goes. Everything else Claude Code can build.
