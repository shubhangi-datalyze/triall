# Duplicate content audit: joindatalyze.com

Audited 2026-10-14 against the live site (www.joindatalyze.com), the Ghost Content and Admin APIs, and the repo on `feat/playbook`. Nothing has been changed. This is for review only.

## How this was done

- **Inventory:** every URL in `/sitemap.xml` (80) and `/blog/sitemap.xml` (83), plus the blog pagination pages and the legacy URLs you listed. Each one was fetched live and parsed for title, H1, meta description, canonical, robots and links. The full table is in the appendix.
- **Word counts:** for Ghost posts this is the post body (Ghost `plaintext`). For every other page it's the text inside `<main>`, so it includes on-page CTAs and FAQ blocks. Treat them as relative sizes, not exact counts.
- **Duplication:** 6-word shingle overlap between every pair of pages, with site-wide boilerplate removed. I also read the H2 outline of every page in a group to see what each one covers.
- **Links:** every internal link on every page was requested without following redirects.
- **External copies:** the Substack archive at mixpanelsimplified.substack.com was compared post by post with the Ghost posts.

**What I could not see:** your Search Console lists. I don't know which exact URLs are in the 39 "discovered, not crawled" and 16 "crawled, not indexed" buckets. Before acting, check the recommendations below against those two lists. My guesses about what's in them are in §4.1.

---

## Status: what's done and what's left (updated 2026-10-14)

Checked against the working tree on `feat/playbook`, live Ghost and Substack. The other chat's work (`seo-indexing-fixes.md`) covered much of this audit.

**Important:** all the repo changes below are **uncommitted** in the working tree. 41 files are modified, and `components/related/` and `lib/related-services.ts` are new. None of it is live yet. Ghost changes are live.

### Done in the repo (needs commit and deploy)
| Audit item | Where |
|---|---|
| 16 /ask pages retired and 301'd (§2) | `next.config.ts`, plus `RETIRED_ASKS` in `lib/data/ask-answers.ts`. They drop out of the sitemap and llms files on their own. |
| /ask entries removed from `EXEMPT` | `lib/data/seo-standard.ts` |
| /ask/how-do-i-set-up-mixpanel-properly redirect | `next.config.ts` |
| 4 /indian-d2c-playbook redirects | `next.config.ts` (questions-your-data-must-answer → D2C part 1, as proposed) |
| Root /week-N-learning-mixpanel-* rule | `next.config.ts`, placed before the slash-stripping rule. That placement is better than in my draft. |
| Redirects for overview-of-the-insights-report → week-11 and getting-start-with-mixpanel → week-1 | `next.config.ts` |
| Breadcrumbs: the /services and /industries crumbs removed from all 13 pages (§3.1) | app/services/*, app/industries/* |
| 5 homepage service links (§3.3) | `content/home.json` |
| "See how we did it" → /case-studies | `case-cards.tsx` (`ctaHref`), `home-sections.tsx` |
| /services/analytics-setup retitled to "Analytics Setup: Tracking Plan to Verified Events" (group 20) | page metadata |
| Retention microsite: links to /ask swapped for the blog posts, and title/H1 changed | `public/resources/retention-demo.html` |
| "Keep reading" now picks posts from the post's own series or topic instead of the three newest (§3.2) | `relatedTo()` in `app/blog/[slug]/page.tsx` |
| Chapter → lifecycle-of-a-problem-statement link (group 16) | `content/playbook/product-problem-framework.mdx` |

**Extra, from the other plan and not in this audit:** `/blog/transforming-analytics-from-a-support` → `/playbook/product-analyst-mindset`. I didn't assess this post. It's consistent with this audit, though the target is a loose match, as the other plan says.

### Done in Ghost (live)
- Titles and meta titles in line with this audit:
  - week-6: "Mixpanel Proxy Setup…"
  - week-8: "Mixpanel SDK Implementation…"
  - weeks 7 and 10: Mixpanel-specific titles
  - lifecycle-of-a-problem-statement: "How to Write a Good Problem Statement…"
- In-post links cleaned up: no links to Substack, cms.joindatalyze.com, the apex domain or datalyzeinsights remain in any post.

### Done in this pass (2026-10-14): repo uncommitted, Ghost live
**Repo**
- **Six blog merges.** Content from each retired post was folded into the page that replaces it. Each now has a 301 in `next.config.ts`:
  - mixpanel-setup-the-right-way and developers-guide-to-implementing went into Ghost posts (see below).
  - data-tracking-comparing-client-vs went into `content/tracking-methods.json`: the "hybrid" term, an ad-blocker FAQ, and links to week-6 and /playbook/data-loss.
  - how-to-create-an-analytics-strategy went into `/playbook/analytics-strategy`: a new section, "How many metrics should you start with?", the AAARRR template, and a new FAQ.
  - how-to-create-a-tracking-plan-and and creating-an-event-tracking-plan-for went into `/playbook/creating-a-tracking-plan`: how to find candidate events, a data-type column, and the sample sheet.
- **All redirects are one hop, including trailing-slash forms.** The consolidated block now sits before the slash-stripping rule. Verified on a local production build: 17 sources tested, all a single 308 to a 200.
- **Chapters**
  - The analytics strategy title is now "Analytics strategy: how to pick metrics you can act on".
  - The MMM chapter names "marketing mix modelling / MMM".
  - Cross-links added, chapter → post/tool: incremental-testing → D2C 6; unifying-data → D2C 2 and connecting-marketing; data-accuracy → you-have-data-flowing; tracking plan → generator and D2C 4; analytics strategy → vanity-metrics post and strategy creator.
- **Part pages** each have their own guide: three paragraphs on what the part answers, who it's for and the order to read it in. These are `parts.*.guide` in `content/playbook.json`, rendered in `app/playbook/part/[part]/page.tsx`. The stale "What to measure" and "Your data stack" intros were fixed; they still described chapters removed on 2026-09-30.
- **Service pages:** the Mixpanel and Amplitude steps and the fix-existing-setup FAQ now name each tool's own features (Lexicon and ID merge; Amplitude Data).
- **/ask:** noindex, follow. Removed from the sitemap (`CORE_ROUTES`). llms.txt now titles that section "Ask Ansh's AI".
- **Small fixes**
  - "Setting up PostHog" label.
  - llms.txt: no URL ends in a full stop.
  - `TOP_BLOG_POSTS`: the two merged posts are replaced by week-12 and connecting-marketing.
  - `lib/data/ask-questions.ts` links now point to the live destinations.
  - The dead DatalyzeInsights card is removed from /resources.
- **Checks:** `content:check`, `typecheck`, `playbook:links`, lint on changed files, `npm test` (62/62) and `npm run build` all pass. `seo:check` passes every automated rule on the 6 chapters changed. /resources/client-vs-proxy-vs-server-tracking fails rules 10, 11 and 14; it fails the same rules on production today, and it's on `EXEMPT`.

**Ghost (live now).** Backups of every edited post, taken before editing, are in the session scratchpad.
- how-to-set-up-product-analytics-the-right-way:
  - New "three rules for that dashboard" paragraph and a "What changes if you're setting up Mixpanel?" section, both from mixpanel-setup-the-right-way.
  - Its "Related" link (which would have become a self-link) now points to week-8.
