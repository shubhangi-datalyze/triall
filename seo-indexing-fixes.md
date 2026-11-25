# SEO indexing fixes: Phase 1 report

Prepared 2026-10-14 for review. Nothing in the repo or in Ghost has been changed yet. Phase 2 starts only after you approve.

**How this was checked:** a crawl of the live site on 2026-10-14 (179 URLs, every link in the server HTML, as Googlebot sees it), every post pulled from the Ghost Content API (78 posts), the repo on `feat/playbook` (which matches what is live), and the public Substack archive at mixpanelsimplified.substack.com.

**Duplicate audit:** `seo-duplicate-audit.md` does not exist in the repo or in any branch's history. So no page is skipped on its say-so. Where I found overlaps, I flag them in section 6. Nothing is merged or deleted unless you approve it here.

---

## 0. What is actually going on (read this first)

Four findings change the plan. Some of the actions in the brief are already done, and one cause matters more than internal linking.

1. **All 46 imported posts are still live on Substack, in full.** Every Learning Mixpanel week and every older standalone post (Group C, Group E, and more) is published at `mixpanelsimplified.substack.com/p/<same-slug>`. Each Substack copy has a canonical pointing at itself, is public ("everyone"), and is dated 2024 to 2025. The Ghost copies were imported in February 2026. To Google, the Substack copy is the original and ours is the duplicate. This is the most likely reason for "Crawled, not indexed" on weeks 2, 10, 13 and 20, and it holds back every other imported post. Substack has no per-post canonical setting, so the fix has to happen on Substack, and only you can do it (section 3.6). No repo change fixes this.

2. **Group A is not under-linked.** The header dropdown is in the server HTML on every page, not rendered after a click. The crawl found `/services/analytics-setup`, `/services/reporting-and-analysis`, `/services/ai-layer`, `/tools/event-tracking-plan-generator` and `/ask` each linked from 156 non-listing pages. The three service pages first shipped on 2026-09-22, about three weeks ago. "Discovered, not crawled" on pages that new, with sitewide links, is a crawl-scheduling lag, not a linking problem. The footer and homepage fixes below are still worth doing, because contextual links are better signals than nav links. But expect Request Indexing and time to do most of the work for Group A.

3. **The "Keep reading" block concentrates links on the newest 3 posts in each tag.** On every post, `relatedTo()` in `app/blog/[slug]/page.tsx` shows the three newest posts with the same primary tag. So weeks 26, 27 and 28 each get 27 contextual links, and weeks 2 to 25 get 2 to 4. In the same way, Buildern, FRAI and AnyIP get 18 to 46, and Foriio, Sama and Petcademy get 1. Untagged posts fall back to the three newest posts on the blog, so the old standalone posts get zero. This one function explains most of the low inlink counts in Groups B to E. Changing it to rotate through the series gives every post at least 3 contextual links. This is the highest-value code change.

4. **Several brief items are already live:**
   - Learning Mixpanel previous/next links and a start-of-series link (`components/blog/SeriesNav.tsx`).
   - The old week 9 slug already redirects (`next.config.ts`), and no page links to it any more (0 found in the crawl or in Ghost HTML).
   - `/favicon.ico` already returns 200 (rewritten to `/icon.png`).
   - `/tools` and `/ask` are both already handled: `/ask` is in the footer, and `/tools` is a 308 redirect to `/resources#tools`, which the footer already links as "All free tools".
   - No rendered page links to `cms.joindatalyze.com` or `blog.joindatalyze.com`. `publicHref()` rewrites Ghost's links at render time.
   - The CRED link on the homepage already points at the exact final URL (`https://www.joindatalyze.com/blog/case-study-cred/`, 200, no redirect).
   - `/case-studies` already lists all 17 case studies in Ghost, including all four in Group B. None are missing.

**Sitewide technical checks all pass.** All 163 URLs in `/sitemap.xml` and `/blog/sitemap.xml` return 200. Each has a self-referencing canonical that matches the sitemap URL exactly, including the trailing slash on `/blog/`. No page in Groups A to E has a noindex tag or an `X-Robots-Tag` header. robots.txt blocks only `/api/` and `/admin/`.

---

## 1. Every URL

"Inlinks now" comes from the live crawl and counts distinct pages linking to the URL. The first number counts every page. The second leaves out listing pages (blog index pages, tag pages, author pages and their `/page/N/` versions), because those are weak signals.

### Group A: service and tool pages

| URL | Current title | Proposed title | Proposed meta description | Inlinks now (all / non-listing) | Links to add | Other changes |
|---|---|---|---|---|---|---|
| /services/analytics-setup | Mixpanel, Amplitude & PostHog Setup \| Datalyze | **Analytics Setup and Implementation Services \| Datalyze** (the current title competes with the three tool pages) | Keep: "Mixpanel, Amplitude or PostHog set up from scratch: tracking plan, implementation with your developers, validation, strategy and first dashboards." | 176 / 156 (header nav) | Homepage "Revenue doesn't add up" card (now `/contact?service=setup`). Footer Services column. Related-services block on 6 playbook chapters and the tracking-plan and setup posts. | None |
| /services/reporting-and-analysis | Product Analytics Reporting and Analysis \| Datalyze | Keep | Keep | 176 / 156 | Homepage "Where users drop off" card and Method step 04 (both now `/contact?service=reporting-analysis`). Footer. Related-services block on 13 playbook chapters and the analysis posts (funnels, retention, flows, frequency, alerts). | Add CRED as a third case study card. |
| /services/ai-layer | AI Layer for Analytics: Semantic Layer & MCP \| Datalyze | Keep | Keep | 176 / 156 | Footer. Related-services block on `/playbook/analytics-and-ai`, `/blog/case-study-answering-agent/` and the analytics-debt post. | None |
| /tools/event-tracking-plan-generator | Free Event Tracking Plan Generator - Claude Skill | Keep | Keep | 176 / 156 (footer) | Related-services block on the tracking-plan posts: weeks 7 and 9, `/blog/creating-an-event-tracking-plan-for/`, `/blog/how-to-create-a-tracking-plan-and/` and `/playbook/creating-a-tracking-plan`. | None |
| /tools (hub) | None. A 308 to `/resources#tools` since the tools hub was merged into /resources. | n/a | n/a | 0 (no page links to it) | **None, on purpose.** Linking a redirect from the footer would send crawlers through a hop on every page. The footer already links `/resources#tools`. | GSC will drop it as "Page with redirect". If you want a real /tools hub back instead, that is a new page under the content standard. Say so and I will scope it. |
| /ask (hub) | Ask Ansh's AI \| Datalyze | **Ask Ansh's AI: Analytics Questions Answered \| Datalyze** | Keep: "Ask any analytics question, answered only from Ansh Agrawal's own writing on tracking, attribution and retention. Not covered? You get a straight no." | 176 / 156 (footer) | Already in the footer. | The page has 124 words of server HTML and **does not link to any of its 16 published answers**. Add a server-rendered list of the published `/ask/<slug>` questions below the chat. This makes /ask worth indexing, and each answer page gains a link from a page linked sitewide. Today each answer has 4 or 5 links. |

