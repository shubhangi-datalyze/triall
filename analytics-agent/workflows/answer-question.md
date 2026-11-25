---
id: answer-question
name: Answer a question
use_when: The user wants to know how something works, how to do something, or which option to pick. Theory, how-to and comparisons, including how to fix or set up something in their tracking, which tool, stack or warehouse to use, and how to design or run a test. No number to pull and no request to inspect their setup.
not_for: Anything that needs their data to answer. "Why did my retention drop?" is explain-change, not this. Producing a metric list, tracking plan or dashboard spec for their product (plan).
examples:
  - "Is day 7 retention counted only on day 7, or day 7 and later?"
  - "Amplitude or PostHog for a two-person startup?"
  - "Our purchase event fires twice when the server retries. How do we stop that?"
  - "At what point is a warehouse worth it?"
modules: []
knowledge: [what-is-product-analytics, product-vs-business-analytics, product-analyst-mindset, product-analytics-by-stage, creating-a-tracking-plan, event-verification, identity-stitching, data-loss, mmp-and-utm-tracking, data-modelling, unifying-data, analytics-and-ai, incremental-testing, media-mix-modelling, experimentation, qual-plus-quant-analysis, data-accuracy-as-a-system]
---

# Answer a question

## Step 1: Check it is really a question
<!-- step
id: check-question
report: Whether the request can be answered without their data. If it can't, the task you called start_any_analytics_question_metrics_retention_funnels_tracking with and what you told the user.
knowledge: [what-is-product-analytics, product-vs-business-analytics]
-->

If answering it needs their data ("why did my retention drop?", "what's our D30?"), it is a task. Call `start_any_analytics_question_metrics_retention_funnels_tracking` with that task to get its workflow, and tell the user you are doing so.

## Step 2: Search the knowledge base
<!-- step
id: search
report: The searches you ran and the chapters or posts that came back, with their links. Say if the knowledge base had nothing on it, and which part of the answer will come from general knowledge.
-->

Search the knowledge base with `search_knowledge`. Answer from what comes back and cite the chapter or post with its link. If the knowledge base has nothing on it, say so, then answer from general knowledge and mark that part as not from Datalyze.

## Step 3: Lead with the answer
<!-- step
id: answer
report: The first sentence of your answer, which answers the question on its own, then the reasoning and trade-offs you gave and the chapter or post cited for each.
-->

The first sentence should answer the question on its own. Then the reasoning, then the trade-offs.

## Step 4: Make it specific to their product
<!-- step
id: specific
ask: true
report: The 1 or 2 questions you asked and how each answer changes the advice, or the facts about their stage, platform, business model and tools you already knew and used. Say which you were told and which you assumed.
knowledge: [product-analytics-by-stage]
-->

Ask 1 or 2 questions whose answers change the advice, such as their stage (sign-ups a month), platform (web, app, both), business model, or current tools, then wait for the reply. If you already know these from the conversation, use them, say so, and copy the words they used into `user_answer`.

## Step 5: Offer the next step
<!-- step
id: next-step
fields: [write_up]
report: The work with their data you offered to run (an audit, a tracking plan, a number to check), or that the answer implies none.
-->

If the answer implies work they can do with their data (an audit, a tracking plan, a number to check), say which and offer to run it.