- week-8: added the anonymous → identified stitching explanation, the silent double-count warning, and a "Check the data before anyone uses it" section linking week-9. All from developers-guide-to-implementing.
- Links repointed to the new destinations: week-7, week-10, what-are-events-and-properties-in, you-have-data-flowing-everywhere-and-trust-none-of-it.
- why-its-time-to-switch-from-ga-to: new short-version opening, meta description and excerpt (the retired ask answer's summary).
- solving-retention-problems-a-strategic: retitled "How to Measure Retention: Define It, Then Compare Cohorts", with a new opening, meta and excerpt.
- connecting-marketing-and-product-data: retitled "How to Join Marketing and Product Data Across Subdomains". The slug is unchanged.

### Still to do

**A. Commit and deploy.** Nothing in the repo is live yet. The working tree also holds the other chat's changes, so review the whole diff together.

**B. Right after the deploy is live**
1. Unpublish these 9 posts in Ghost. The redirects take over only once each post is unpublished, and until then they're still in /blog/sitemap.xml:
   - overview-of-the-insights-report
   - getting-start-with-mixpanel-the-basics
   - transforming-analytics-from-a-support
   - mixpanel-setup-the-right-way
   - developers-guide-to-implementing
   - data-tracking-comparing-client-vs
   - how-to-create-an-analytics-strategy
   - how-to-create-a-tracking-plan-and
   - creating-an-event-tracking-plan-for
2. `npm run agent:knowledge`, so the /ask chat stops citing the retired URLs.
3. Re-crawl the redirect sources on production.
4. Search Console: request indexing for the main pages, and resubmit both sitemaps.

**C. Needs you**
- **Substack (§4.1).** All 46 copies are still live, and this is still the biggest single cause of the indexing problems.
- **Review the copy I wrote** before committing:
  - the six part-page guides;
  - the new chapter paragraphs;
  - the Mixpanel and Amplitude service bullets. These describe Lexicon and Amplitude Data work as part of the service, so check that matches what you actually do.
  - The Notion AAARRR template link in the analytics strategy chapter is the one the 2024 post used. I couldn't confirm it's still public, because Notion renders client-side.
- **The PostHog vs Mixpanel/Amplitude service pages still share their FAQs** (timeline, developers, ownership). Those answers are genuinely the same across tools. Making them differ would need real tool-specific detail from you.
- **Ghost drafts:** don't publish `how-to-actually-improve-your-apps-retention` or `identity-stitching-how-most-analytics-setups-quietly-break` as separate posts.
- **Optional:** 29 posts link "my website" to anshdoesanalytics.com.

---

## 0. Summary

1. **The biggest duplicate problem is off-site.** All 46 Ghost posts published before 2026 also exist on **mixpanelsimplified.substack.com**, under the same slugs, with older dates and self-referencing canonicals. Between 82% and 100% of each Substack post's text appears in the joindatalyze version. Google sees the joindatalyze copies as later duplicates of the Substack originals. This is the most likely reason so many blog posts sit in "crawled, not indexed". See §4.1.
2. **On-site, the overlap is mostly by topic, not by copied text.** Apart from three clusters (playbook part pages vs the playbook hub, the three tool service pages, week-7 vs the tracking-plan post), pages don't share much wording. They compete because they answer the same question.
3. **The 16 /ask pages are thin and isolated.** Each is 250–470 words summarising a blog post. Nothing on the site links to them except other ask pages (and the retention microsite, which links to two). /ask itself doesn't link to them. That pattern of sitemap-only discovery and derivative content is a textbook cause of "discovered/crawled, not indexed". **Recommendation: 301 all 16 to the page each one summarises.**
4. **The playbook should be the main page wherever a chapter covers the topic.** This matches your existing rule: when a chapter and a post disagree, the chapter wins. Older 2024–25 posts on the same topic merge into it.
5. **No live internal link is broken or redirects.** All 183 internal link targets return 200. The redirecting references are in **JSON-LD breadcrumbs** (13 files) and in links that will need updating once the redirects below go in.
6. **The homepage has five service links that go to /contact** instead of the service page, plus one case-study CTA. Confirmed in `content/home.json`. See §3.3.
7. **favicon.ico is fine.** `/favicon.ico` returns 200 via the rewrite in `next.config.ts` to `/icon.png`. Nothing to do.
8. **There are four legacy 404s, not three.** The old `/indian-d2c-playbook/*` section had four pages, removed on 2026-06-18 without redirects. Redirects are in §2.

**Totals:** 30 redirects (16 /ask, 8 blog, 4 legacy D2C, 1 root week-26, 1 old ask slug). 8 of those are blog posts that need content merged first. 3 Ghost drafts would create new duplicates if published as they are.

---

## 1. Groups and recommendations

Actions: **MERGE** = move unique content into the main page, then 301. **REDIRECT** = nothing unique, 301. **KEEP** = stands alone (reason given). **DELETE** = no value and no target (none recommended).

For any blog post being redirected: unpublish it in Ghost in the same release. If you don't, it stays in `/blog/sitemap.xml` and the blog index and keeps linking to itself.

### Group 1: Client vs server-side tracking
Main: **/resources/client-vs-proxy-vs-server-tracking**. It has the cleanest URL, it's the only page that covers proxy tracking, it's the newest, and it lives in the content system.

| URL | Title | Words | Action | Maps to |
|---|---|---|---|---|
| /resources/client-vs-proxy-vs-server-tracking | Client vs Proxy vs Server Side Tracking | 894 | **MAIN** | n/a |
| /ask/client-vs-server-side-tracking | Should I track client-side or server-side? | 366 | REDIRECT | main |
| /blog/data-tracking-comparing-client-vs/ | Client vs Server vs Hybrid Tracking | 668 | MERGE: bring over the "hybrid" framing and the FAQ "Does server-side tracking avoid ad blockers?" | main |
| /blog/week-6-learning-mixpanel-choosing/ | Mixpanel Tracking: Client vs Server vs Hybrid | 511 | KEEP: part of the 28-week series, and Mixpanel-specific (it covers setting up a Mixpanel proxy). Retitle around "Mixpanel proxy setup" and link to main. | n/a |

Related, not a duplicate: /playbook/data-loss covers ad-blocker loss. Link it from main.

### Group 2: Mixpanel / analytics setup
Main: **/blog/how-to-set-up-product-analytics-the-right-way/**. It's the 2026 rewrite of the 2024 "Mixpanel setup → The right way" (same 5-step structure, broadened to Mixpanel/Amplitude/PostHog). It's the strongest and newest piece.

| URL | Title | Words | Action | Maps to |
|---|---|---|---|---|
| /blog/how-to-set-up-product-analytics-the-right-way/ | How to Set Up Product Analytics the Right Way | 2,146 | **MAIN** | n/a |
| /blog/mixpanel-setup-the-right-way/ | How to Set Up Mixpanel the Right Way: 5 Steps | 777 | MERGE: it's the older version of the main post. Add a short "If you're on Mixpanel" section to main so the Mixpanel-setup query still has an answer. | main |
| /ask/how-to-set-up-mixpanel-properly | How do I set up Mixpanel the right way? | 388 | REDIRECT | main |
| /ask/how-do-i-set-up-mixpanel-properly | (404 today, not in the repo or git history) | n/a | REDIRECT | main |
| /blog/developers-guide-to-implementing/ | Mixpanel Client-Side Implementation: Developer Guide | 669 | MERGE into week-8: same sections (token, install, track, property types, identity, verify), and week-8 goes further | /blog/week-8-learning-mixpanel-setting/ |
| /blog/getting-start-with-mixpanel-the-basics/ | Getting Started with Mixpanel: First Steps | 375 | REDIRECT. The startup program is covered in week-2, the data-flow check in week-9, and account setup in week-1. Typo in slug. | /blog/week-1-learning-mixpanel-introduction/ |
| /blog/week-1-learning-mixpanel-introduction/ | What Is Mixpanel? An Introduction | 337 | KEEP: answers "what is Mixpanel", not "how to set it up" | n/a |
| /blog/week-8-learning-mixpanel-setting/ | How to Set Up Mixpanel: SDK, ID Merge, Properties | 1,103 | KEEP: the technical SDK tutorial. Retitle to "Mixpanel SDK Implementation: ID Merge, Super Properties" so it stops chasing "how to set up Mixpanel". | n/a |
| /services/mixpanel-implementation | Mixpanel Consulting & Implementation | 2,249 | KEEP: hiring page. Link to main and to week-8. | n/a |

### Group 3: Analytics strategy
Main: **/playbook/analytics-strategy**.

| URL | Title | Words | Action | Maps to |
|---|---|---|---|---|
| /playbook/analytics-strategy | Analytics Strategy: Choosing Metrics That Are Actionable | 1,821 | **MAIN** | n/a |
| /ask/how-to-build-an-analytics-strategy | How do I build an analytics strategy for my product? | 372 | REDIRECT | main |
| /blog/how-to-create-an-analytics-strategy/ | How to Create an Analytics Strategy for Your Product | 712 | MERGE: "break the product down first", "don't go too deep", and the Notion strategy template link | main |
| /blog/week-10-learning-mixpanel-creating/ | Analytics Strategy for Mixpanel in 3 Steps | 550 | KEEP: series post. Its SEO title is already Mixpanel-specific. Link to main. Optionally set Ghost's canonical URL on this post to the chapter. | n/a |
| /blog/let-go-of-vanity-metrics-and-start/ | Vanity Metrics vs Actionable Metrics | 855 | KEEP: owns "vanity metrics". To stop competing, the chapter's title should lead with "analytics strategy" rather than "actionable metrics", and the two should link to each other. | n/a |
| /tools/analytics-strategy-creator | Free Analytics Strategy Creator - Claude Skill | 1,279 | KEEP: tool, not an article. Link to main. | n/a |

### Group 4: Tracking plans
Main: **/playbook/creating-a-tracking-plan**. It covers everything the three older posts do: property types, naming, event vs property, keeping the plan fresh, and ownership.

| URL | Title | Words | Action | Maps to |
|---|---|---|---|---|
| /playbook/creating-a-tracking-plan | How to Create a Tracking Plan Before Anyone Writes Code | 1,886 | **MAIN** | n/a |
| /ask/what-is-an-event-tracking-plan | What should be in an event tracking plan? | 354 | REDIRECT | main |
| /blog/how-to-create-a-tracking-plan-and/ | How to Create a Tracking Plan and Why It Matters | 1,120 | MERGE: "how do you decide what to track", plus the Google Sheets template link | main |
| /blog/creating-an-event-tracking-plan-for/ | Event Tracking Plan: Scope, Naming and Structure | 770 | MERGE: the "actions vs outcomes" naming example, if the chapter lacks it | main |
| /blog/week-7-learning-mixpanel-creating/ | Mixpanel Event Tracking Plan: How to Create One | 738 | KEEP: series post with a unique worked example (Creattie sample plan). 41% text overlap with how-to-create-a-tracking-plan-and, which goes away once that post is merged. | n/a |
| /tools/event-tracking-plan-generator | Free Event Tracking Plan Generator - Claude Skill | 1,054 | KEEP: tool | n/a |
| /blog/d2c-playbook-4-event-taxonomy-tool-stack-before-you-scale-spend/ | D2C Event Tracking: Taxonomy and Tool Stack | 2,424 | KEEP: D2C-specific, and includes tool stack. Link to main. | n/a |

### Group 5: Marketing mix modeling
Main: **/playbook/media-mix-modelling**.

| URL | Title | Words | Action | Maps to |
|---|---|---|---|---|
| /playbook/media-mix-modelling | Media Mix Modelling: Measuring Untrackable Channels | 1,174 | **MAIN** | n/a |
| /ask/what-is-marketing-mix-modeling | What is marketing mix modeling and when is it worth it? | 421 | REDIRECT | main |
| /blog/d2c-playbook-7-marketing-mix-modeling-mmm/ | Marketing Mix Modeling (MMM) for D2C Brands | 2,859 | KEEP: the D2C/India worked example, and much deeper (adstock, saturation, calibration). Its title already says "for D2C Brands", so keep it that way. Make sure the chapter links to it as the worked example. | n/a |

Note: the chapter uses "media mix modelling", the post "marketing mix modeling". Both terms are searched. Make sure the chapter mentions both spellings near the top.

### Group 6: Incrementality testing
Main: **/playbook/incremental-testing**.

| URL | Title | Words | Action | Maps to |
|---|---|---|---|---|
| /playbook/incremental-testing | Incremental Testing: Are Your Ads Creating Demand? | 1,756 | **MAIN** | n/a |
| /ask/incrementality-testing-for-d2c | Incrementality Testing for D2C Brands | 473 | REDIRECT to the **D2C post**, because the question is D2C-specific | /blog/d2c-playbook-6-incrementality-testing/ |
| /blog/d2c-playbook-6-incrementality-testing/ | Incrementality Testing for D2C Brands \| Datalyze | 2,522 | KEEP: D2C geo-holdout walkthrough. Same title as the ask page today, which the redirect fixes. | n/a |

### Group 7: Inflated conversions
Main: **/blog/d2c-playbook-3-why-your-conversions-look-too-good/**. No playbook chapter covers this.

| URL | Title | Words | Action | Maps to |
|---|---|---|---|---|
| /blog/d2c-playbook-3-why-your-conversions-look-too-good/ | Why Your D2C Conversion Numbers Look Too Good | 2,055 | **MAIN** | n/a |
| /ask/why-do-my-conversions-look-too-good | Why do my conversions look too good? | 407 | REDIRECT | main |
| /indian-d2c-playbook/metrics-that-lie | (404; old "Playbook 01: why your ad dashboard is wrong") | n/a | REDIRECT | main |
| /indian-d2c-playbook/why-your-numbers-never-match | (404; old "Playbook 02: attribution reality check") | n/a | REDIRECT | main |

### Group 8: Branded search
Main: **/blog/70-of-your-branded-search-conversions-would-have-happened-anyway/**.

| URL | Title | Words | Action | Maps to |
|---|---|---|---|---|
| /blog/70-of-your-branded-search-conversions-would-have-happened-anyway/ | Are Branded Search Conversions Incremental? | 2,209 | **MAIN** | n/a |
| /ask/are-branded-search-conversions-real | Are my branded search conversions actually incremental? | 421 | REDIRECT | main |

### Group 9: Retention
Main: **/resources/improve-app-retention** for "improve retention". The blog post becomes the "measure retention" page, so the two stop competing.

| URL | Title | Words | Action | Maps to |
|---|---|---|---|---|
| /resources/improve-app-retention | How to actually improve your app's retention | 1,215 | **MAIN** | n/a |
| /blog/solving-retention-problems-a-strategic/ | How to Solve Retention Problems: A 3-Step Framework | 839 | KEEP: refocus on *defining and measuring* retention (bounded vs unbounded, cohorts), which the microsite doesn't cover. Retitle to "How to Measure Retention: Define It, Cohort It". Link to main for the "improve" step. | n/a |
| /ask/how-to-measure-retention | How do I measure retention properly? | 342 | REDIRECT to the blog post (measure intent) | /blog/solving-retention-problems-a-strategic/ |
| /blog/week-13-learning-mixpanel-retention/ | Mixpanel Retention Report: How It Works | 1,471 | KEEP: tool tutorial for the Mixpanel retention report | n/a |

Also: **Ghost draft `how-to-actually-improve-your-apps-retention`** has the same title as the microsite. Don't publish it as a separate post.

### Group 10: Analytics debt
Main: **/blog/analytics-debt-the-silent-killer-nobody-talks-about-until-series-b/**.

| URL | Title | Words | Action | Maps to |
|---|---|---|---|---|
| /blog/analytics-debt-…-until-series-b/ | What Is Analytics Debt? The 5 Stages | 2,175 | **MAIN** | n/a |
| /ask/what-is-analytics-debt | What is analytics debt and how do I know if I have it? | 413 | REDIRECT | main |

### Group 11: Aha moment
Main: **/blog/finding-the-aha-moment-for-your-product/**.

| URL | Title | Words | Action | Maps to |
|---|---|---|---|---|
| /blog/finding-the-aha-moment-for-your-product/ | How to Find Your Product's Aha Moment | 858 | **MAIN** | n/a |
| /ask/how-to-find-your-aha-moment | How do I find the aha moment for my product? | 339 | REDIRECT | main |

Only one page outside /ask links to the main post (§3.2). Link it from /playbook/product-funnel and /industries/consumer-apps.

### Group 12: GA4 vs Mixpanel
Main: **/blog/why-its-time-to-switch-from-ga-to/**.

| URL | Title | Words | Action | Maps to |
|---|---|---|---|---|
| /blog/why-its-time-to-switch-from-ga-to/ | Google Analytics vs Mixpanel: Why Switch | 540 | **MAIN** (weak: the body is short and mostly FAQ; worth expanding) | n/a |
| /ask/mixpanel-vs-ga4 | Should I move from Google Analytics to Mixpanel? | 373 | MERGE: its short answer is a better summary than the post's opening. Use it as the answer under the H1. | main |

### Group 13: Events, properties, super properties
Main: **/blog/what-are-events-and-properties-in/**.

| URL | Title | Words | Action | Maps to |
|---|---|---|---|---|
| /blog/what-are-events-and-properties-in/ | Mixpanel Events and Properties Explained | 708 | **MAIN** | n/a |
| /ask/events-vs-properties-in-mixpanel | Events vs Properties in Mixpanel | 318 | REDIRECT | main |
| /ask/what-are-super-properties | What are super properties and when should I use them? | 359 | REDIRECT. The main post has a super-properties section and an FAQ on whether they change historical events. | main |
| /blog/week-2-learning-mixpanel-mixpanel/ | Mixpanel Basics: Data Structure and Properties | 1,111 | KEEP: series post, broader (sessions, autocapture) | n/a |

### Group 14: Data trust
Main: **/blog/you-have-data-flowing-everywhere-and-trust-none-of-it/** (SEO title "How to Fix Data Nobody on Your Team Trusts").

| URL | Title | Words | Action | Maps to |
|---|---|---|---|---|
| /blog/you-have-data-flowing-everywhere-and-trust-none-of-it/ | How to Fix Data Nobody on Your Team Trusts | 2,479 | **MAIN** | n/a |
| /ask/why-nobody-trusts-our-data | Why does nobody on my team trust our analytics data? | 444 | REDIRECT | main |
| /playbook/data-accuracy-as-a-system | Data Accuracy as a System: Keeping Numbers Right | 1,256 | KEEP: about *keeping* data accurate (alerts, verification, backend reconciliation), not fixing distrust. Link both ways. | n/a |

### Group 15: Unifying data
Main: **/playbook/unifying-data**.

| URL | Title | Words | Action | Maps to |
|---|---|---|---|---|
| /playbook/unifying-data | Unifying Data: Making Your Tools Agree on One User | 1,687 | **MAIN** | n/a |
| /services/data-unification | Data Unification in BigQuery or Snowflake | 1,704 | KEEP: hiring page. Link to main. | n/a |
| /blog/d2c-playbook-2-putting-all-your-data-in-one-place/ | D2C Playbook 2: Put All Your Data in One Place | 2,557 | KEEP: specific to quick commerce (Blinkit/Swiggy/Amazon) | n/a |
| /blog/connecting-marketing-and-product-data/ | How to Connect Marketing and Product Data | 1,635 | KEEP: specific to stitching identity across www and app subdomains. Make the title say so, e.g. "Stitching Identity Across Your Marketing Site and App". | n/a |

Watch: /blog/you-have-data-flowing… (group 14), /blog/connecting-marketing-and-product-data/ and /blog/the-click-is-the-only-thing-your-ad-platform-can-see/ all argue "join ad data to product data and don't trust platform ROAS". The wording is different, so leave them as they are. Make sure each links to the other two, and don't write a fourth.

### Group 16: Problem framing
Main: **/playbook/product-problem-framework**.

| URL | Title | Words | Action | Maps to |
|---|---|---|---|---|
| /playbook/product-problem-framework | A Framework for Any Product Problem: Four Questions | 1,766 | **MAIN** | n/a |
| /blog/lifecycle-of-a-problem-statement/ | How to Write a Good Problem Statement for Analytics | 726 | KEEP: targets "problem statement" (writing one, prioritising, measuring), which the chapter doesn't. Link both ways. Orphaned today (§3.2). | n/a |
| /blog/the-mindset-for-solving-complex-problem/ | How to Solve Complex Analytics Problems: 5 Habits | 1,119 | KEEP: habits, not a framework. Overlaps /playbook/correlation-is-not-causation on one section; link there. Orphaned today. | n/a |

### Group 17 (new): Lexicon. Same title on two URLs
| URL | Title | Words | Action | Maps to |
|---|---|---|---|---|
| /blog/week-3-learning-mixpanel-introduction/ | **What Is Lexicon in Mixpanel?** \| Learning Mixpanel | 244 | **MAIN** | n/a |
| /ask/what-is-lexicon-in-mixpanel | **What is Lexicon in Mixpanel?** | 255 | REDIRECT | main |

### Group 18 (new): Mixpanel Insights report. Old version rewritten
| URL | Title | Words | Action | Maps to |
|---|---|---|---|---|
| /blog/week-11-learning-mixpanel-insights/ | Mixpanel Insights Report: Complete Guide | 2,073 | **MAIN** | n/a |
| /blog/overview-of-the-insights-report/ | Mixpanel Insights Report: A Quick Overview | 645 | REDIRECT: the 2024 version, fully covered by week-11. Orphaned today. | main |

### Group 19 (new): Playbook part pages repeat the hub
The six `/playbook/part/*` pages are 143–455 words each. **93–98% of their text appears word for word on /playbook**, because the hub lists the same chapter cards and descriptions. They're probably in "crawled, not indexed".

| URL | Words | Action |
|---|---|---|
| /playbook | 1,871 | **MAIN** |
| /playbook/part/foundations, /what-to-measure, /trustworthy-data, /your-data-stack, /reading-the-data, /acting-on-what-you-find | 143–455 | KEEP, but give each part page 150–300 words of its own intro (what the part answers, who it's for, the order to read it in) and shorten the hub's per-chapter blurbs. If you'd rather not write that, noindex them and drop them from `app/sitemap.ts`. Don't redirect: they're the chapter navigation. |

### Group 20 (new): Templated tool service pages
/services/mixpanel-implementation, /amplitude-implementation and /posthog-implementation share 40–49% of their text. They target different tool keywords, so **KEEP all three**, but rewrite the shared sections so each one carries tool-specific detail. /services/analytics-setup is titled "Mixpanel, Amplitude & PostHog Setup", which names all three tools and competes with each tool page. Retitle it to a tool-agnostic angle (e.g. "Analytics Setup: Tracking Plan to Verified Events").

### Not duplicates (service vs teaching, or tool vs article): keep both, check they link to each other
- /services/data-modelling ↔ /playbook/data-modelling
- /services/ai-layer ↔ /playbook/analytics-and-ai
- /services/analytics-audit ↔ /tools/analytics-maturity-grader
- /playbook/experimentation ↔ /tools/ab-test-calculator
- /playbook/identity-stitching ↔ **Ghost draft `identity-stitching-how-most-analytics-setups-quietly-break`**: don't publish the draft as a separate post, or it will compete with the chapter.
- /playbook/creating-a-tracking-plan ↔ **Ghost draft `creating-a-good-tracking-plan-using-ai`**: fine if it's about the AI workflow (and links to the tool); not fine if it's another "how to create a tracking plan".
- /blog/week-4 (cohorts) vs /blog/week-18 (cohorts from a report): different subtopics, keep.
- /blog/week-12 (Mixpanel funnels) vs /playbook/product-funnel: tool tutorial vs concept, keep.

### Duplicate slugs
- `week-9-learning-mixpanel-checking-6992b4900926b2001b6f6088` → already redirected to `week-9-learning-mixpanel-checking-data-flow` (308, verified).
- No other ID-suffixed or `-2` slugs among published posts or drafts.
- Cosmetic only: `getting-start-with-mixpanel-the-basics` (typo; redirected above anyway) and Substack-truncated slugs like `how-to-create-a-tracking-plan-and`. Don't rename the truncated ones. A rename costs a redirect hop and gains little.

---

## 2. 301 redirects to add

The repo keeps redirects in `next.config.ts` → `redirects()`. Blog redirects already go there too (the "Renamed Ghost post slugs" block), because /blog is rendered by Next.js and Next config redirects run before `middleware.ts`. Ghost `redirects.yaml` is **not** the right place: cms.joindatalyze.com already 301s everything to www.

Paste after the "Retired pages" block:

```ts
      // Consolidated duplicates (seo-duplicate-audit.md, 2026-10-14). Each
      // source covered the same search topic as its destination; the
      // destination is the one page we keep for that topic.
      ...[
        // /ask answers folded into the page each one summarised.
        { from: '/ask/client-vs-server-side-tracking', to: '/resources/client-vs-proxy-vs-server-tracking' },
        { from: '/ask/how-to-set-up-mixpanel-properly', to: '/blog/how-to-set-up-product-analytics-the-right-way/' },
        { from: '/ask/how-do-i-set-up-mixpanel-properly', to: '/blog/how-to-set-up-product-analytics-the-right-way/' },
        { from: '/ask/how-to-build-an-analytics-strategy', to: '/playbook/analytics-strategy' },
        { from: '/ask/what-is-an-event-tracking-plan', to: '/playbook/creating-a-tracking-plan' },
        { from: '/ask/what-is-marketing-mix-modeling', to: '/playbook/media-mix-modelling' },
        { from: '/ask/incrementality-testing-for-d2c', to: '/blog/d2c-playbook-6-incrementality-testing/' },
        { from: '/ask/why-do-my-conversions-look-too-good', to: '/blog/d2c-playbook-3-why-your-conversions-look-too-good/' },
        { from: '/ask/are-branded-search-conversions-real', to: '/blog/70-of-your-branded-search-conversions-would-have-happened-anyway/' },
        { from: '/ask/how-to-measure-retention', to: '/blog/solving-retention-problems-a-strategic/' },
        { from: '/ask/what-is-analytics-debt', to: '/blog/analytics-debt-the-silent-killer-nobody-talks-about-until-series-b/' },
        { from: '/ask/how-to-find-your-aha-moment', to: '/blog/finding-the-aha-moment-for-your-product/' },
        { from: '/ask/mixpanel-vs-ga4', to: '/blog/why-its-time-to-switch-from-ga-to/' },
        { from: '/ask/events-vs-properties-in-mixpanel', to: '/blog/what-are-events-and-properties-in/' },
        { from: '/ask/what-are-super-properties', to: '/blog/what-are-events-and-properties-in/' },
        { from: '/ask/why-nobody-trusts-our-data', to: '/blog/you-have-data-flowing-everywhere-and-trust-none-of-it/' },
        { from: '/ask/what-is-lexicon-in-mixpanel', to: '/blog/week-3-learning-mixpanel-introduction/' },

        // Older Ghost posts merged into the page that replaced them. Unpublish
        // each one in Ghost in the same release.
        { from: '/blog/data-tracking-comparing-client-vs', to: '/resources/client-vs-proxy-vs-server-tracking' },
        { from: '/blog/mixpanel-setup-the-right-way', to: '/blog/how-to-set-up-product-analytics-the-right-way/' },
        { from: '/blog/developers-guide-to-implementing', to: '/blog/week-8-learning-mixpanel-setting/' },
        { from: '/blog/getting-start-with-mixpanel-the-basics', to: '/blog/week-1-learning-mixpanel-introduction/' },
        { from: '/blog/how-to-create-an-analytics-strategy', to: '/playbook/analytics-strategy' },
        { from: '/blog/how-to-create-a-tracking-plan-and', to: '/playbook/creating-a-tracking-plan' },
        { from: '/blog/creating-an-event-tracking-plan-for', to: '/playbook/creating-a-tracking-plan' },
        { from: '/blog/overview-of-the-insights-report', to: '/blog/week-11-learning-mixpanel-insights/' },

        // The Next.js D2C playbook section, removed 2026-06-18 when the series
        // moved to Ghost.
        { from: '/indian-d2c-playbook', to: '/blog/tag/indian-d2c-playbook/' },
        { from: '/indian-d2c-playbook/metrics-that-lie', to: '/blog/d2c-playbook-3-why-your-conversions-look-too-good/' },
        { from: '/indian-d2c-playbook/why-your-numbers-never-match', to: '/blog/d2c-playbook-3-why-your-conversions-look-too-good/' },
        { from: '/indian-d2c-playbook/questions-your-data-must-answer', to: '/blog/d2c-playbook-1-the-data-foundation/' },
      ].map(({ from, to }) => ({ source: from, destination: to, permanent: true })),

      // Learning Mixpanel posts requested at the site root (a relative link
      // somewhere resolved without /blog). Covers all 28 weeks.
      {
        source: '/:slug(week-\\d+-learning-mixpanel-[a-z0-9-]+)',
        destination: '/blog/:slug/',
        permanent: true,
      },
```

Notes:
- **/blog sources have no trailing slash on purpose.** The existing comment in `next.config.ts` notes that path-to-regexp matches both forms, and the destination carries the slash, so it's one hop.
- **The questions-your-data-must-answer target is a judgment call.** The old page was about "two layers of analytics questions". D2C Playbook 1 is the closest live match. /playbook/analytics-strategy is the alternative if you'd rather send it to the general chapter.
- **The ask redirects take precedence over the route,** but also remove those 16 entries from `ASK_QUESTIONS` in `lib/data/ask-questions.ts` (or set `reviewed: false`). Otherwise they stay in `/sitemap.xml` (via `lib/data/site-routes.ts:64`), `/llms.txt` (`app/llms.txt/route.ts:61`) and `/llms-full.txt`, all pointing at redirects. Remove them from `EXEMPT` in `lib/data/seo-standard.ts:60-75` in the same change.
- **The /ask chat UI is unaffected.** It's the per-slug pages that go.
- **After the merges, rebuild the agent's knowledge** (`npm run agent:knowledge`). The `/ask` chat cites blog URLs from `analytics-agent/knowledge/`, and it would otherwise cite redirected posts.

---

## 3. Broken and orphan internal links

### 3.1 Links that redirect or 404

**Live today:** none. All 183 distinct internal link targets across 178 crawled pages return 200. The old slug in `lib/data/ask-answers.ts:34` is already rewritten to the live URL before rendering.

**Redirecting URLs in structured data (live today):** the BreadcrumbList JSON-LD names `/services` and `/industries` as parent pages, and both 308 (to `/#how-it-works` and `/`). Google follows these.

| File | Line | Breadcrumb item |
|---|---|---|
| app/services/ai-layer/page.tsx | 28 | `{ name: 'Services', path: '/services' }` |
| app/services/amplitude-implementation/page.tsx | 28 | same |
| app/services/analytics-audit/page.tsx | 28 | same |
| app/services/analytics-setup/page.tsx | 28 | same |
| app/services/bigquery-consulting/page.tsx | 28 | same |
| app/services/data-modelling/page.tsx | 28 | same |
| app/services/data-unification/page.tsx | 28 | same |
| app/services/mixpanel-implementation/page.tsx | 28 | same |
| app/services/posthog-implementation/page.tsx | 28 | same |
| app/services/reporting-and-analysis/page.tsx | 28 | same |
| app/industries/consumer-apps/page.tsx | 28 | `{ name: 'Industries', path: '/industries' }` |
| app/industries/fintech/page.tsx | 28 | same |
| app/industries/saas/page.tsx | 28 | same |

Fix: drop the middle crumb (Home → page), since neither hub exists any more.

**Links that will redirect once §2 ships.** Update these in the same release.

In the repo:

| File | Line | Link |
|---|---|---|
| lib/data/ask-questions.ts | 45 | /blog/mixpanel-setup-the-right-way/ |
| lib/data/ask-questions.ts | 60 | /blog/how-to-create-a-tracking-plan-and/ |
| lib/data/ask-questions.ts | 181 | /blog/how-to-create-a-tracking-plan-and/ |
| lib/data/ask-questions.ts | 195 | /blog/data-tracking-comparing-client-vs/ |
| lib/data/ask-questions.ts | 251 | /blog/how-to-create-an-analytics-strategy/ |
| public/resources/retention-demo.html | (links to /ask/how-to-measure-retention and /ask/how-to-find-your-aha-moment) | point to the blog posts instead |

All of ask-questions.ts goes if the ask pages are retired. The rows are listed in case you keep any.

In Ghost post bodies (edit in Ghost):

| Post (link is in its body) | Links to (will redirect) |
|---|---|
| how-to-set-up-product-analytics-the-right-way | /blog/mixpanel-setup-the-right-way/ (would become a self-link, so remove it) |
| what-are-events-and-properties-in | /blog/mixpanel-setup-the-right-way/ |
| week-7-learning-mixpanel-creating | /blog/how-to-create-a-tracking-plan-and/ |
| you-have-data-flowing-everywhere-and-trust-none-of-it | /blog/how-to-create-a-tracking-plan-and/ |
| week-10-learning-mixpanel-creating | /blog/how-to-create-an-analytics-strategy/ |
| (the merged posts link to each other too: creating-an-event-tracking-plan-for, data-tracking-comparing-client-vs, getting-start-with-mixpanel-the-basics, how-to-create-a-tracking-plan-and, how-to-create-an-analytics-strategy) | these all go away with the redirects |

### 3.2 Orphans

**No inbound links except deep blog pagination** (/blog/page/6–7 and the author archive, five or more clicks from the homepage). None of these is linked from any article, chapter or page body:

| Page | Only linked from |
|---|---|
| /blog/gamification-is-a-multiplier-but-multiply-by-zero-and-you-get-nothing/ | /blog/page/2/ |
| /blog/5-biggest-problems-i-see-with-founders/ | /blog/page/6/ |
| /blog/the-mindset-for-solving-complex-problem/ | /blog/page/6/ |
| /blog/transforming-analytics-from-a-support/ | /blog/page/6/ |
| /blog/lifecycle-of-a-problem-statement/ | /blog/page/6/ |
| /blog/three-levers-to-optimize-product/ | /blog/page/6/ |
| /blog/overview-of-the-insights-report/ | /blog/page/6/ (redirected in §2) |
| /blog/developers-guide-to-implementing/ | /blog/page/6/ (redirected in §2) |
| /blog/getting-start-with-mixpanel-the-basics/ | /blog/page/7/ (redirected in §2) |

**Ask pages:** 14 of the 16 /ask/<slug> pages are linked only by other ask pages (the `relatedAsks` ring). /ask itself doesn't list them. This is resolved by §2.

**Linked only from the nav/footer, never from body copy:** /case-studies, /faqs, /services/amplitude-implementation, /services/posthog-implementation, /services/bigquery-consulting. Not orphans, but contextual links from relevant chapters and posts would help (e.g. the PostHog review post → /services/posthog-implementation).

**Why blog posts get few inbound links:** the "Keep reading" block at the foot of every post shows the three *newest* posts, not related ones. Every Learning Mixpanel post shows weeks 28/27/26, and every other post shows Buildern / D2C 7 / D2C 6. Making that block topical (shared tag, or the playbook chapter for the post's topic) would fix most of the thin-linking above in one change.

### 3.3 Homepage links that go to /contact instead of the service page

Confirmed. All in `content/home.json`:

| Line | Section | Link label | Current href | Should be |
|---|---|---|---|---|
| 48 | What we hear: "Revenue doesn't add up" | How we fix tracking | /contact?service=setup | /services/analytics-setup |
| 64 | What we hear: "Setting up Posthog" | How we set tools up | /contact?service=setup | /services/posthog-implementation |
| 72 | What we hear: "Where users drop off" | How reporting & analysis works | /contact?service=reporting-analysis | /services/reporting-and-analysis |
| 80 | What we hear: "Combine data from multiple sources" | How we unify data | /contact?service=unify | /services/data-unification |
| 127 | Method step 04 "Reporting & analysis" | Learn more about reporting & analysis | /contact?service=reporting-analysis | /services/reporting-and-analysis |
| 148 (`caseStudies.ctaLabel`; href hard-coded in `app/_components/case-cards.tsx:70`) | Results | See how we did it | /contact | /case-studies |

These pages were probably wired to /contact before the service pages existed. The other four method steps already link to their service pages. Also on lines 59–60: "Setting up  Posthog" has a double space, and "Posthog" should be "PostHog".

No similar mismatches anywhere else in `content/*.json`. Every other `/contact` link is labelled "Book a call", "Contact" or similar.

---

## 4. Other findings

### 4.1 Substack copies of 46 blog posts (highest priority)
Every Ghost post from 2024–2025 (the 18 standalone posts and Learning Mixpanel weeks 1–28; `#Migrated` tag in Ghost) is still public on **mixpanelsimplified.substack.com**, under the same slug, dated earlier, with its own self-canonical. Overlap:

- **Learning Mixpanel weeks 1–28:** 94–100% of the joindatalyze text matches Substack. These are effectively the same page.
- **2024 standalone posts:** 55–84% of the joindatalyze text matches, and 82–94% of the Substack text is contained in the joindatalyze version. Your versions have FAQs and reworked H2s added on top.

Google picks one version of a duplicate to index, and it usually picks the earlier, better-linked one: Substack. That fits 16 "crawled, not indexed" well. I'd check that GSC list against these 46 slugs first.

Options, best first. This is your call, because it affects your Substack subscribers:
1. Unpublish the Substack posts, or replace each body with a two-line summary and a link to the joindatalyze URL. (As far as I know Substack doesn't let you set a canonical URL per post. Worth confirming in its settings.)
2. If the Substack copies must stay, accept that the Learning Mixpanel series ranks on Substack, and put your effort into the playbook chapters, which are original.

Three Ghost posts also link out to the Substack copies. Point these links at the site instead:
- let-go-of-vanity-metrics-and-start and 5-biggest-problems-i-see-with-founders → Substack "how-to-create-an-analytics-strategy". Use /playbook/analytics-strategy.
- developers-guide-to-implementing → Substack "what-are-events-and-properties-in". Use /blog/what-are-events-and-properties-in/. This post is redirected in §2 anyway.

The "Mixpanel / PostHog / Amplitude setup – the right way" links on /resources (`content/resources.json:63,69,75`) go to public Notion pages. If those Notion pages are indexable copies of the blog posts, they're a third copy. Worth a look.

### 4.2 Dead and stale outbound links
- `content/resources.json:99` → https://datalyzeinsights.com/ does not resolve (connection fails).
- 29 Learning Mixpanel and tracking-plan posts link "check out my website" to https://www.anshdoesanalytics.com/ (a separate site). Consider pointing these at /about or /case-studies so the link equity stays on joindatalyze.com.

### 4.3 Second URL for the retention microsite
`/resources/retention-demo.html` serves the same page as `/resources/improve-app-retention` (it's the rewrite target). Its canonical correctly points to the clean URL, so the risk is low. A 301 from the .html path would remove it entirely, but test it first, because the rewrite targets that same file.

### 4.4 favicon.ico
Not missing. `/favicon.ico` returns 200 via `{ source: '/favicon.ico', destination: '/icon.png' }` in `next.config.ts`. One small thing: it serves a PNG at a .ico path. Browsers accept that, and Google's favicon fetcher generally does too. No action needed.

### 4.5 Legacy 404s: where they came from
- `/indian-d2c-playbook/*`: four Next.js pages added 2026-06-12 (commit 3f21a8f) and deleted 2026-06-18, when the series moved to Ghost as "D2C Playbook 1–7". No redirects were added. Covered in §2. I found no internal link to them, so the 404s come from external links or old index entries.
- `/week-26-learning-mixpanel-mastering`: a Ghost slug requested at the root. Most likely an external or Substack link written relative to the old blog.joindatalyze.com host. Covered by the pattern rule in §2.
- `/ask/how-do-i-set-up-mixpanel-properly`: not in the repo or git history. Probably an external link or an AI-generated citation. Covered in §2.

### 4.6 Smaller items
- **The "D2C Playbook" and "Analytics Playbook" share a name.** Both are "playbooks" on the same site, at /blog/tag/indian-d2c-playbook/ and /playbook. Fine for now, but keep the D2C posts' titles D2C-specific (they are) so they don't compete with chapters.
- **Two hops on the old Ghost subdomain.** `datalyze.ghost.io` → 302 → `cms.joindatalyze.com` → 301 → www. Harmless, since nobody should link to ghost.io.
- **Trailing periods in llms.txt.** Lines 9 and 84 end a sentence right after a URL ("…/llms-full.txt.", "…/playbook.", "…/playbook/glossary."). Some parsers include the full stop and hit a 404. Wrap them in `<…>` or add a space before the period. Source: `app/llms.txt/route.ts`.
- **/ask is thin and in the sitemap.** It has 124 words and an email-gated input, and the code comment says it "can never rank". It's in `lib/data/site-routes.ts:22`. Either noindex it and drop it from the sitemap, or, if you keep any ask answers, have it list them.
- **One H1 everywhere.** Every crawled page has exactly one H1, a self-referencing canonical and no stray noindex. No technical duplicate (www/apex, slash/no-slash) problems: both forms redirect correctly.

### 4.7 Suggested order
1. Fix the homepage links (§3.3) and breadcrumbs (§3.1). Small and safe.
2. Decide on Substack (§4.1).
3. Retire the 16 ask pages plus the legacy redirects. These need no content work.
4. Merge the eight blog posts into their main pages, then redirect and unpublish them.
5. Part-page intros and topical "Keep reading". Then request reindexing of the main pages in GSC.

Per CLAUDE.md, merging content into a playbook chapter changes an in-scope page, so run `npm run seo:check -- <path>` on each chapter you touch. Rules 2, 3 and 16 still need a person to check.

---

## Appendix: full inventory

Source: Ghost = Ghost slug. Otherwise it's the repo file that supplies the copy. Topic is taken from the SEO title. Words: Ghost = body text; others = text in `<main>`.

| URL | Title | H1 | Meta description | Topic | Words | Source |
|---|---|---|---|---|---|---|
| /playbook | The Analytics Playbook for Founders and PMs \| Datalyze | Set up analytics you can trust & use | Twenty-eight chapters on building analytics you can trust: tracking plans, verification, metric definitions, reading the numbers and acting on them. Free. | The Analytics Playbook for Founders and PMs | 1871 | content/playbook.json |
| /playbook/glossary | Analytics Glossary for Founders and PMs \| Datalyze | Glossary | Plain definitions for the analytics terms founders and PMs actually run into: activation, identity stitching, incrementality, semantic layer, mix effect and more. | Analytics Glossary for Founders and PMs | 1178 | content/playbook-glossary.json |
| /playbook/part/foundations | Foundations - The Analytics Playbook \| Datalyze | Foundations | What product analytics is, how it differs from the other two things people call analytics, and the funnel model every later chapter sits on. | Foundations - The Analytics Playbook | 338 | app/playbook/part/[part] (lib/playbook/schema.ts) |
| /playbook/part/what-to-measure | What to measure - The Analytics Playbook \| Datalyze | What to measure | Picking a north star you can explain, building the metric tree under it, and deciding who owns analytics at your stage. | What to measure - The Analytics Playbook | 152 | app/playbook/part/[part] (lib/playbook/schema.ts) |
| /playbook/part/trustworthy-data | Trustworthy data - The Analytics Playbook \| Datalyze | Trustworthy data | The tracking plan, verifying what ships, keeping it accurate six months on, and the two things that quietly corrupt every per-user number you have. | Trustworthy data - The Analytics Playbook | 417 | app/playbook/part/[part] (lib/playbook/schema.ts) |
| /playbook/part/your-data-stack | Your data stack - The Analytics Playbook \| Datalyze | Your data stack | What to add and when, how to make your tools agree on the same user, and the point where data modelling starts paying for itself. | Your data stack - The Analytics Playbook | 143 | app/playbook/part/[part] (lib/playbook/schema.ts) |
| /playbook/part/reading-the-data | Reading the data - The Analytics Playbook \| Datalyze | Reading the data | Frameworks for taking apart any product problem, defining metrics so they point at something, and reading a number instead of just looking at it. | Reading the data - The Analytics Playbook | 455 | app/playbook/part/[part] (lib/playbook/schema.ts) |
| /playbook/part/acting-on-what-you-find | Acting on what you find - The Analytics Playbook \| Datalyze | Acting on what you find | Testing the insights you have collected, working out whether your ad spend creates demand, and telling the story so somebody acts on it. | Acting on what you find - The Analytics Playbook | 298 | app/playbook/part/[part] (lib/playbook/schema.ts) |
| /playbook/what-is-product-analytics | What Is Product Analytics? \| Datalyze | What is product analytics? | Product analytics is the analysis of what users do inside your product. The test is whether you can point at a row of data and name the user who did it. | What Is Product Analytics? | 1193 | content/playbook/what-is-product-analytics.mdx |
| /playbook/product-vs-business-analytics | Product vs Data vs Business Analytics \| Datalyze | Product vs data vs business analytics | Data analytics is the umbrella; product analytics and business analytics both sit under it. Product analytics studies how users behave inside the product. | Product vs Data vs Business Analytics | 1204 | content/playbook/product-vs-business-analytics.mdx |
| /playbook/product-analyst-mindset | How to Hire a Product Analyst: Screen for the Mindset \| Datalyze | How to hire a product analyst: screen for the mindset | Founders screen product analysts for SQL and tools, then hire someone who pulls any number but can't say which number to ask for. | How to Hire a Product Analyst | 1768 | content/playbook/product-analyst-mindset.mdx |
| /playbook/product-funnel | Every Product Is a Funnel: How to Model Yours \| Datalyze | Every product is a funnel: how to model yours | Every product is a set of steps people go through in order, and so is every feature inside it. | Every Product Is a Funnel: How to Model Yours | 1036 | content/playbook/product-funnel.mdx |
| /playbook/product-analytics-by-stage | Product Analytics by Stage: What to Build at Your Size \| Datalyze | Product analytics by stage: what to build at your size | Sign-ups a month, not visitors, decides your analytics stage. Under 1,000 sign-ups a month, one product analytics tool on its free tier is enough. | Product Analytics by Stage | 1559 | content/playbook/product-analytics-by-stage.mdx |
| /playbook/north-star-metric | North Star Metric, Metric Tree and Counter Metrics \| Datalyze | North star metric, metric tree and counter metrics | Pick one north star metric that matches what the business is trying to do right now. Break it into a metric tree so you can see which branch moved. | North Star Metric, Metric Tree and Counter Metrics | 1743 | content/playbook/north-star-metric.mdx |
| /playbook/analytics-strategy | Analytics Strategy: Choosing Metrics That Are Actionable \| Datalyze | Analytics strategy: choosing metrics that are actionable | A metric belongs in your analytics strategy only when it can change a decision. On its own, a metric usually tells you nothing. | Analytics Strategy | 1821 | content/playbook/analytics-strategy.mdx |
| /playbook/creating-a-tracking-plan | How to Create a Tracking Plan Before Anyone Writes Code \| Datalyze | How to create a tracking plan before anyone writes code | A tracking plan is one sheet that contains every event you want to track and the properties that go on each event. | How to Create a Tracking Plan Before Anyone Writes Code | 1886 | content/playbook/creating-a-tracking-plan.mdx |
| /playbook/event-verification | Event Verification: How to QA Tracking Before You Trust It \| Datalyze | Event verification: how to QA tracking before you trust it | After your team ships event changes, somebody has to check that what's arriving in your analytics tool is what you asked for. | Event Verification | 1759 | content/playbook/event-verification.mdx |
| /playbook/data-accuracy-as-a-system | Data Accuracy as a System: Keeping Numbers Right \| Datalyze | Data accuracy as a system: keeping numbers right | Verifying an event tells you it worked that day. Staying accurate takes three habits: alerts on events and properties, new-event checks, database checks. | Data Accuracy as a System | 1256 | content/playbook/data-accuracy-as-a-system.mdx |
| /playbook/data-loss | Analytics Data Loss: Why You're Missing 15-20% of Events \| Datalyze | Analytics data loss: why you're missing 15-20% of events | If your tracking runs entirely in the browser, ad blockers take at least 15 to 20%. Route through your own domain and send core events from your backend. | Analytics Data Loss | 1499 | content/playbook/data-loss.mdx |
| /playbook/identity-stitching | Identity Stitching: Why Your User Counts Don't Match \| Datalyze | Identity stitching: why your user counts don't match | Your analytics tool counts one person as several until you call identify at login and signup. Get it wrong and every per-user number is wrong with it. | Identity Stitching | 1595 | content/playbook/identity-stitching.mdx |
| /playbook/mmp-and-utm-tracking | MMP vs UTM Tracking: Knowing Where Users Came From \| Datalyze | MMP vs UTM tracking: knowing where users came from | If your product is web only, UTM tags on every link are enough. The moment you have a mobile app, UTMs break at the install and you need an MMP. | MMP vs UTM Tracking | 2215 | content/playbook/mmp-and-utm-tracking.mdx |
| /playbook/unifying-data | Unifying Data: Making Your Tools Agree on One User \| Datalyze | Unifying data: making your tools agree on one user | Unifying data means lining up records from different tools so they describe the same user or campaign. | Unifying Data | 1687 | content/playbook/unifying-data.mdx |
| /playbook/data-modelling | Data Modelling: When It's Worth Doing, and What It Fixes \| Datalyze | Data modelling: when it's worth doing, and what it fixes | Data modelling earns its place once you have a warehouse and people writing SQL against it. It cuts wasted compute and time spent rediscovering joins. | Data Modelling | 1521 | content/playbook/data-modelling.mdx |
| /playbook/product-problem-framework | A Framework for Any Product Problem: Four Questions \| Datalyze | A framework for any product problem: four questions | Low retention, low activation and low signup-to-paid conversion are the same problem from a data perspective. | A Framework for Any Product Problem | 1766 | content/playbook/product-problem-framework.mdx |
| /playbook/metric-definitions | Metric Definitions: Why Three People Report Three Numbers \| Datalyze | Metric definitions: why three people report three numbers | Three people report three different numbers for the same metric because they built three different formulas. | Metric Definitions | 1440 | content/playbook/metric-definitions.mdx |
| /playbook/rate-and-mix-analysis | Rate and Mix Analysis: Why Your Conversion Rate Moved \| Datalyze | Rate and mix analysis: why your conversion rate moved | When a conversion rate moves, two different things can move it: the rates inside each segment, and how much volume each segment got. | Rate and Mix Analysis | 1647 | content/playbook/rate-and-mix-analysis.mdx |
| /playbook/segment-analysis | Segment Analysis: Finding Which Segments Move a Metric \| Datalyze | Segment analysis: finding which segments move a metric | Fugly is a segment analysis that finds which segments move with a metric you care about. | Segment Analysis | 1261 | content/playbook/segment-analysis.mdx |
| /playbook/reading-data | The Art of Reading Data: Definition Plus Context \| Datalyze | The art of reading data: definition plus context | Reading data well means defining a metric so a movement points at something concrete, then reading it with the business context to know what it means. | The Art of Reading Data | 1431 | content/playbook/reading-data.mdx |
| /playbook/qual-plus-quant-analysis | Qual Plus Quant Analysis: Why Half the Picture Misleads \| Datalyze | Qual plus quant analysis: why half the picture misleads | Quantitative analysis tells you what is happening. Qualitative analysis tells you why. | Qual Plus Quant Analysis | 1417 | content/playbook/qual-plus-quant-analysis.mdx |
| /playbook/correlation-is-not-causation | Correlation Is Not Causation: How to Check Before Acting \| Datalyze | Correlation is not causation: how to check before acting | A finding that users who do X are more likely to convert may be pure correlation. | Correlation Is Not Causation | 1180 | content/playbook/correlation-is-not-causation.mdx |
| /playbook/sense-checking-numbers | Sense Checking: Testing a Number Before You Report It \| Datalyze | Sense checking: testing a number before you report it | A sense check is holding a number against what you already know about the business, to see whether it is in the right ballpark before anyone acts on it. | Sense Checking | 1414 | content/playbook/sense-checking-numbers.mdx |
| /playbook/experimentation | How to run experiments at different stages? \| Datalyze | How to run experiments at different stages? | Most companies collect insights and never test them. You might not have the traffic for a textbook A/B test, and that is fine. | How to run experiments at different stages? | 1103 | content/playbook/experimentation.mdx |
| /playbook/incremental-testing | Incremental Testing: Are Your Ads Creating Demand? \| Datalyze | Incremental testing: are your ads creating demand? | Incremental testing tells you whether your ad spend brings signups that would not have arrived anyway. | Incremental Testing | 1756 | content/playbook/incremental-testing.mdx |
| /playbook/media-mix-modelling | Media Mix Modelling: Measuring Untrackable Channels \| Datalyze | Media mix modelling: measuring untrackable channels | Media mix modelling measures the channels you cannot track with a link, such as influencers, offline campaigns and brand spend. | Media Mix Modelling | 1174 | content/playbook/media-mix-modelling.mdx |
| /playbook/data-storytelling | Data Storytelling: Building a Dashboard People Understand \| Datalyze | Data storytelling: building a dashboard people understand | A dashboard people understand opens on a question, orders its reports so each one follows from the last, and lands on an answer. | Data Storytelling | 1227 | content/playbook/data-storytelling.mdx |
| /playbook/analytics-and-ai | Analytics in the Age of AI: Making Agents Trustworthy \| Datalyze | Analytics in the age of AI: making agents trustworthy | AI can answer your analytics questions, but only with clean data, a written explanation of what it means, and the exact calculation for each core metric. | Analytics in the Age of AI | 1992 | content/playbook/analytics-and-ai.mdx |
| / | Datalyze - Analytics & Growth Partner for Startups | We fix the analytics you set up but never got answers from | Datalyze rebuilds your data foundation, connects your tools into one source of truth, and finds the growth hiding in it. 150+ startups. | Datalyze - Analytics & Growth Partner for Startups | 2687 | app/page.tsx + content/home.json |
| /about | About Datalyze & Ansh Agrawal \| Datalyze | A note from the founder | Datalyze is an analytics consultancy founded by Ansh Agrawal in 2019. Senior operators only - we rebuild data foundations, then find the growth. | About Datalyze & Ansh Agrawal | 427 | content/about.json |
| /case-studies | Analytics Case Studies \| Datalyze | Analytics case studies | 17 analytics engagements with numbers: 2× paid conversion, 28%→80% onboarding, −93% payment outages, +15% Week 2 retention. | Analytics Case Studies | 289 | content/case-studies.json |
| /contact | Book a Free 30-Minute Analytics Audit \| Datalyze | Book a call with Ansh | Book a free 30-minute call. A senior analyst reviews your tracking, warehouse and attribution live, and names the 2–3 fixes that matter most. | Book a Free 30-Minute Analytics Audit | 70 | content/contact.json |
| /resources | Analytics Guides, Tools & Templates \| Datalyze | Analytics guides, tools and templates | The analytics playbook, setup guides for Mixpanel, PostHog and Amplitude, and free tools: Mixpanel exporters, a tracking plan generator, a maturity grader and an A/B test calculator. | Analytics Guides, Tools & Templates | 433 | content/resources.json |
| /faqs | Datalyze FAQs - Pricing, Process, Team \| Datalyze | Frequently Asked Questions | What Datalyze costs, how fast we start, who does the work, what we need from your team, and what happens when an engagement ends. | Datalyze FAQs - Pricing, Process, Team | 640 | content/faqs.json |
| /ask | Ask Ansh's AI \| Datalyze | Ask me anything about analytics | Ask any analytics question, answered only from Ansh Agrawal's own writing on tracking, attribution and retention. Not covered? You get a straight no. | Ask Ansh's AI | 124 | app/ask/page.tsx |
| /services/mixpanel-implementation | Mixpanel Consulting & Implementation \| Datalyze | Mixpanel consulting & implementation | Datalyze is a Mixpanel Certified Partner. We audit, set up and fix Mixpanel, connect marketing, CRM and ad data, and help your team get answers from it. | Mixpanel Consulting & Implementation | 2249 | content/mixpanel.json |
| /services/amplitude-implementation | Amplitude Consulting & Implementation \| Datalyze | Amplitude consulting & implementation | Datalyze audits, sets up and fixes Amplitude, connects your marketing, CRM and ad data, and helps your team turn it into experiments and decisions. | Amplitude Consulting & Implementation | 2241 | content/amplitude.json |
| /services/posthog-implementation | PostHog Consulting & Implementation \| Datalyze | PostHog consulting & implementation | Datalyze is a PostHog Implementation Specialist. We audit, set up and fix PostHog, pipe in warehouse, CRM and ad data, and help your team get answers. | PostHog Consulting & Implementation | 2314 | content/posthog.json |
| /services/bigquery-consulting | BigQuery Consulting & Data Warehouse Setup \| Datalyze | BigQuery consulting & implementation | BigQuery set up as your data warehouse: data piped in from every tool, modelled with dbt, and put to work in Looker dashboards, AI agents and attribution. | BigQuery Consulting & Data Warehouse Setup | 2541 | content/bigquery.json |
| /services/analytics-audit | Analytics Audit for Mixpanel, Amplitude, PostHog \| Datalyze | Analytics & tracking audit | An audit of your Mixpanel, Amplitude or PostHog setup: duplicate events, split profiles, missing properties, broken syncs. A fix list in 1 to 2 weeks. | Analytics Audit for Mixpanel, Amplitude, PostHog | 1864 | content/audit.json |
| /services/analytics-setup | Mixpanel, Amplitude & PostHog Setup \| Datalyze | Analytics setup & implementation | Mixpanel, Amplitude or PostHog set up from scratch: tracking plan, implementation with your developers, validation, strategy and first dashboards. | Mixpanel, Amplitude & PostHog Setup | 1714 | content/setup.json |
| /services/data-unification | Data Unification in BigQuery or Snowflake \| Datalyze | Unify data across every tool | Product, billing, CRM and ad data unified in BigQuery or Snowflake, synced to Mixpanel, Amplitude or PostHog, with data models that connect every user. | Data Unification in BigQuery or Snowflake | 1704 | content/unify.json |
| /services/reporting-and-analysis | Product Analytics Reporting and Analysis \| Datalyze | Reporting, analysis & insights | Dashboards each team will use, analysis with session replays to find what happens and why, experiments, alerts, and one definition for every metric. | Product Analytics Reporting and Analysis | 1723 | content/reporting.json |
| /services/data-modelling | Data Modelling with dbt for BigQuery & Snowflake \| Datalyze | Data modelling with dbt | Your BigQuery or Snowflake warehouse modelled in dbt: marts planned for every use case, tested models, and a semantic layer your team and AI can query. | Data Modelling with dbt for BigQuery & Snowflake | 1688 | content/modelling.json |
| /services/ai-layer | AI Layer for Analytics: Semantic Layer & MCP \| Datalyze | An accurate AI layer on your data | An accurate AI layer on your data: one warehouse, clean data marts and a semantic layer with business context, connected to an AI tool or exposed over MCP. | AI Layer for Analytics: Semantic Layer & MCP | 1712 | content/ai-layer.json |
| /industries/saas | SaaS Analytics: Activation, Churn, Retention \| Datalyze | Product analytics for SaaS | Product analytics for SaaS: why trials don't activate, why customers churn and which features drive retention, in Mixpanel, Amplitude or PostHog. | SaaS Analytics: Activation, Churn, Retention | 2429 | content/industry-saas.json |
| /industries/fintech | Fintech Analytics: KYC, Payments, Retention \| Datalyze | Product analytics for fintech | Product analytics for fintech apps: KYC drop-off, time to first transaction, payment failures by provider and repeat use, without leaking personal data. | Fintech Analytics: KYC, Payments, Retention | 2314 | content/industry-fintech.json |
| /industries/consumer-apps | Consumer App Analytics: Drop-off & Retention \| Datalyze | Product analytics for consumer apps | Product analytics for consumer apps: where new users drop off, why they leave in week one and which habits bring them back, on iOS, Android and web. | Consumer App Analytics: Drop-off & Retention | 2261 | content/industry-consumer.json |
| /resources/improve-app-retention | How to actually improve your app's retention - Datalyze | How to find what's actually driving your retention. | A practical, six-step framework for finding what actually drives your app's D30 retention - and what to do about it, walked through with sample data. | How to actually improve your app's retention | 1215 | public/resources/retention-demo.html (rewrite in next.config.ts) |
| /resources/client-vs-proxy-vs-server-tracking | Client vs Proxy vs Server Side Tracking \| Datalyze | Client vs proxy vs server-side tracking | Server-side for revenue and sign-ups, client-side for behaviour, a first-party proxy to recover blocked events. Which method each event should use. | Client vs Proxy vs Server Side Tracking | 894 | content/tracking-methods.json |
| /tools/mixpanel-exporter | Mixpanel Event Exporter \| Datalyze | Mixpanel Event Exporter | Export raw Mixpanel event data to a clean CSV with a free Jupyter notebook. Handles the Export API, pagination, and large date ranges - and runs locally. | Mixpanel Event Exporter | 427 | app/tools/[toolId] + content/tools.json |
| /tools/mixpanel-users-exporter | Mixpanel Users Exporter \| Datalyze | Mixpanel Users Exporter | Export every Mixpanel user profile to a clean CSV with a free Jupyter notebook. Walks the Engage API, flattens properties, runs locally. | Mixpanel Users Exporter | 404 | app/tools/[toolId] + content/tools.json |
| /tools/event-tracking-plan-generator | Free Event Tracking Plan Generator - Claude Skill | Event Tracking Plan Generator | Generate a complete event tracking plan for your product in under an hour - a free Claude skill that outputs a Mixpanel/PostHog/Amplitude/GA4 CSV. | Free Event Tracking Plan Generator - Claude Skill | 1054 | content/tool-tracking-plan.json |
| /tools/analytics-strategy-creator | Free Analytics Strategy Creator - Claude Skill | Analytics Strategy Creator | Turn a fuzzy product question into a decision-driven analytics strategy. A free Claude skill that outputs metrics, counter-metrics, and segmentation. | Free Analytics Strategy Creator - Claude Skill | 1279 | content/tool-strategy.json |
| /tools/analytics-maturity-grader | Analytics Maturity Grader \| Datalyze | How mature is your analytics setup? | Take a 2-minute quiz to get a personalized analytics maturity scorecard with actionable recommendations. | Analytics Maturity Grader | 464 | content/tool-grader.json |
| /tools/ab-test-calculator | A/B Test Calculator: Significance, Sample Size and Verdict | A/B Test Calculator: Significance, Sample Size and Verdict | This free A/B test calculator (also called a split test calculator) tells you if your test result is real or just luck. | A/B Test Calculator | 2485 | content/tool-ab-test-calculator.json |
| /ask/how-to-set-up-mixpanel-properly | How do I set up Mixpanel the right way? | How do I set up Mixpanel the right way? | Mixpanel setup in five steps: a tracking spec, code and data checks, an analytics strategy, dashboards that answer questions, then deeper analysis. | How do I set up Mixpanel the right way? | 388 | lib/data/ask-questions.ts + ask-answers.generated.json |
| /ask/what-is-an-event-tracking-plan | What should be in an event tracking plan? | What should be in an event tracking plan? | The six parts every event tracking plan needs, from trigger to data type, and why a few events with rich properties beat many narrow events. | What should be in an event tracking plan? | 354 | lib/data/ask-questions.ts + ask-answers.generated.json |
| /ask/how-to-measure-retention | How do I measure retention properly? | How do I measure retention properly? | How to measure retention: pick the window and bounded or unbounded, compare retained and churned cohorts, and use fast metrics for experiments. | How do I measure retention properly? | 342 | lib/data/ask-questions.ts + ask-answers.generated.json |
| /ask/what-is-lexicon-in-mixpanel | What is Lexicon in Mixpanel? | What is Lexicon in Mixpanel? | What Lexicon is in Mixpanel: the project's dictionary of events and properties, how it keeps tracking consistent, and how it connects to lookup tables. | What is Lexicon in Mixpanel? | 255 | lib/data/ask-questions.ts + ask-answers.generated.json |
| /ask/incrementality-testing-for-d2c | Incrementality Testing for D2C Brands | How should I think about incrementality testing for a D2C brand? | Incrementality testing for D2C brands: how a four-week geo holdout shows the sales your ads really caused, and why 4.0x ROAS can really be 1.7x. | Incrementality Testing for D2C Brands | 473 | lib/data/ask-questions.ts + ask-answers.generated.json |
| /ask/are-branded-search-conversions-real | Are my branded search conversions actually incremental? | Are my branded search conversions actually incremental? | Are branded search conversions incremental? Tests often show 70 to 90% would have happened anyway. How to check yours with a simple geo holdout. | Are my branded search conversions actually incremental? | 421 | lib/data/ask-questions.ts + ask-answers.generated.json |
| /ask/why-do-my-conversions-look-too-good | Why do my conversions look too good? | Why do my conversions look too good? | Why ad platform conversions look too good: Meta and Google both claim the same orders, plus view-throughs. What to use as your source of truth. | Why do my conversions look too good? | 407 | lib/data/ask-questions.ts + ask-answers.generated.json |
| /ask/what-is-marketing-mix-modeling | What is marketing mix modeling and when is it worth it? | What is marketing mix modeling and when is it worth it? | What marketing mix modeling (MMM) does, the data it needs, and when a D2C brand is ready for it. Plus why an uncalibrated MMM gives wrong answers. | What is marketing mix modeling and when is it worth it? | 421 | lib/data/ask-questions.ts + ask-answers.generated.json |
| /ask/events-vs-properties-in-mixpanel | Events vs Properties in Mixpanel | What is the difference between events and properties in Mixpanel? | Events vs properties in Mixpanel: an event is what a user did, a property is the detail about it. Plus the three types of Mixpanel property. | Events vs Properties in Mixpanel | 318 | lib/data/ask-questions.ts + ask-answers.generated.json |
| /ask/what-are-super-properties | What are super properties and when should I use them? | What are super properties and when should I use them? | What super properties are in Mixpanel, how they differ from profile properties, and when to use them to see a user's state at the time of each event. | What are super properties and when should I use them? | 359 | lib/data/ask-questions.ts + ask-answers.generated.json |
| /ask/client-vs-server-side-tracking | Should I track client-side or server-side? | Should I track client-side or server-side? | Client-side vs server-side tracking: what each is good at, how much data ad blockers cost you, and why most products should run a hybrid of both. | Should I track client-side or server-side? | 366 | lib/data/ask-questions.ts + ask-answers.generated.json |
| /ask/how-to-find-your-aha-moment | How do I find the aha moment for my product? | How do I find the aha moment for my product? | How to find your product's aha moment: time-boxed hypotheses, retained vs churned cohorts, and user interviews to confirm what signals real value. | How do I find the aha moment for my product? | 339 | lib/data/ask-questions.ts + ask-answers.generated.json |
| /ask/why-nobody-trusts-our-data | Why does nobody on my team trust our analytics data? | Why does nobody on my team trust our analytics data? | Why teams stop trusting analytics data, the three usual causes, and how to rebuild trust by fixing tracking for five core metrics first. | Why does nobody on my team trust our analytics data? | 444 | lib/data/ask-questions.ts + ask-answers.generated.json |
| /ask/mixpanel-vs-ga4 | Should I move from Google Analytics to Mixpanel? | Should I move from Google Analytics to Mixpanel? | Google Analytics vs Mixpanel: when GA is enough, when Mixpanel is worth it, and why linking behaviour to revenue is the strongest reason to switch. | Should I move from Google Analytics to Mixpanel? | 373 | lib/data/ask-questions.ts + ask-answers.generated.json |
| /ask/how-to-build-an-analytics-strategy | How do I build an analytics strategy for my product? | How do I build an analytics strategy for my product? | How to build an analytics strategy in three steps: split the product with AAARRR, keep only metrics that drive decisions, and go deep where it counts. | How do I build an analytics strategy for my product? | 372 | lib/data/ask-questions.ts + ask-answers.generated.json |
| /ask/what-is-analytics-debt | What is analytics debt and how do I know if I have it? | What is analytics debt and how do I know if I have it? | What analytics debt is, how it quietly skews your funnels as you grow, and a five-question test to find out if your team already has it. | What is analytics debt and how do I know if I have it? | 413 | lib/data/ask-questions.ts + ask-answers.generated.json |
| /blog/ | Product Analytics Blog \| Datalyze | Product analytics, written down | Product analytics playbooks, case studies, and resources for Founders, PMs and Growth folks | Product Analytics Blog | 1187 | content/blog.json (Ghost index) |
| /blog/case-study-buildern/ | Buildern Case Study: PostHog, dbt and Health Scores | Buildern: Attribution, data models & account health scoring | How Datalyze rebuilt Buildern's attribution in PostHog, modelled BigQuery data with dbt, and built a company health score that flags churn risk early. | Buildern Case Study | 1267 | Ghost: case-study-buildern |
| /blog/d2c-playbook-7-marketing-mix-modeling-mmm/ | Marketing Mix Modeling (MMM) for D2C Brands | D2C Playbook 7 -- Marketing Mix Modeling (MMM) | What MMM needs, what it gives back, base vs incremental revenue, adstock and saturation, where it misleads, and why you calibrate it against a test. | Marketing Mix Modeling (MMM) for D2C Brands | 2859 | Ghost: d2c-playbook-7-marketing-mix-modeling-mmm |
| /blog/d2c-playbook-6-incrementality-testing/ | Incrementality Testing for D2C Brands \| Datalyze | D2C Playbook 6 -- Incrementality Testing | What incrementality testing is, how a geo holdout works end to end, how to calculate incremental ROAS, and what makes a test give the wrong answer. | Incrementality Testing for D2C Brands | 2522 | Ghost: d2c-playbook-6-incrementality-testing |
| /blog/d2c-playbook-5-how-to-actually-stitch-website-blinkit-and-swiggy-data/ | How to Stitch Website, Blinkit and Swiggy Data | D2C Playbook 5 -- How to actually stitch website, Blinkit and Swiggy data | Stitching D2C data is three jobs: clean joins, fuzzy joins and joins you can't make. How SKU mapping works and where stitched dashboards mislead. | How to Stitch Website, Blinkit and Swiggy Data | 2430 | Ghost: d2c-playbook-5-how-to-actually-stitch-website-blinkit-and-swiggy-data |
| /blog/d2c-playbook-4-event-taxonomy-tool-stack-before-you-scale-spend/ | D2C Event Tracking: Taxonomy and Tool Stack \| Datalyze | D2C Playbook 4 -- Event Taxonomy & Tool Stack Before You Scale Spend | The 20 to 30 events a D2C brand should track, how to name them, why properties beat more events, and the one analytics tool and warehouse you need. | D2C Event Tracking: Taxonomy and Tool Stack | 2424 | Ghost: d2c-playbook-4-event-taxonomy-tool-stack-before-you-scale-spend |
| /blog/70-of-your-branded-search-conversions-would-have-happened-anyway/ | Are Branded Search Conversions Incremental? \| Datalyze | 70% of Your Branded Search Conversions Would Have Happened Anyway | Why branded search and retargeting look like your best channels, and how incrementality tests and MMM show what your ad spend actually caused. | Are Branded Search Conversions Incremental? | 2209 | Ghost: 70-of-your-branded-search-conversions-would-have-happened-anyway |
| /blog/the-click-is-the-only-thing-your-ad-platform-can-see/ | Why Your Cheapest Ad Channel Is Probably Your Worst | Your Cheapest Channel Is Probably Your Worst | Ad platforms only see the click. Join ad spend, product and revenue data, and judge each channel on retained revenue instead of cost per signup. | Why Your Cheapest Ad Channel Is Probably Your Worst | 2714 | Ghost: the-click-is-the-only-thing-your-ad-platform-can-see |
| /blog/you-have-data-flowing-everywhere-and-trust-none-of-it/ | How to Fix Data Nobody on Your Team Trusts \| Datalyze | You have data flowing everywhere and trust none of it | Fix the data you already have first, then connect product, CRM, email and ad tools into one user journey. Why grain and join keys make or break it. | How to Fix Data Nobody on Your Team Trusts | 2479 | Ghost: you-have-data-flowing-everywhere-and-trust-none-of-it |
| /blog/how-to-set-up-product-analytics-the-right-way/ | How to Set Up Product Analytics the Right Way \| Datalyze | How to Set Up Product Analytics the Right Way | Five steps to set up product analytics: pick a tool, write a tracking plan, get proxy, server-side and identity right, then read numbers as a funnel. | How to Set Up Product Analytics the Right Way | 2146 | Ghost: how-to-set-up-product-analytics-the-right-way |
| /blog/d2c-playbook-3-why-your-conversions-look-too-good/ | Why Your D2C Conversion Numbers Look Too Good | D2C Playbook 3-- Why your conversions look too good | Why Meta and Google together claim more revenue than you made, which number to trust, and how to build attribution in-house from your own backend. | Why Your D2C Conversion Numbers Look Too Good | 2055 | Ghost: d2c-playbook-3-why-your-conversions-look-too-good |
| /blog/connecting-marketing-and-product-data/ | How to Connect Marketing and Product Data \| Datalyze | Connecting marketing and product data | Why your marketing site and product never share data, how to stitch identity across subdomains in Mixpanel, PostHog or Amplitude, and what to read weekly. | How to Connect Marketing and Product Data | 1635 | Ghost: connecting-marketing-and-product-data |
| /blog/d2c-playbook-2-putting-all-your-data-in-one-place/ | D2C Playbook 2: Put All Your Data in One Place | D2C Playbook 2 -- Putting all your data in one place | What data your site, Blinkit, Swiggy and Amazon each give you, what you can join and what you can only estimate, and how to land it in one warehouse. | D2C Playbook 2 | 2557 | Ghost: d2c-playbook-2-putting-all-your-data-in-one-place |
| /blog/analytics-debt-the-silent-killer-nobody-talks-about-until-series-b/ | What Is Analytics Debt? The 5 Stages \| Datalyze | Analytics Debt: The Silent Killer Nobody Talks About Until Series B | What analytics debt is, the five stages startups go through, what it costs by Series B, and how to audit your own in an afternoon with no new tools. | What Is Analytics Debt? The 5 Stages | 2175 | Ghost: analytics-debt-the-silent-killer-nobody-talks-about-until-series-b |
| /blog/d2c-playbook-1-the-data-foundation/ | D2C Analytics: Fix Your Data Foundation First | D2C Playbook 1 -- The Data Foundation: Fix Your Owned Layer Before You Scale Spend | Why D2C brands should fix their owned data layer before scaling spend: how many events to track, identity stitching, consent, and Shopify vs Meta revenue. | D2C Analytics: Fix Your Data Foundation First | 4221 | Ghost: d2c-playbook-1-the-data-foundation |
| /blog/gamification-is-a-multiplier-but-multiply-by-zero-and-you-get-nothing/ | Why Gamification Fails: Duolingo vs Foursquare | Gamification is a multiplier. But multiply by zero, and you get nothing. | Gamification multiplies value that already exists. What the research says, why it worked for Duolingo, why it failed for Foursquare, and when to add it. | Why Gamification Fails | 947 | Ghost: gamification-is-a-multiplier-but-multiply-by-zero-and-you-get-nothing |
| /blog/my-love-hate-relationship-with-posthog-and-why-i-keep-recommending-it-anyway/ | PostHog Review: What I Love and Hate \| Datalyze | My Love-Hate Relationship With PostHog (And Why I Keep Recommending It Anyway) | An honest PostHog review: weaker pure product analytics than Mixpanel or Amplitude, but replay, flags, experiments and a warehouse in one tool. | PostHog Review: What I Love and Hate | 821 | Ghost: my-love-hate-relationship-with-posthog-and-why-i-keep-recommending-it-anyway |
| /blog/case-study-anyip/ | AnyIP Case Study: Marketing Visibility, Lower CAC | AnyIP: Helped get more visibility into marketing, and improving CAC, spend efficiency | How cleaning AnyIP's raw data and building channel, CAC and campaign reporting gave the team clear marketing visibility and a lower CAC. | AnyIP Case Study | 392 | Ghost: case-study-anyip |
| /blog/case-study-frai/ | FRAI Case Study: 2x Paid Conversion Rate \| Datalyze | FRAI: Improved paid conversion rate (2x) | How behavioural analysis, product recommendations and structured A/B tests doubled FRAI's paid conversion rate and left a repeatable testing process. | FRAI Case Study: 2x Paid Conversion Rate | 378 | Ghost: case-study-frai |
| /blog/case-study-termplus/ | TermPlus Case Study: Full PostHog Analytics Setup | Termplus: Setup the entire Data Analytics Infra, & unified user journey | How a product audit, a tracking plan and unified data sources gave TermPlus a complete PostHog setup and a single view of the user journey. | TermPlus Case Study | 460 | Ghost: case-study-termplus |
| /blog/case-study-answering-agent/ | Answering Agent Case Study: AI Call Scoring \| Datalyze | Answering Agent: Helped create a call score using AI | How Datalyze defined call quality metrics and built an AI scoring model so Answering Agent could see which AI calls performed poorly and why. | Answering Agent Case Study: AI Call Scoring | 455 | Ghost: case-study-answering-agent |
| /blog/case-study-sol/ | Sol Case Study: A Simpler Mixpanel Tracking Setup | Sol: Helped clean up complex data structure into a simple accurate setup | How Sol moved from granular events to a few core event categories with rich properties, giving a lean Mixpanel setup that scales with weekly releases. | Sol Case Study | 464 | Ghost: case-study-sol |
| /blog/case-study-wellnesscoach/ | Wellness Coach Case Study: Rebuilding Data Trust | WellnessCoach: Helped regain trust in data | Wellness Coach tracked almost every click and trusted none of it. How an audit and a simpler event taxonomy gave the team numbers it could rely on. | Wellness Coach Case Study | 423 | Ghost: case-study-wellnesscoach |
| /blog/case-study-speedyloans/ | Speedyloans Case Study: 30% Lower Email Cost | Speedyloans: Reduced cost (-30%) and increased engagement (+1%) | How segmenting users and modelling 100+ attributes cut Speedyloans' email costs by 30% and raised re-engagement 1% while sending fewer emails. | Speedyloans Case Study: 30% Lower Email Cost | 487 | Ghost: case-study-speedyloans |
| /blog/case-study-zeroone/ | zeroone Case Study: +15% Week 2 Retention \| Datalyze | zeroone: Improved Week 2 retention (+15%), engagement (+30%), and implementation of new tracking | How optional uploads in onboarding took zeroone activation from 21% to 55%, and how Week 2 retention rose 15% and engagement 30% after that. | zeroone Case Study: +15% Week 2 Retention | 1014 | Ghost: case-study-zeroone |
| /blog/case-study-videotap/ | VideoTap Case Study: Onboarding 28% to 80% \| Datalyze | VideoTap: Onboarding completion 28% to 80%, activation 7% to 19% | How a shorter onboarding flow, clearer value messaging and a 2-step upload lifted VideoTap onboarding completion from 28% to 80%, activation to 19%. | VideoTap Case Study: Onboarding 28% to 80% | 581 | Ghost: case-study-videotap |
| /blog/case-study-stealth/ | Case Study: +22% Activation From Higher Free Limits | Stealth Startup: Increased Activation (+22%), and time spent on app (+2 mins) | A startup's users hit paywalls before seeing value. Raising free plan usage limits lifted activation 22% and median time in the app by 2 minutes. | Case Study | 320 | Ghost: case-study-stealth |
| /blog/case-study-petcademy/ | Petcademy Case Study: 12% Lower SMS Cost \| Datalyze | Petcademy: Reduced SMS cost (-12%) with no decline in engagement | How Petcademy cut SMS costs by 12% with no drop in engagement: removing low-engagement messages and personalising the rest by user behaviour. | Petcademy Case Study: 12% Lower SMS Cost | 355 | Ghost: case-study-petcademy |
| /blog/case-study-gametree/ | GameTree Case Study: +5% Day 0 Activation \| Datalyze | GameTree: Improving Day 0 Activation (+5%) | How a localised first-use experience and fixes to errors in the early flow helped GameTree raise Day 0 activation by 5% for new sign-ups. | GameTree Case Study: +5% Day 0 Activation | 382 | Ghost: case-study-gametree |
| /blog/case-study-sama/ | Sama Case Study: +4% Retention \| Datalyze | Sama: Improving retention (+4%) | Users stopped coming back to Sama after their first coaching session. Making the Notes feature easier to find and reach lifted retention by 4%. | Sama Case Study: +4% Retention | 374 | Ghost: case-study-sama |
| /blog/case-study-cred/ | CRED Case Study: Payment Routing, +7% Success Rate | CRED: Improving PSR (+7%), reducing Cost (12%) and outage (93%) | How a linear programming routing engine and real-time outage detection raised CRED's payment success rate about 7%, cut cost 12% and outages 93%. | CRED Case Study | 622 | Ghost: case-study-cred |
| /blog/case-study-foriio/ | Foriio Case Study: +8% Activation, +6% Retention | Foriio: Improving Activation (+8%) & Retention (6%) | How behaviour-based email nudges and a simpler Add Work flow lifted Foriio's activation by 8%, and how engagement notifications lifted retention 6%. | Foriio Case Study | 643 | Ghost: case-study-foriio |
| /blog/case-study-copyfy/ | Copyfy Case Study: Sign-Up Rate 30% to 61% \| Datalyze | Copyfy: Sign-up rate from 30% to 61% & unified data | How Datalyze set up clean Mixpanel tracking for Copyfy, unified its data into one view, and saw sign-up conversion go from 30% to 61%. | Copyfy Case Study: Sign-Up Rate 30% to 61% | 747 | Ghost: case-study-copyfy |
| /blog/week-28-learning-mixpanel-computed/ | Mixpanel Computed Properties: How to Use Them | [Week 28] Learning Mixpanel: Computed Properties | The four computed properties in Mixpanel: frequency per user, aggregate property per user, duration in Insights, and time to convert in Funnels. | Mixpanel Computed Properties: How to Use Them | 812 | Ghost: week-28-learning-mixpanel-computed |
| /blog/week-27-learning-mixpanel-bucket/ | Mixpanel Bucket Customisation: Group Values | [Week 27] Learning Mixpanel: Bucket Customisation Types | How to customise buckets in Mixpanel breakdowns: even, varied or no buckets for numbers, and if else or contains rules to group string values. | Mixpanel Bucket Customisation: Group Values | 632 | Ghost: week-27-learning-mixpanel-bucket |
| /blog/week-26-learning-mixpanel-mastering/ | Mixpanel Attribution Models Explained \| Datalyze | [Week 26] Learning Mixpanel: Mastering Attribution with Mixpanel | How attribution works in Mixpanel: the lookback window and each model, including first touch, last touch, linear, time decay, U shaped and J shaped. | Mixpanel Attribution Models Explained | 891 | Ghost: week-26-learning-mixpanel-mastering |
| /blog/week-25-learning-mixpanel-warehouse/ | Mixpanel Warehouse Connectors: Setup Guide | [Week 25] Learning Mixpanel: Warehouse Connectors | Load data from BigQuery, Snowflake, Databricks or Redshift into Mixpanel: events, user and group profiles, lookup tables, and each sync mode. | Mixpanel Warehouse Connectors: Setup Guide | 968 | Ghost: week-25-learning-mixpanel-warehouse |
| /blog/week-24-learning-mixpanel-custom/ | Mixpanel Custom Properties and Formulas \| Datalyze | [Week 24] Learning Mixpanel: Custom Properties | How to create custom properties in Mixpanel with formulas, with examples like grouping paid channels and calculating age, plus every operator. | Mixpanel Custom Properties and Formulas | 516 | Ghost: week-24-learning-mixpanel-custom |
| /blog/week-23-learning-mixpanel-borrowed/ | Mixpanel Borrowed Properties Explained \| Datalyze | [Week 23] Learning Mixpanel: Borrowed Properties | How borrowed properties let you use a property from another event in Mixpanel, how to create one, and how the 30 day lookback picks the value. | Mixpanel Borrowed Properties Explained | 281 | Ghost: week-23-learning-mixpanel-borrowed |
| /blog/week-22-learning-mixpanel-lookup/ | Mixpanel Lookup Tables: Setup Guide \| Datalyze | [Week 22] Learning Mixpanel: Lookup Tables | How to use lookup tables in Mixpanel to add details like product name and price to a property such as product_id, and how to format the CSV. | Mixpanel Lookup Tables: Setup Guide | 308 | Ghost: week-22-learning-mixpanel-lookup |
| /blog/week-21-learning-mixpanel-group-analytics/ | Mixpanel Group Analytics for B2B \| Datalyze | [Week 21] Learning Mixpanel: Group Analytics in Mixpanel | What Group Analytics does in Mixpanel: analyse a whole company as one user as well as the people in it. Built for B2B SaaS, sold as a paid add-on. | Mixpanel Group Analytics for B2B | 209 | Ghost: week-21-learning-mixpanel-group-analytics |
| /blog/week-20-learning-mixpanel-sending/ | How to Send Ad Data into Mixpanel \| Datalyze | [Week 20] Learning Mixpanel: Sending Ad Data into Mixpanel | How to bring ad data into Mixpanel for ROI and ROAS: match UTM property names, skip the distinct ID, send daily aggregates and use an insert ID. | How to Send Ad Data into Mixpanel | 326 | Ghost: week-20-learning-mixpanel-sending |
| /blog/week-19-learning-mixpanel-alerts/ | Mixpanel Alerts: Anomaly and Threshold Alerts | [Week 19] Learning Mixpanel: Alerts | How to set up Mixpanel alerts on Insights and Funnels reports: anomaly detection, custom thresholds, how often to check, and email or Slack delivery. | Mixpanel Alerts: Anomaly and Threshold Alerts | 784 | Ghost: week-19-learning-mixpanel-alerts |
| /blog/week-18-learning-mixpanel-creating/ | How to Create Cohorts from a Mixpanel Report | [Week 18] Learning Mixpanel: Creating Cohorts from a Report | Create cohorts straight from Mixpanel Insights, Funnels and Retention reports, and learn which ones stay static and which update as users convert. | How to Create Cohorts from a Mixpanel Report | 408 | Ghost: week-18-learning-mixpanel-creating |
| /blog/week-17-learning-mixpanel-advanced/ | Mixpanel Annotations: Add Context to Charts | [Week 17] Learning Mixpanel: Annotations | How to add annotations to Mixpanel charts to explain a spike or change on a given date, and which line and column chart types support them. | Mixpanel Annotations: Add Context to Charts | 182 | Ghost: week-17-learning-mixpanel-advanced |
| /blog/week-16-learning-mixpanel-dashboards/ | Mixpanel Dashboards: Filters and Subscriptions | [Week 16] Learning Mixpanel: Dashboards in depth | How Mixpanel dashboards work: combining reports with text and images, filters that override report filters, and Slack or email subscriptions. | Mixpanel Dashboards | 258 | Ghost: week-16-learning-mixpanel-dashboards |
| /blog/week-15-learning-mixpanel-mastering/ | Mixpanel Flows Report: Map User Paths \| Datalyze | [Week 15] Learning Mixpanel: Mastering Flows with Mixpanel | How to use Flows in Mixpanel to see the paths users take before and after an event: user flows, top paths, hiding events and breakdown by conversion. | Mixpanel Flows Report: Map User Paths | 862 | Ghost: week-15-learning-mixpanel-mastering |
| /blog/week-14-learning-mixpanel-frequency/ | Mixpanel Frequency Report: How to Use It \| Datalyze | [Week 14] Learning Mixpanel: Frequency Analysis | Use the Mixpanel frequency report to see how often users repeat an action: grouping by hour, day or month, cumulative vs non-cumulative, charts. | Mixpanel Frequency Report: How to Use It | 588 | Ghost: week-14-learning-mixpanel-frequency |
| /blog/week-13-learning-mixpanel-retention/ | Mixpanel Retention Report: How It Works \| Datalyze | [Week 13] Learning Mixpanel: Retention Analysis | How the Mixpanel retention report works: retention criteria, how the weighted average is calculated, day and calendar grouping, and chart options. | Mixpanel Retention Report: How It Works | 1471 | Ghost: week-13-learning-mixpanel-retention |
| /blog/week-12-learning-mixpanel-mastering/ | Mixpanel Funnels: Complete Guide \| Learning Mixpanel | [Week 12] Learning Mixpanel: Mastering Funnels in Mixpanel | How to build funnels in Mixpanel: conversion windows, any order steps, exclusions, holding a property constant, and each conversion rate measure. | Mixpanel Funnels: Complete Guide | 3326 | Ghost: week-12-learning-mixpanel-mastering |
| /blog/week-11-learning-mixpanel-insights/ | Mixpanel Insights Report: Complete Guide \| Datalyze | [Week 11] Learning Mixpanel: Insights report | A full guide to the Mixpanel Insights report: date and compare options, chart types, event metrics, frequency per user, aggregates and formulas. | Mixpanel Insights Report: Complete Guide | 2073 | Ghost: week-11-learning-mixpanel-insights |
| /blog/week-10-learning-mixpanel-creating/ | Analytics Strategy for Mixpanel in 3 Steps | [Week 10] Learning Mixpanel: Creating an analytics strategy | How to create an analytics strategy for Mixpanel: break your product into parts, design metrics that inform decisions, and avoid going too deep. | Analytics Strategy for Mixpanel in 3 Steps | 550 | Ghost: week-10-learning-mixpanel-creating |
| /blog/week-9-learning-mixpanel-checking-data-flow/ | How to Check Data Flow in Mixpanel \| Datalyze | [Week 9] Learning Mixpanel: Checking data flow | How to confirm Mixpanel events arrive correctly: trigger events, then check event names, property values, duplicates, and profile properties. | How to Check Data Flow in Mixpanel | 475 | Ghost: week-9-learning-mixpanel-checking-data-flow |
| /blog/week-8-learning-mixpanel-setting/ | How to Set Up Mixpanel: SDK, ID Merge, Properties | [Week 8] Learning Mixpanel: Setting up Mixpanel | Set up Mixpanel from scratch: find your token, install the SDK, identify users, pick Simplified or Original ID Merge, and send events and properties. | How to Set Up Mixpanel | 1103 | Ghost: week-8-learning-mixpanel-setting |
| /blog/week-7-learning-mixpanel-creating/ | Mixpanel Event Tracking Plan: How to Create One | [Week 7] Learning Mixpanel: Creating an event- tracking plan | How to build an event tracking plan for Mixpanel: what it includes, how to write a good one, best practices, and a sample plan for a real product. | Mixpanel Event Tracking Plan | 738 | Ghost: week-7-learning-mixpanel-creating |
| /blog/week-6-learning-mixpanel-choosing/ | Mixpanel Tracking: Client vs Server vs Hybrid | [Week 6] Learning Mixpanel: Choosing Client vs Server vs Hybrid tracking method | How to send data to Mixpanel: client-side, server-side or hybrid, the pros and cons of each, and how to set up a proxy for client-side tracking. | Mixpanel Tracking: Client vs Server vs Hybrid | 511 | Ghost: week-6-learning-mixpanel-choosing |
| /blog/week-5-learning-mixpanel-user-profiles/ | Mixpanel User Profiles: Create and Update Them | [Week 5] Learning Mixpanel: User Profiles | How user profiles work in Mixpanel: filtering users in the Users tab, creating and updating profiles, importing from CSV, and deleting properties. | Mixpanel User Profiles | 467 | Ghost: week-5-learning-mixpanel-user-profiles |
| /blog/how-to-create-a-tracking-plan-and/ | How to Create a Tracking Plan and Why It Matters | How to Create a Tracking Plan, and Why It Matters | Why startups that skip a tracking plan end up with messy data, what a good plan includes, how to decide what to track, and how to build one. | How to Create a Tracking Plan and Why It Matters | 1120 | Ghost: how-to-create-a-tracking-plan-and |
| /blog/week-4-learning-mixpanel-cohorts/ | Mixpanel Cohorts: Examples and How They Work | [Week 4] Learning Mixpanel: Cohorts | What cohorts are in Mixpanel, seven example cohorts built from purchases and user traits, and why a cohort filter only counts users in it today. | Mixpanel Cohorts: Examples and How They Work | 399 | Ghost: week-4-learning-mixpanel-cohorts |
| /blog/week-3-learning-mixpanel-introduction/ | What Is Lexicon in Mixpanel? \| Learning Mixpanel | [Week 3] Learning Mixpanel: Introduction to Lexicon | Lexicon is Mixpanel's dictionary of every event and property you track. What you can do with it and how it keeps your tracking consistent. | What Is Lexicon in Mixpanel? | 244 | Ghost: week-3-learning-mixpanel-introduction |
| /blog/week-2-learning-mixpanel-mixpanel/ | Mixpanel Basics: Data Structure and Properties | [Week 2] Learning Mixpanel: Mixpanel Basics | Mixpanel basics: the startup program, how data is structured, event, profile and super properties, autocapture vs custom events, and sessions. | Mixpanel Basics | 1111 | Ghost: week-2-learning-mixpanel-mixpanel |
| /blog/week-1-learning-mixpanel-introduction/ | What Is Mixpanel? An Introduction \| Datalyze | [Week 1] Learning Mixpanel: Introduction to Mixpanel | What Mixpanel is, the product questions it can answer, how product analytics differs from business analytics, and how it compares to Heap and FullStory. | What Is Mixpanel? An Introduction | 337 | Ghost: week-1-learning-mixpanel-introduction |
| /blog/why-its-time-to-switch-from-ga-to/ | Google Analytics vs Mixpanel: Why Switch \| Datalyze | Why It's Time to Switch from GA to Mixpanel | Why teams stay on Google Analytics, why Mixpanel is as easy to set up and has a free tier, and the product questions it answers that GA can't. | Google Analytics vs Mixpanel: Why Switch | 540 | Ghost: why-its-time-to-switch-from-ga-to |
| /blog/solving-retention-problems-a-strategic/ | How to Solve Retention Problems: A 3-Step Framework | Solving Retention Problems: A Strategic Framework | A three-step framework for retention: define what retention means for you, compare retained and churned cohorts, then turn the gaps into experiments. | How to Solve Retention Problems | 839 | Ghost: solving-retention-problems-a-strategic |
| /blog/let-go-of-vanity-metrics-and-start/ | Vanity Metrics vs Actionable Metrics \| Datalyze | Let go of vanity metrics, and start focusing on actionable metrics | The difference between vanity and actionable metrics, how to combine metrics into something you can act on, and a worked example using Instagram. | Vanity Metrics vs Actionable Metrics | 855 | Ghost: let-go-of-vanity-metrics-and-start |
| /blog/5-biggest-problems-i-see-with-founders/ | 5 Mistakes Founders Make Trying to Be Data-Driven | 5 Biggest Problems I See with Founders Trying to Be Data-Driven | Five mistakes founders make with data: underestimating the effort, acting too early, tracking too much, watching vanity metrics, never asking why. | 5 Mistakes Founders Make Trying to Be Data-Driven | 1023 | Ghost: 5-biggest-problems-i-see-with-founders |
| /blog/the-mindset-for-solving-complex-problem/ | How to Solve Complex Analytics Problems: 5 Habits | The Mindset for Solving Complex Problem Statements | Five habits for hard analytics problems: be ready to start over, separate correlation from causation, map every hypothesis, and test your assumptions. | How to Solve Complex Analytics Problems | 1119 | Ghost: the-mindset-for-solving-complex-problem |
| /blog/transforming-analytics-from-a-support/ | Analytics as a Growth Function, Not Support \| Datalyze | Transforming analytics from a support function to a growth function at your organization | How analytics moves from answering other teams' requests to owning its own questions, bringing hypotheses, and being judged on outcomes. | Analytics as a Growth Function, Not Support | 735 | Ghost: transforming-analytics-from-a-support |
| /blog/finding-the-aha-moment-for-your-product/ | How to Find Your Product's Aha Moment \| Datalyze | Finding the AHA moment for your product | What an aha moment is, how to find it with intuition, user interviews and data, and how to get more users to it sooner through onboarding. | How to Find Your Product's Aha Moment | 858 | Ghost: finding-the-aha-moment-for-your-product |
| /blog/lifecycle-of-a-problem-statement/ | How to Write a Good Problem Statement for Analytics | Lifecycle of a problem statement: Defining a good one, & the approach to solve it | How to define and rank a product problem, then solve it in five steps: hypothesis, data analysis, deep dive, implementation plan and measurement. | How to Write a Good Problem Statement for Analytics | 726 | Ghost: lifecycle-of-a-problem-statement |
| /blog/three-levers-to-optimize-product/ | 3 Levers to Improve Product Experience \| Datalyze | Three Levers to Optimize Product Experience for End Users | Three levers for a better product experience: reduce friction, close the gap between what users expect and what they get, and cut the learning curve. | 3 Levers to Improve Product Experience | 832 | Ghost: three-levers-to-optimize-product |
| /blog/overview-of-the-insights-report/ | Mixpanel Insights Report: A Quick Overview \| Datalyze | Overview of the Insights report | How the Mixpanel Insights report works: choose what to measure, filter events, add a breakdown, set the timeframe and pick the right chart type. | Mixpanel Insights Report: A Quick Overview | 645 | Ghost: overview-of-the-insights-report |
| /blog/developers-guide-to-implementing/ | Mixpanel Client-Side Implementation: Developer Guide | Developer’s guide to implementing Mixpanel (client-side) | A developer guide to Mixpanel client-side setup: project token, SDK install, tracking events, property types, identity management and data checks. | Mixpanel Client-Side Implementation | 669 | Ghost: developers-guide-to-implementing |
| /blog/data-tracking-comparing-client-vs/ | Client vs Server vs Hybrid Tracking \| Datalyze | Data tracking: Comparing Client vs Server vs Hybrid | Client-side, server-side and hybrid tracking compared: setup effort, data lost to ad blockers, front-end context, and which one most products need. | Client vs Server vs Hybrid Tracking | 668 | Ghost: data-tracking-comparing-client-vs |
| /blog/how-to-create-an-analytics-strategy/ | How to Create an Analytics Strategy for Your Product | How to create an analytics strategy for your product? | Build an analytics strategy in three steps: split the product into AAARRR stages, pick metrics that change decisions, and stop before going too deep. | How to Create an Analytics Strategy for Your Product | 712 | Ghost: how-to-create-an-analytics-strategy |
| /blog/creating-an-event-tracking-plan-for/ | Event Tracking Plan: Scope, Naming and Structure | Creating an Event tracking plan for your product | What an event tracking plan is, how much to track, how to name events, when to use a property instead of a new event, and how to draft one. | Event Tracking Plan | 770 | Ghost: creating-an-event-tracking-plan-for |
| /blog/getting-start-with-mixpanel-the-basics/ | Getting Started with Mixpanel: First Steps \| Datalyze | Getting started with Mixpanel: The basics | How to start with Mixpanel: check if you qualify for the startup program, create your account and project, then confirm your data is flowing. | Getting Started with Mixpanel: First Steps | 375 | Ghost: getting-start-with-mixpanel-the-basics |
| /blog/what-are-events-and-properties-in/ | Mixpanel Events and Properties Explained \| Datalyze | What are events & properties in Mixpanel? | What an event is in Mixpanel, and how event, profile and super properties differ. Simple examples of when to use each type of property. | Mixpanel Events and Properties Explained | 708 | Ghost: what-are-events-and-properties-in |
| /blog/mixpanel-setup-the-right-way/ | How to Set Up Mixpanel the Right Way: 5 Steps \| Datalyze | Mixpanel setup → The right way | The five steps of a Mixpanel setup, in order: tracking spec, code and data checks, analytics strategy, dashboards, and then deeper analysis. | How to Set Up Mixpanel the Right Way: 5 Steps | 777 | Ghost: mixpanel-setup-the-right-way |
| /blog/tag/case-studies/ | Case Studies \| Datalyze | Case Studies | Product analytics playbooks, case studies, and resources for Founders, PMs and Growth folks | Case Studies | 1166 | Ghost archive (app/blog/tag) |
| /blog/tag/indian-d2c-playbook/ | Indian D2C Playbook \| Datalyze | Indian D2C Playbook | A series breaking down analytics, metrics, and data truths for Indian D2C brands — sourced from the Datalyze website playbook. | Indian D2C Playbook | 736 | Ghost archive (app/blog/tag) |
| /blog/tag/learning-mixpanel/ | Learning Mixpanel: A 28-Week Series \| Datalyze | Learning Mixpanel | Learn Mixpanel week by week: events, properties, cohorts, funnels, retention, dashboards, lookup tables, warehouse connectors and attribution. | Learning Mixpanel: A 28-Week Series | 1201 | Ghost archive (app/blog/tag) |
| /blog/author/ansh/ | Ansh Agrawal \| Datalyze | Ansh Agrawal | I help startups set up analytics, understand user behaviour, and gain actionable insights to drive product growth | Ansh Agrawal | 1186 | Ghost archive (app/blog/author) |