### Group B: case studies

`/case-studies` lists every case study in Ghost (17 of 17), so none are missing.

| URL | Current title | Proposed title | Proposed meta description | Inlinks now (all / non-listing) | Links to add | Other changes |
|---|---|---|---|---|---|---|
| /blog/case-study-cred/ (603 words) | H1 "CRED: Improving PSR (+7%), reducing Cost (12%) and outage (93%)" / title "CRED Case Study: Payment Routing, +7% Success Rate" | **CRED Case Study: Payment Routing, +7% Success Rate** (H1 set to match, per rule 1) | Keep current | 6 / 3: homepage, /case-studies, /industries/fintech | Case study card on /services/reporting-and-analysis. 3 sibling case studies through the rotated "Keep reading" block. Related-services block pointing to /services/reporting-and-analysis and /industries/fintech. | The homepage link is already the exact final URL. |
| /blog/case-study-foriio/ (633 words) | H1 "Foriio: Improving Activation (+8%) & Retention (6%)" / title "Foriio Case Study: +8% Activation, +6% Retention" | **Foriio Case Study: +8% Activation, +6% Retention** (H1 to match) | Keep | 4 / 1: /case-studies only | Case study card on /industries/consumer-apps. 3 sibling case studies through "Keep reading". | None |
| /blog/case-study-gametree/ (375 words) | H1 "GameTree: Improving Day 0 Activation (+5%)" / title "GameTree Case Study: +5% Day 0 Activation \| Datalyze" | **GameTree Case Study: +5% Day 0 Activation** (H1 to match) | Keep | 5 / 2: /case-studies, /industries/consumer-apps | 3 sibling case studies through "Keep reading". | None |
| /blog/case-study-stealth/ (315 words) | H1 "Stealth Startup: Increased Activation (+22%), and time spent on app (+2 mins)" / title "Case Study: +22% Activation From Higher Free Limits" | **Case Study: +22% Activation From Higher Free Limits** (H1 to match) | Keep | 6 / 3: /case-studies, /services/posthog-implementation, /services/reporting-and-analysis | 3 sibling case studies through "Keep reading". | The thinnest case study, and anonymous. Expect it to index last. |

### Group C: Learning Mixpanel series

**Hub:** I recommend **turning the existing tag page `/blog/tag/learning-mixpanel/` into the hub**, rather than creating `/blog/learning-mixpanel/`. The tag page is already in the sitemap, already known to Google, and already linked from 47 pages. A second page with the same list would compete with it. In Phase 2 the tag page gets a short intro and all 28 weeks on one page in week order, each with its one-line description. The description is the post's Ghost meta description, so it stays editable in Ghost. `/blog/tag/learning-mixpanel/page/2/` and `/page/3/` 301 back to it. Its current title, "Learning Mixpanel: A 28-Week Series | Datalyze", stays. The proposed meta description is: "A free 28-week Mixpanel course: events, properties, cohorts, funnels, retention, dashboards, lookup tables, warehouse connectors and attribution, in order." The hub is linked from /services/mixpanel-implementation, the blog index (a course callout above the grid), the footer Resources column, and every week's series box. If you would rather have a separate hub URL, say so. It means adding a route exception in `/blog/[slug]`.

**Series label:** the eyebrow above each week's H1 becomes "Learning Mixpanel · Week N of 28", linking to the hub. The H1 itself becomes the search title below. The existing series box at the end of each post gains a "See all 28 weeks" link to the hub.

**URLs do not change.** Ghost keeps a published post's slug when its title changes.

| Wk | URL | GSC | Current H1 / current &lt;title&gt; | Proposed title (H1 = meta title) | Proposed meta description | Inlinks now (all / non-listing) | Notes |
|---|---|---|---|---|---|---|---|
| 1 | /blog/week-1-learning-mixpanel-introduction/ | Not crawled | [Week 1] Learning Mixpanel: Introduction to Mixpanel / What Is Mixpanel? An Introduction | Datalyze | **What Is Mixpanel? An Introduction for Product Teams** | Keep: What Mixpanel is, the product questions it can answer, how product analytics differs from business analytics, and how it compares to Heap and FullStory. | 31 / 28 | 336 words. Overlaps /blog/getting-start-with-mixpanel-the-basics/ (373 words). See section 6. |
| 2 | /blog/week-2-learning-mixpanel-mixpanel/ | Crawled, not indexed | [Week 2] Learning Mixpanel: Mixpanel Basics / Mixpanel Basics: Data Structure and Properties | **Mixpanel Sessions: Session Start, End and Timeout Settings** | How Mixpanel defines a session, when Session Start and Session End fire, the three ways to change session timing, and the session properties you get. | 6 / 3 | 1112 words. Move the Sessions section to the top of the post in Ghost and expand it (how to change the timeout in Project Settings, reading session duration in Insights). Today it is ~250 of 1,112 words, so a sessions title over-promises unless the section grows. |
| 3 | /blog/week-3-learning-mixpanel-introduction/ | Not crawled | [Week 3] Learning Mixpanel: Introduction to Lexicon / What Is Lexicon in Mixpanel? | Learning Mixpanel | **What Is Lexicon in Mixpanel? How to Use It** | Keep: Lexicon is Mixpanel's dictionary of every event and property you track. What you can do with it and how it keeps your tracking consistent. | 6 / 3 | 246 words. Thin (246 words). |
| 4 | /blog/week-4-learning-mixpanel-cohorts/ | Not crawled | [Week 4] Learning Mixpanel: Cohorts / Mixpanel Cohorts: Examples and How They Work | **How to Create Cohorts in Mixpanel, With 7 Examples** | Keep: What cohorts are in Mixpanel, seven example cohorts built from purchases and user traits, and why a cohort filter only counts users in it today. | 6 / 3 | 395 words.  |
| 5 | /blog/week-5-learning-mixpanel-user-profiles/ | Not crawled | [Week 5] Learning Mixpanel: User Profiles / Mixpanel User Profiles: Create and Update Them | **How to Create and Update User Profiles in Mixpanel** | Keep: How user profiles work in Mixpanel: filtering users in the Users tab, creating and updating profiles, importing from CSV, and deleting properties. | 5 / 2 | 468 words.  |
| 6 | /blog/week-6-learning-mixpanel-choosing/ | Not in your list | [Week 6] Learning Mixpanel: Choosing Client vs Server vs Hybrid tracking method / Mixpanel Tracking: Client vs Server vs Hybrid | **Client-Side vs Server-Side Tracking in Mixpanel** | Client-side, server-side or hybrid: how each sends data to Mixpanel, what each loses, which to choose, and how to proxy client-side tracking. | 5 / 2 | 514 words. Overlaps /resources/client-vs-proxy-vs-server-tracking, /blog/data-tracking-comparing-client-vs/, /ask/client-vs-server-side-tracking. |
| 7 | /blog/week-7-learning-mixpanel-creating/ | Not in your list | [Week 7] Learning Mixpanel: Creating an event- tracking plan / Mixpanel Event Tracking Plan: How to Create One | **How to Create an Event Tracking Plan for Mixpanel** | Keep: How to build an event tracking plan for Mixpanel: what it includes, how to write a good one, best practices, and a sample plan for a real product. | 5 / 2 | 725 words. Overlaps 5 other tracking-plan pages (see section 6). |
| 8 | /blog/week-8-learning-mixpanel-setting/ | Not crawled | [Week 8] Learning Mixpanel: Setting up Mixpanel / How to Set Up Mixpanel: SDK, ID Merge, Properties | **How to Set Up Mixpanel: SDK, Identify and ID Merge** | Keep: Set up Mixpanel from scratch: find your token, install the SDK, identify users, pick Simplified or Original ID Merge, and send events and properties. | 5 / 2 | 1086 words. Overlaps /blog/mixpanel-setup-the-right-way/, /blog/developers-guide-to-implementing/, /ask/how-to-set-up-mixpanel-properly. |
| 9 | /blog/week-9-learning-mixpanel-checking-data-flow/ | Not in your list | [Week 9] Learning Mixpanel: Checking data flow / How to Check Data Flow in Mixpanel | Datalyze | **How to Check Your Data Is Flowing Into Mixpanel** | Keep: How to confirm Mixpanel events arrive correctly: trigger events, then check event names, property values, duplicates, and profile properties. | 5 / 2 | 465 words.  |
| 10 | /blog/week-10-learning-mixpanel-creating/ | Crawled, not indexed | [Week 10] Learning Mixpanel: Creating an analytics strategy / Analytics Strategy for Mixpanel in 3 Steps | **How to Build an Analytics Strategy in Mixpanel** | Build a Mixpanel analytics strategy in three steps: break the product into parts, pick metrics that drive decisions, and stop before it sprawls. | 5 / 2 | 547 words. Overlaps /blog/how-to-create-an-analytics-strategy/, /playbook/analytics-strategy, /ask/how-to-build-an-analytics-strategy. The likely reason it is not indexed. |
| 11 | /blog/week-11-learning-mixpanel-insights/ | Not crawled | [Week 11] Learning Mixpanel: Insights report / Mixpanel Insights Report: Complete Guide | Datalyze | **Mixpanel Insights Report: A Complete Guide** | Keep: A full guide to the Mixpanel Insights report: date and compare options, chart types, event metrics, frequency per user, aggregates and formulas. | 6 / 3 | 2041 words. Near-duplicate of /blog/overview-of-the-insights-report/ (older, 640 words). See section 6. |
| 12 | /blog/week-12-learning-mixpanel-mastering/ | Not crawled | [Week 12] Learning Mixpanel: Mastering Funnels in Mixpanel / Mixpanel Funnels: Complete Guide | Learning Mixpanel | **How to Build Funnels in Mixpanel: A Complete Guide** | Keep: How to build funnels in Mixpanel: conversion windows, any order steps, exclusions, holding a property constant, and each conversion rate measure. | 5 / 2 | 3322 words.  |
| 13 | /blog/week-13-learning-mixpanel-retention/ | Crawled, not indexed | [Week 13] Learning Mixpanel: Retention Analysis / Mixpanel Retention Report: How It Works | Datalyze | **How to Use the Retention Report in Mixpanel** | How Mixpanel's retention report works: retention criteria, how the weighted average is calculated, day and calendar grouping, and which chart to read. | 7 / 4 | 1457 words. Tool how-to, so a different intent from the retention-strategy pages (/blog/solving-retention-problems-a-strategic/, /resources/improve-app-retention, /ask/how-to-measure-retention). Keep it; the title change makes the difference explicit. |
| 14 | /blog/week-14-learning-mixpanel-frequency/ | Not in your list | [Week 14] Learning Mixpanel: Frequency Analysis / Mixpanel Frequency Report: How to Use It | Datalyze | **How to Use the Frequency Report in Mixpanel** | Keep: Use the Mixpanel frequency report to see how often users repeat an action: grouping by hour, day or month, cumulative vs non-cumulative, charts. | 5 / 2 | 580 words.  |
| 15 | /blog/week-15-learning-mixpanel-mastering/ | Not crawled | [Week 15] Learning Mixpanel: Mastering Flows with Mixpanel / Mixpanel Flows Report: Map User Paths | Datalyze | **How to Use Flows in Mixpanel to Map User Paths** | Keep: How to use Flows in Mixpanel to see the paths users take before and after an event: user flows, top paths, hiding events and breakdown by conversion. | 5 / 2 | 876 words.  |
| 16 | /blog/week-16-learning-mixpanel-dashboards/ | Not crawled | [Week 16] Learning Mixpanel: Dashboards in depth / Mixpanel Dashboards: Filters and Subscriptions | **Mixpanel Dashboards: Filters and Subscriptions** | Keep: How Mixpanel dashboards work: combining reports with text and images, filters that override report filters, and Slack or email subscriptions. | 5 / 2 | 256 words. Thin (256 words). |
| 17 | /blog/week-17-learning-mixpanel-advanced/ | Not crawled | [Week 17] Learning Mixpanel: Annotations / Mixpanel Annotations: Add Context to Charts | **How to Add Annotations to Mixpanel Charts** | Keep: How to add annotations to Mixpanel charts to explain a spike or change on a given date, and which line and column chart types support them. | 5 / 2 | 187 words. Thin (187 words). |
| 18 | /blog/week-18-learning-mixpanel-creating/ | Not crawled | [Week 18] Learning Mixpanel: Creating Cohorts from a Report / How to Create Cohorts from a Mixpanel Report | **How to Create a Cohort From a Mixpanel Report** | Keep: Create cohorts straight from Mixpanel Insights, Funnels and Retention reports, and learn which ones stay static and which update as users convert. | 6 / 3 | 418 words.  |
| 19 | /blog/week-19-learning-mixpanel-alerts/ | Not in your list | [Week 19] Learning Mixpanel: Alerts / Mixpanel Alerts: Anomaly and Threshold Alerts | **How to Set Up Alerts in Mixpanel** | Keep: How to set up Mixpanel alerts on Insights and Funnels reports: anomaly detection, custom thresholds, how often to check, and email or Slack delivery. | 5 / 2 | 787 words.  |
| 20 | /blog/week-20-learning-mixpanel-sending/ | Crawled, not indexed | [Week 20] Learning Mixpanel: Sending Ad Data into Mixpanel / How to Send Ad Data into Mixpanel | Datalyze | **How to Send Ad Data Into Mixpanel to Measure ROAS** | Keep: How to bring ad data into Mixpanel for ROI and ROAS: match UTM property names, skip the distinct ID, send daily aggregates and use an insert ID. | 5 / 2 | 329 words. Thin (329 words). |
| 21 | /blog/week-21-learning-mixpanel-group-analytics/ | Not crawled | [Week 21] Learning Mixpanel: Group Analytics in Mixpanel / Mixpanel Group Analytics for B2B | Datalyze | **Group Analytics in Mixpanel: How It Works for B2B** | Keep: What Group Analytics does in Mixpanel: analyse a whole company as one user as well as the people in it. Built for B2B SaaS, sold as a paid add-on. | 5 / 2 | 210 words. Thin (210 words). |
| 22 | /blog/week-22-learning-mixpanel-lookup/ | Not crawled | [Week 22] Learning Mixpanel: Lookup Tables / Mixpanel Lookup Tables: Setup Guide | Datalyze | **How to Use Lookup Tables in Mixpanel** | Keep: How to use lookup tables in Mixpanel to add details like product name and price to a property such as product_id, and how to format the CSV. | 6 / 3 | 305 words.  |
| 23 | /blog/week-23-learning-mixpanel-borrowed/ | Not in your list | [Week 23] Learning Mixpanel: Borrowed Properties / Mixpanel Borrowed Properties Explained | Datalyze | **Borrowed Properties in Mixpanel Explained** | Keep: How borrowed properties let you use a property from another event in Mixpanel, how to create one, and how the 30 day lookback picks the value. | 5 / 2 | 277 words. Thin (277 words). |
| 24 | /blog/week-24-learning-mixpanel-custom/ | Not crawled | [Week 24] Learning Mixpanel: Custom Properties / Mixpanel Custom Properties and Formulas | Datalyze | **How to Create Custom Properties in Mixpanel** | Keep: How to create custom properties in Mixpanel with formulas, with examples like grouping paid channels and calculating age, plus every operator. | 5 / 2 | 499 words.  |
| 25 | /blog/week-25-learning-mixpanel-warehouse/ | Not crawled | [Week 25] Learning Mixpanel: Warehouse Connectors / Mixpanel Warehouse Connectors: Setup Guide | **Mixpanel Warehouse Connectors: How to Set Them Up** | Keep: Load data from BigQuery, Snowflake, Databricks or Redshift into Mixpanel: events, user and group profiles, lookup tables, and each sync mode. | 7 / 4 | 959 words.  |
| 26 | /blog/week-26-learning-mixpanel-mastering/ | Not crawled | [Week 26] Learning Mixpanel: Mastering Attribution with Mixpanel / Mixpanel Attribution Models Explained | Datalyze | **Mixpanel Attribution Models Explained** | Keep: How attribution works in Mixpanel: the lookback window and each model, including first touch, last touch, linear, time decay, U shaped and J shaped. | 30 / 27 | 885 words.  |
| 27 | /blog/week-27-learning-mixpanel-bucket/ | Not in your list | [Week 27] Learning Mixpanel: Bucket Customisation Types / Mixpanel Bucket Customisation: Group Values | **How to Customise Buckets in Mixpanel Breakdowns** | Keep: How to customise buckets in Mixpanel breakdowns: even, varied or no buckets for numbers, and if else or contains rules to group string values. | 30 / 27 | 623 words.  |
| 28 | /blog/week-28-learning-mixpanel-computed/ | Not in your list | [Week 28] Learning Mixpanel: Computed Properties / Mixpanel Computed Properties: How to Use Them | **Computed Properties in Mixpanel Explained** | Keep: The four computed properties in Mixpanel: frequency per user, aggregate property per user, duration in Insights, and time to convert in Funnels. | 30 / 27 | 804 words.  |

Links to add, for every week: 1 from the hub (linked sitewide from the footer), 3 from neighbouring weeks through the rotated "Keep reading" block (today all 28 posts point at weeks 26 to 28), and the existing previous/next links. Each week also gets a related-services block that links out to /services/mixpanel-implementation.

### Group D: D2C playbook series

The 7 parts get the same treatment as Learning Mixpanel: an eyebrow reading "Indian D2C Playbook · Part N of 7", previous and next links, and a link to `/blog/tag/indian-d2c-playbook/` at the end of each post. "Keep reading" rotates through the series.

| Part | URL | Current H1 / current &lt;title&gt; | Proposed title (H1 = meta title) | Proposed meta description | Inlinks now (all / non-listing) | Overlap |
|---|---|---|---|---|---|---|
| 1 | /blog/d2c-playbook-1-the-data-foundation/ | D2C Playbook 1 -- The Data Foundation: Fix Your Owned Layer Before You Scale Spend / D2C Analytics: Fix Your Data Foundation First | **D2C Analytics Setup: Build Your Data Foundation First** | Keep: Why D2C brands should fix their owned data layer before scaling spend: how many events to track, identity stitching, consent, and Shopify vs Meta revenue. | 3 / 0 | /playbook/data-loss, /playbook/identity-stitching, /blog/how-to-set-up-product-analytics-the-right-way/. Different angle (D2C, owned vs rented channels); keep, retitle. |
| 2 | /blog/d2c-playbook-2-putting-all-your-data-in-one-place/ | D2C Playbook 2 -- Putting all your data in one place / D2C Playbook 2: Put All Your Data in One Place | **How to Unify Shopify, Blinkit, Swiggy and Amazon Data** | What data your site, Blinkit, Swiggy and Amazon each give a D2C brand, which joins are exact, which are estimates, and how to land it all in one warehouse. | 5 / 2 | /playbook/unifying-data, /blog/connecting-marketing-and-product-data/, and part 5 of this series. Keep; the new title names the channels, which the others do not. |
| 3 | /blog/d2c-playbook-3-why-your-conversions-look-too-good/ | D2C Playbook 3-- Why your conversions look too good / Why Your D2C Conversion Numbers Look Too Good | **Why Meta and Google Over-Report Your D2C Conversions** | Keep: Why Meta and Google together claim more revenue than you made, which number to trust, and how to build attribution in-house from your own backend. | 4 / 1 | /ask/why-do-my-conversions-look-too-good (answer derived from this post). |
| 4 | /blog/d2c-playbook-4-event-taxonomy-tool-stack-before-you-scale-spend/ | D2C Playbook 4 -- Event Taxonomy & Tool Stack Before You Scale Spend / D2C Event Tracking: Taxonomy and Tool Stack | Datalyze | **D2C Event Tracking Plan: The 20 to 30 Events to Track** | Keep: The 20 to 30 events a D2C brand should track, how to name them, why properties beat more events, and the one analytics tool and warehouse you need. | 7 / 4 | The tracking-plan cluster (section 6). Keep; the D2C event list is its own angle. |
| 5 | /blog/d2c-playbook-5-how-to-actually-stitch-website-blinkit-and-swiggy-data/ | D2C Playbook 5 -- How to actually stitch website, Blinkit and Swiggy data / How to Stitch Website, Blinkit and Swiggy Data | **How to Stitch Website, Blinkit and Swiggy Data** | Keep: Stitching D2C data is three jobs: clean joins, fuzzy joins and joins you can't make. How SKU mapping works and where stitched dashboards mislead. | 9 / 6 | Part 2. |
| 6 | /blog/d2c-playbook-6-incrementality-testing/ | D2C Playbook 6 -- Incrementality Testing / Incrementality Testing for D2C Brands | Datalyze | **Incrementality Testing for D2C Brands: Geo Holdouts** | Keep: What incrementality testing is, how a geo holdout works end to end, how to calculate incremental ROAS, and what makes a test give the wrong answer. | 38 / 35 | /playbook/incremental-testing, /ask/incrementality-testing-for-d2c. |
| 7 | /blog/d2c-playbook-7-marketing-mix-modeling-mmm/ | D2C Playbook 7 -- Marketing Mix Modeling (MMM) / Marketing Mix Modeling (MMM) for D2C Brands | **Marketing Mix Modeling (MMM) for D2C Brands** | Keep: What MMM needs, what it gives back, base vs incremental revenue, adstock and saturation, where it misleads, and why you calibrate it against a test. | 37 / 34 | /playbook/media-mix-modelling, /ask/what-is-marketing-mix-modeling. |

Ghost change for the series tag: the description of `indian-d2c-playbook` says the series is "sourced from the Datalyze website playbook". Those pages were deleted, so the sentence no longer makes sense. Proposed: "A 7-part series on analytics for Indian D2C brands: owned data, unifying channels, attribution, event tracking, stitching Blinkit and Swiggy, incrementality and MMM."

### Group E: older standalone posts

| URL | Words | Searchable topic? | Pages linking to it now | Substack duplicate? | Recommendation |
|---|---|---|---|---|---|
| /blog/5-biggest-problems-i-see-with-founders/ | 1,021 | Yes, moderate ("mistakes founders make with data", "how to be data-driven") | 2, both listing pages. No contextual link. | Yes | **KEEP AND IMPROVE.** Title: **"5 Mistakes Founders Make Trying to Be Data-Driven"** (already the meta title; set the H1 to match). Description: keep. Should be linked from `/blog/let-go-of-vanity-metrics-and-start/` (mistake 4 is that topic; the link exists only the other way today), `/blog/analytics-debt-the-silent-killer-nobody-talks-about-until-series-b/`, and `/blog/how-to-create-an-analytics-strategy/`. These are in-post links, added in Ghost. |
| /blog/gamification-is-a-multiplier-but-multiply-by-zero-and-you-get-nothing/ | 947 | Yes ("does gamification work", "why gamification fails", "Duolingo gamification") | 2, both listing pages | **No.** Ghost only, original, 2026. | **KEEP AND IMPROVE.** Title: **"Why Gamification Fails, and When It Works"**. Description: keep. Should be linked from `/blog/finding-the-aha-moment-for-your-product/`, `/blog/solving-retention-problems-a-strategic/` (Ghost) and `/industries/consumer-apps` (repo). |
| /blog/transforming-analytics-from-a-support/ | 725 | Weak. Few people search "analytics as a growth function". | 2, both listing pages | Yes | **REMOVE.** 301 to `/playbook/product-analyst-mindset`, the closest live page on what good analytics work looks like. The match is imperfect. The alternative is to leave it as it is and accept that it won't index. |
| /blog/lifecycle-of-a-problem-statement/ | 712 | Yes, but `/playbook/product-problem-framework` answers it better and is the reviewed version | 2, both listing pages | Yes | **REMOVE.** 301 to `/playbook/product-problem-framework`. Same topic, and per your rule the playbook wins over the blog. |
| /resources/improve-app-retention | 1,290 | Yes, high demand ("how to improve app retention") | 178 / 158 (footer, sitewide) | No | **KEEP AND IMPROVE.** It is linked sitewide, so this is not a linking problem; it is the title. Title: **"How to Improve App Retention: A 6-Step Framework"**, with the H1 to match (today the H1 is "How to find what's actually driving your retention." and the title is "How to actually improve your app's retention - Datalyze"). Description: keep. Contextual links from `/blog/week-13-learning-mixpanel-retention/`, `/blog/solving-retention-problems-a-strategic/` (Ghost) and `/industries/consumer-apps` (repo). The copy lives in `public/resources/retention-demo.html`. |

### Group F: old URLs and small fixes

| Item | Current behaviour | Change |
|---|---|---|
| /indian-d2c-playbook/metrics-that-lie | 404 | 301 to **/blog/d2c-playbook-3-why-your-conversions-look-too-good/**. The old page was about ad platforms over-reporting and which numbers to trust, and part 3 is that topic. |
| /indian-d2c-playbook/questions-your-data-must-answer | 404 | 301 to **/blog/d2c-playbook-1-the-data-foundation/**. Weak match: the old page was "two layers of questions your data must answer", and no D2C post covers that directly. Part 1, on what your owned data can tell you, is the closest. The alternative is `/blog/tag/indian-d2c-playbook/`. |
| /indian-d2c-playbook/why-your-numbers-never-match (not in the brief) | 404 | 301 to **/blog/d2c-playbook-3-why-your-conversions-look-too-good/**. Its "which number to trust" is part 3's opening section. |
| /indian-d2c-playbook (not in the brief) | 404 | 301 to **/blog/tag/indian-d2c-playbook/**. |
| /week-26-learning-mixpanel-mastering/ | 308 to `/week-26-learning-mixpanel-mastering`, which is a 404 | 301 to `/blog/week-26-learning-mixpanel-mastering/`, as one pattern rule covering every `/week-N-learning-mixpanel-*` path at the root, with or without a slash. It has to sit before the slash-stripping rule in `next.config.ts`. |
| favicon.ico | Already 200. `/favicon.ico` is rewritten to `/icon.png` and served as image/png. | Optional: generate a real multi-size `app/favicon.ico` from `app/icon.png` and drop the rewrite. Google accepts the PNG today, so this is cosmetic. |
| Links to /blog/week-9-learning-mixpanel-checking-6992b4900926b2001b6f6088/ | No page links to it (0 in the crawl, 0 in Ghost HTML). The redirect to the new slug is already live. | None needed. |
| Links to blog.joindatalyze.com or cms.joindatalyze.com | 0 in rendered HTML. 9 `cms.joindatalyze.com` links remain in the Ghost source and are rewritten at render. | Clean them in Ghost so RSS and newsletter copies are right too (section 3.3). No repo change. |
| /ai-analytics-agent | 308 to `/` | **Not changed**, as asked. Noted: it is a permanent redirect to the homepage, and Google treats a redirect to the homepage as a soft 404. |

---

## 2. Code changes I will make, by file

All on a new branch from `feat/playbook`. Copy goes in `content/*.json`, per CLAUDE.md. Hrefs and mappings that aren't visible text go in `lib/`.

**Homepage links**
- `content/home.json`: five hrefs.
  - `whyUs.items.1` "Revenue doesn't add up": `/contact?service=setup` → `/services/analytics-setup`.
  - `whyUs.items.3` "Setting up PostHog": `/contact?service=setup` → `/services/posthog-implementation`. The card is about PostHog, so the PostHog page fits better than general setup.
  - `whyUs.items.4` "Where users drop off": → `/services/reporting-and-analysis`.
  - `whyUs.items.5` "Combine data from multiple sources": `/contact?service=unify` → `/services/data-unification`.
  - `method.steps.3` "Reporting & analysis": → `/services/reporting-and-analysis`.
  - After this, no homepage link goes to `/contact?service=…`. The service pages keep their own contact buttons.

**Footer**
- `content/site.json`: new `footer.servicesTitle` with `footer.services` (all 10 service pages), and new `footer.industriesTitle` with `footer.industries` (the 3 industry pages). Add the Learning Mixpanel hub to `footer.resources`. `/ask` is already there. `/tools` is not added (see Group A).
- `app/_components/footer.tsx`: render the two new columns.
- `app/globals.css` (`.footer__grid`): make room for 7 columns on desktop and wrap them on mobile.

**Blog posts**
- `app/blog/[slug]/page.tsx`:
  - Replace `relatedTo()`. A post in a series gets the next 3 posts in that series, wrapping round at the end. A case study gets the next 3 case studies. An untagged post gets its 3 nearest untagged neighbours by date. This gives every post at least 3 contextual inlinks.
  - Add the series eyebrow ("Learning Mixpanel · Week N of 28" or "Indian D2C Playbook · Part N of 7").
  - Render the new related-services block.
- `lib/blog/series.ts`: generalise to a list of series. Add the D2C playbook (7 slugs in order) next to Learning Mixpanel, each with its tag slug for the hub link.
- `components/blog/SeriesNav.tsx`: work for both series and add a "See all" link to the hub or tag page.
- `lib/blog/related-services.ts` (new): pick 1 or 2 service pages per post. Learning Mixpanel weeks → /services/mixpanel-implementation, plus a second where the topic fits: week 7 → the tracking plan generator, week 20 and week 26 → data unification, week 25 → BigQuery. Case studies → each study's service and industry page. D2C parts → data unification or reporting and analysis, by topic. Untagged posts are mapped by slug, for example tracking-plan posts → analytics setup and the generator, PostHog post → PostHog, analytics debt → audit.
- `components/blog/RelatedServices.tsx` (new): the block, placed after the series box and before the book-a-call box.
- `content/blog.json`: new copy. Series labels for the D2C playbook, the "Week N of 28" eyebrow wording, the hub intro and heading, the related-services heading, and the blog-index course callout.

**Learning Mixpanel hub**
- `app/blog/listings.tsx` and `app/blog/tag/[slug]/page.tsx`: for a tag with a series in `lib/blog/series.ts`, render the series view (intro, then every post in series order with its meta description) instead of the paginated grid.
- `app/blog/tag/[slug]/page/[page]/page.tsx`: 301 the paginated pages of a series tag to the tag page.
- `app/blog/page.tsx`: add the course callout linking to the hub.
- `app/blog/sitemap.xml/route.ts`: confirm the tag URL stays listed and the `/page/N/` URLs stay unlisted. They already are; I will check.

**Playbook chapters**
- `app/playbook/chapter-sections.tsx`: a related-services block from each chapter's existing `service` frontmatter. All 28 chapters already name one, but the page never renders it. The heading goes in `content/playbook.json`.

**Service and industry pages**
- `content/reporting.json`: add a CRED card to `caseStudies`.
- `content/industry-consumer.json`: add a Foriio card.
- `content/mixpanel.json` and its section component: a link to the Learning Mixpanel hub.
- `content/industry-consumer.json`: links to the gamification post and `/resources/improve-app-retention` (Group E).

**/ask**
- `app/ask/page.tsx`: server-render the list of the 16 published answers (`PUBLISHED_ASKS`). The heading copy goes in the /ask content file.
- Change `metadata.title` to the proposed title.

**Retention resource**
- `public/resources/retention-demo.html`: change `<title>`, `og:title`, the JSON-LD headline and the H1 to "How to Improve App Retention: A 6-Step Framework".

**Redirects** (`next.config.ts`)
- The four `/indian-d2c-playbook*` rules and the root `/week-N-learning-mixpanel-*` rule. Both go before the slash-stripping rule.
- If you approve the Group E removals: `/blog/lifecycle-of-a-problem-statement` → `/playbook/product-problem-framework` and `/blog/transforming-analytics-from-a-support` → `/playbook/product-analyst-mindset`. These go next to the existing renamed-slug rules, so they fire before middleware.

**Favicon (optional)**
- Add `app/favicon.ico` and remove the `/favicon.ico` rewrite in `next.config.ts`.

**Content standard bookkeeping**
- The hub stays at `/blog/tag/*`, which is already in `EXEMPT`, so no `seo-standard.ts` change is needed. If you would rather the hub met the full standard, say so; it is the one place where that would be natural.
- `npm run content:registry`, `npm run content:check`, `npm test`, `npm run build`, and `npm run seo:check` on any in-scope page I touch.

---

## 3. Changes in Ghost, not the repo

`GHOST_ADMIN_API_KEY` is in `.env.local`, so I can apply 3.1 to 3.5 through the Admin API after you approve. 3.6 can only be done by you.

### 3.1 Post titles and meta titles (35 posts)
For each post in the Group C and D tables, and the two Group E posts kept, set **both** `title` (the H1) and `meta_title` to the proposed title. Do not touch slugs. No post has `og_title` or `twitter_title` set, so social cards follow automatically. For the 4 case studies in Group B, set both `title` and `meta_title` to the proposed title in the Group B table, so the H1 matches the `<title>` (rule 1).

### 3.2 Meta descriptions (5 posts)
These are weeks 2, 6, 10 and 13, and D2C part 2. The text is in the tables. Every other description is already good and stays as it is.

### 3.3 In-post links
- 9 links to `cms.joindatalyze.com/<slug>/` → `https://www.joindatalyze.com/blog/<slug>/`. They are in: how-to-create-a-tracking-plan-and, data-tracking-comparing-client-vs, how-to-create-an-analytics-strategy, creating-an-event-tracking-plan-for (2), getting-start-with-mixpanel-the-basics, what-are-events-and-properties-in, and mixpanel-setup-the-right-way (2).
- 3 links to the Substack copies → our own posts:
  - let-go-of-vanity-metrics-and-start and 5-biggest-problems-i-see-with-founders → `/blog/how-to-create-an-analytics-strategy/`.
  - developers-guide-to-implementing → `/blog/what-are-events-and-properties-in/`.
  - Today these send readers, and link equity, to the duplicates.
- 3 links in you-have-data-flowing-everywhere-and-trust-none-of-it to `https://joindatalyze.com/contact?...` (the apex domain) → `https://www.joindatalyze.com/contact?...`.
- New contextual links from Group E: 5-biggest-problems from 3 posts, gamification from 2, and improve-app-retention from 2. The sources are listed in the Group E table. I'd add each as one sentence where the post already discusses the topic, in your voice. I'll show you the exact sentences before applying them.

### 3.4 Week 2 content
Move the Sessions section to the top of the post and expand it with what the post leaves out: where the timeout setting lives, and how to read session duration in Insights. This needs your knowledge of the current Mixpanel UI. I can draft it for you to check.

### 3.5 Tag and post status
- `indian-d2c-playbook` tag description: replace it as proposed in Group D.
- If you approve the Group E removals: unpublish lifecycle-of-a-problem-statement and transforming-analytics-from-a-support, but only after the redirects are deployed.

### 3.6 Substack: only you can do this, and it matters most
Pick one for the 46 posts on mixpanelsimplified.substack.com:
- **(a) Delete or unpublish them on Substack.** This is cleanest: Google drops them within weeks, and the Ghost copies become the only versions.
- **(b) Replace each Substack post's body** with two lines and a link to the joindatalyze.com copy. This keeps the Substack URLs alive for old subscribers and backlinks, but they are thin pages, not duplicates.
- **(c) Leave them.** Then expect most of Group C and Group E to stay "Crawled, not indexed", whatever we change here.

I recommend (a) for the 28 Learning Mixpanel weeks and (b) for anything with known backlinks. The full list of slugs is the 46 imported posts. All except the old week 9 slug match Ghost one-to-one.

---

## 4. Request indexing: top 10, in priority order

Submit these **after Phase 2 is deployed and the Ghost titles are updated**, so Google fetches the new version. Search Console allows about 10 a day per property.

1. https://www.joindatalyze.com/blog/case-study-cred/
2. https://www.joindatalyze.com/services/reporting-and-analysis
3. https://www.joindatalyze.com/services/analytics-setup
4. https://www.joindatalyze.com/blog/tag/learning-mixpanel/ (the new hub, which links all 28 weeks)
5. https://www.joindatalyze.com/services/ai-layer
6. https://www.joindatalyze.com/blog/week-2-learning-mixpanel-mixpanel/ (after the retitle, and after the Substack copy is gone)
7. https://www.joindatalyze.com/tools/event-tracking-plan-generator
8. https://www.joindatalyze.com/blog/d2c-playbook-1-the-data-foundation/
9. https://www.joindatalyze.com/blog/d2c-playbook-4-event-taxonomy-tool-stack-before-you-scale-spend/
10. https://www.joindatalyze.com/ask (after the answer list is added)

Resubmit both sitemaps in Search Console on the same day.

---

## 5. Decisions I need from you

1. **Substack:** (a), (b) or (c) from 3.6.
2. **Learning Mixpanel hub:** upgrade the tag page (my recommendation) or build a separate URL.
3. **Group E:** approve or reject removing lifecycle-of-a-problem-statement and transforming-analytics-from-a-support.
4. **The weak redirect match:** send `/indian-d2c-playbook/questions-your-data-must-answer` to D2C part 1 or to the tag page.
5. **Overlap merges** in section 6, numbers 1 and 2: approve, reject, or leave for the duplicate audit.
6. **/tools:** leave the redirect (my recommendation) or build a real hub.
7. **Ghost:** may I apply 3.1 to 3.3 and 3.5 through the Admin API, or do you want to apply them yourself?

---

## 6. Overlaps found

There is no duplicate audit, so these are flagged rather than acted on.

1. **Insights report:** `/blog/overview-of-the-insights-report/` (640 words, 2024, on Substack too) duplicates `/blog/week-11-learning-mixpanel-insights/` (2,041 words). Suggest a 301 from the old one to week 11, and unpublishing it in Ghost.
2. **Getting started:** `/blog/getting-start-with-mixpanel-the-basics/` (373 words) overlaps week 1 ("What is Mixpanel"). Suggest a 301 to week 1.
3. **Tracking plan cluster, 6 pages:**
   - week 7
   - `/blog/creating-an-event-tracking-plan-for/` (2024)
   - `/blog/how-to-create-a-tracking-plan-and/` (2025)
   - D2C part 4
   - `/playbook/creating-a-tracking-plan`
   - `/ask/what-is-an-event-tracking-plan`

   Plus the generator tool. The two older blog posts are the likeliest to merge into the playbook chapter. The new titles make week 7 (Mixpanel-specific) and D2C part 4 (the D2C event list) distinct. This needs a proper audit.
4. **Analytics strategy:** week 10, `/blog/how-to-create-an-analytics-strategy/`, `/playbook/analytics-strategy` and `/ask/how-to-build-an-analytics-strategy`. This is the most likely reason week 10 is "Crawled, not indexed", together with Substack.
5. **Client vs server tracking:** week 6, `/blog/data-tracking-comparing-client-vs/`, `/resources/client-vs-proxy-vs-server-tracking` and `/ask/client-vs-server-side-tracking`.
6. **Mixpanel setup:** week 8, `/blog/mixpanel-setup-the-right-way/`, `/blog/developers-guide-to-implementing/` and `/ask/how-to-set-up-mixpanel-properly`.
7. **Retention (week 13):** a tool how-to, so a different intent from `/blog/solving-retention-problems-a-strategic/`, `/resources/improve-app-retention` and `/ask/how-to-measure-retention`. Keep it. The new title, "How to Use the Retention Report in Mixpanel", makes the difference explicit.
8. **D2C parts 6 and 7** sit next to `/playbook/incremental-testing` and `/playbook/media-mix-modelling`. These aren't in your list as problems, but if they ever disagree, the playbook wins.

---

## 7. Every page with fewer than 3 internal links pointing to it

Of the 163 sitemap URLs, **no page has fewer than 3 links if listing pages count** (every post appears on at least one paginated listing). Nine posts have exactly 2, both from listing pages. Listing links are weak, so the table below shows every page with **fewer than 3 links from non-listing pages**, sorted by that count. The rotated "Keep reading" block in section 2 lifts every post on this list to at least 3.

| Page | All inlinks | From non-listing pages |
|---|---|---|
| /blog/5-biggest-problems-i-see-with-founders/ | 2 | 0 |
| /blog/developers-guide-to-implementing/ | 2 | 0 |
| /blog/gamification-is-a-multiplier-but-multiply-by-zero-and-you-get-nothing/ | 2 | 0 |
| /blog/getting-start-with-mixpanel-the-basics/ | 2 | 0 |
| /blog/lifecycle-of-a-problem-statement/ | 2 | 0 |
| /blog/overview-of-the-insights-report/ | 2 | 0 |
| /blog/the-mindset-for-solving-complex-problem/ | 2 | 0 |
| /blog/three-levers-to-optimize-product/ | 2 | 0 |
| /blog/transforming-analytics-from-a-support/ | 2 | 0 |
| /blog/d2c-playbook-1-the-data-foundation/ | 3 | 0 |
| /blog/creating-an-event-tracking-plan-for/ | 3 | 1 |
| /blog/data-tracking-comparing-client-vs/ | 3 | 1 |
| /blog/finding-the-aha-moment-for-your-product/ | 3 | 1 |
| /blog/how-to-set-up-product-analytics-the-right-way/ | 3 | 1 |
| /blog/my-love-hate-relationship-with-posthog-and-why-i-keep-recommending-it-anyway/ | 3 | 1 |
| /blog/you-have-data-flowing-everywhere-and-trust-none-of-it/ | 3 | 1 |
| /blog/case-study-answering-agent/ | 4 | 1 |
| /blog/case-study-foriio/ | 4 | 1 |
| /blog/case-study-petcademy/ | 4 | 1 |
| /blog/case-study-sama/ | 4 | 1 |
| /blog/d2c-playbook-3-why-your-conversions-look-too-good/ | 4 | 1 |
| /blog/70-of-your-branded-search-conversions-would-have-happened-anyway/ | 4 | 2 |
| /blog/connecting-marketing-and-product-data/ | 4 | 2 |
| /blog/how-to-create-an-analytics-strategy/ | 4 | 2 |
| /blog/case-study-gametree/ | 5 | 2 |
| /blog/case-study-speedyloans/ | 5 | 2 |
| /blog/d2c-playbook-2-putting-all-your-data-in-one-place/ | 5 | 2 |
| /blog/week-10-learning-mixpanel-creating/ | 5 | 2 |
| /blog/week-12-learning-mixpanel-mastering/ | 5 | 2 |
| /blog/week-14-learning-mixpanel-frequency/ | 5 | 2 |
| /blog/week-15-learning-mixpanel-mastering/ | 5 | 2 |
| /blog/week-16-learning-mixpanel-dashboards/ | 5 | 2 |
| /blog/week-17-learning-mixpanel-advanced/ | 5 | 2 |
| /blog/week-19-learning-mixpanel-alerts/ | 5 | 2 |
| /blog/week-20-learning-mixpanel-sending/ | 5 | 2 |
| /blog/week-21-learning-mixpanel-group-analytics/ | 5 | 2 |
| /blog/week-23-learning-mixpanel-borrowed/ | 5 | 2 |
| /blog/week-24-learning-mixpanel-custom/ | 5 | 2 |
| /blog/week-5-learning-mixpanel-user-profiles/ | 5 | 2 |
| /blog/week-6-learning-mixpanel-choosing/ | 5 | 2 |
| /blog/week-7-learning-mixpanel-creating/ | 5 | 2 |
| /blog/week-8-learning-mixpanel-setting/ | 5 | 2 |
| /blog/week-9-learning-mixpanel-checking-data-flow/ | 5 | 2 |

Every service, industry, tool, /ask, /about, /contact, /faqs, /resources and playbook page has 28 or more inlinks, from the header, the footer or the playbook sidebar. The `/ask/<slug>` answer pages have 4 or 5 each, which is low; the /ask hub list fixes that.
