# Routing test report

Run 2026-10-20 04:04 UTC on 392 questions. AI model: claude-haiku-5-5.

| Check | Result | Target |
|---|---|---|
| Workflow, AI choosing (expected or acceptable) | 92% (361/392) | 90% |
| Workflow, AI choosing (exactly the expected one) | 57% (222/392) | |
| Workflow, server choosing | 61% (239/392) | |
| Suspects topic, where one is expected | 83% (59/71) | 90% |
| Topic "none", where none is expected | 59% (188/321) | |
| Knowledge in start_task's top 3 | 92% (332/362) | 80% |
| Knowledge in search_knowledge's top 8 | 96% (346/362) | |
| Server flags that would fix a wrong AI pick | 2 | |
| Server flags on a right AI pick (noise) | 29 | |

## By expected workflow

| Workflow | Questions | AI | Server | Knowledge top 3 |
|---|---|---|---|---|
| answer-question | 149 | 97% (144/149) | 42% (63/149) | 96% (128/133) |
| plan | 60 | 95% (57/60) | 57% (34/60) | 83% (44/53) |
| audit | 57 | 84% (48/57) | 70% (40/57) | 88% (44/50) |
| explain-change | 49 | 88% (43/49) | 82% (40/49) | 96% (47/49) |
| reconcile-numbers | 31 | 90% (28/31) | 90% (28/31) | 100% (31/31) |
| judge-result | 25 | 88% (22/25) | 64% (16/25) | 88% (22/25) |
| find-opportunities | 13 | 85% (11/13) | 85% (11/13) | 92% (12/13) |
| pull-number | 8 | 100% (8/8) | 88% (7/8) | 50% (4/8) |

## Workflow misses (AI)

| Problem | Question | Expected | AI picked | Server picked |
|---|---|---|---|---|
| D1 | Why didn't streaks and badges fix my retention problem? | explain-change | judge-result | explain-change |
| D2 | Why would users who pick one option in onboarding activate at twice the rate of others? | explain-change | answer-question | judge-result |
| D2 | Do users understand the product quickly after opening the app? | explain-change | answer-question | answer-question |
| D4 | Do users upgrade when they run low on credits? | find-opportunities | answer-question | find-opportunities |
| D4 | What should we learn from cohort conversion by channel, month and time to pay? | find-opportunities | answer-question | pull-number |
| D6 | A number looks wrong. Is it the data, or did something really break? | explain-change | pull-number | explain-change |
| D6 | My signup rate shows 1%. How do I know if that number is even right? | explain-change | pull-number | reconcile-numbers |
| D7 | How do I split a drop into 'rate changed' versus 'mix changed'? | explain-change | answer-question | explain-change |
| D11 | Are users coming back to drafts they abandoned? | judge-result | explain-change | find-opportunities |
| M5 | What is our refund rate by country, and how did it change after a pricing change? | plan | judge-result | pull-number |
| M6 | What do our users actually spend their credits on? | plan | pull-number | answer-question |
| M6 | 28% of metered usage has no price. Are those products free on purpose, or was a price never set? | plan | audit | find-opportunities |
| F2 | About 350 users a month have payment events but no signup event. Why? | reconcile-numbers | explain-change | reconcile-numbers |
| F4 | The cancel-subscription event is 0 for several days. Is no one cancelling, or is it broken? | audit | explain-change | audit |
| F4 | After the website relaunch, no events are firing at all. What broke? | audit | explain-change | audit |
| F4 | Onboarding completed is 75% lower than onboarding started, but every step between converts near 100%. Which event is wrong? | audit | reconcile-numbers | explain-change |
| F4 | This chart stopped updating after one date even though we have new signups. Why? | audit | explain-change | explain-change |
| F5 | One conversion recorded a value of 381 million. Where did it come from? | audit | pull-number | reconcile-numbers |
| F6 | The IP filter we added is now blocking most of our real traffic. What went wrong? | audit | explain-change | explain-change |
| F6 | Is our app-open-to-onboarding drop caused by reinstalls or automated tests? | audit | explain-change | judge-result |
| F6 | How many genuine signups did we get, excluding internal, personal email and existing customers? | audit | pull-number | pull-number |
| F8 | Why do nearly all my sessions show as Direct? | audit | explain-change | audit |
| F9 | Some dashboard outputs don't look right. Are we aligned on metric definitions? | reconcile-numbers | audit | reconcile-numbers |
| F12 | Error tracking logged nothing since one date while traffic is normal. Did capture break? | answer-question | explain-change | explain-change |
| F13 | Has anything changed in how we identify successful payments in the warehouse? | answer-question | explain-change | explain-change |
| F14 | We've reported 0 purchases in GA4 since a certain date. What happened? | reconcile-numbers | explain-change | explain-change |
| S1 | Our marketing site has several analytics and recording tools. Do we need all of them? | answer-question | audit | reconcile-numbers |
| S11 | My CRM-to-product join returns almost nothing. Is my SQL wrong? | answer-question | reconcile-numbers | reconcile-numbers |
| X1 | Which marketing channels bring good users versus bad ones? | judge-result | find-opportunities | pull-number |
| X1 | Are we too reliant on one acquisition channel? | judge-result | find-opportunities | judge-result |
| X2 | Why is my reported ROAS 4x but my incremental ROAS only 1.7x? | answer-question | reconcile-numbers | reconcile-numbers |

## Topic misses

| Problem | Question | Expected topic | AI picked |
|---|---|---|---|
| D3 | How do I find the biggest drop-off in my product? | activation-onboarding | none |
| D3 | Spend went up but performance dipped. Where exactly in the lead-to-customer funnel is the drop? | activation-onboarding | attribution |
| D4 | How do free and paid users behave differently? | activation-onboarding | payments-revenue |
| D4 | Do users upgrade when they run low on credits? | activation-onboarding | payments-revenue |
| D4 | What should we learn from cohort conversion by channel, month and time to pay? | activation-onboarding | payments-revenue |
| D5 | After someone pays, do they actually use the product? | retention | activation-onboarding |
| D6 | A number looks wrong. Is it the data, or did something really break? | activation-onboarding | none |
| D6 | I saw a metric drop. How do I figure out why before pinging my data person? | activation-onboarding | none |
| D6 | Our paid conversion went to zero for several weeks. Is it real or broken tracking? | activation-onboarding | attribution |
| D6 | Bounce rate dropped to a suspiciously low level. Is that real? | activation-onboarding | none |
| D6 | Paid traffic dropped sharply but we didn't change anything. Is this a tracking problem? | activation-onboarding | attribution |
| D6 | We got an alert about a spike in events and in account deletions. What happened? | activation-onboarding | none |
| D7 | Our signup conversion is falling. Is it a product problem or a change in traffic mix? | none | activation-onboarding |
| D7 | Why did my churn rate drop right after a spike in new paying users? | none | retention |
| D7 | Our payment success rate fell. Was it one provider or the routing shift? | none | payments-revenue |
| D9 | How do I use session replays to find why users abandon a step? | none | activation-onboarding |
| D10 | How do I find the aha moment for my product? | none | activation-onboarding |
| D10 | Which feature do returning users use more than churned users? | none | retention |
| D10 | I have 50 user attributes. How do I find which combinations predict purchase? | none | payments-revenue |
| D10 | How do I validate an aha moment hypothesis with user interviews? | none | activation-onboarding |
| D11 | For a new streak feature: how many streaks start, how long do they last, and is there a magic number? | none | retention |
| D11 | Are users coming back to drafts they abandoned? | none | retention |
| D11 | Does showing a preview before generating improve conversion? | none | activation-onboarding |
| D11 | Did our renewal reminders bring users back? | none | retention |
| M1 | What is a metric tree and how do I build one for revenue? | none | payments-revenue |
| M1 | What's a good counter-metric for revenue? | none | payments-revenue |
| M2 | What is stickiness (DAU/WAU, WAU/MAU) and which one should I use? | none | retention |
| M3 | What should our activation metric be? | none | activation-onboarding |
| M3 | How do I define 'tried it' versus 'got value' versus 'engaged' for each feature? | none | activation-onboarding |
| M3 | Some accounts can't use the main feature yet. Should activation start later? Should PLG and enterprise differ? | none | activation-onboarding |
| M3 | Does activation count old signups who come back and do the core action? | none | activation-onboarding |
| M3 | Can you list activation events for every product we sell? | none | activation-onboarding |
| M4 | How do I measure retention properly? | none | retention |
| M4 | What's the difference between bounded and unbounded retention? | none | retention |
| M4 | Should our retention window be D30 or D90? | none | retention |
| M4 | What retention rate is good for a consumer app? | none | retention |
| M4 | Why should behavioural retention cohorts be time-boxed ('did X within 7 days')? | none | retention |
| M4 | Our backend retention numbers are very different from the analytics tool. Which is right? | none | retention |
| M4 | Can we build retention on recurring payments, like paying users retained per month? | none | retention |
| M4 | How does weighted average retention work? | none | retention |
| M5 | I need the real LTV, not an ARPU-like number. How do I calculate true LTV by plan and market? | none | payments-revenue |
| M5 | Should LTV be split by price point when one user pays different prices in different months? | none | payments-revenue |
| M5 | What is our refund rate by country, and how did it change after a pricing change? | none | payments-revenue |
| M5 | Does the paid amount include the discount or not? | none | payments-revenue |
| M5 | Should revenue be reported in local currency or USD? | none | payments-revenue |
| M5 | Is our usage cost before or after tax, and is the amount in the smallest currency unit? | none | payments-revenue |
| M5 | 74% of our paying users never used the product in week one. How do I measure value per subscriber? | none | activation-onboarding |
| M6 | How do AI startups track usage, credits and usage-based billing? | none | payments-revenue |
| M6 | Credits are bought at the org level. How do we attribute revenue to individual users? | none | payments-revenue |
| M6 | What do our users actually spend their credits on? | none | payments-revenue |
| M6 | How do I track a credit purchase funnel and credit exhaustion? | none | payments-revenue |
| M6 | 28% of metered usage has no price. Are those products free on purpose, or was a price never set? | none | payments-revenue |
| M7 | How do I build an account health score to catch churn early? | none | retention |
| M7 | How do I analyse trial-to-paid conversion at the account level? | none | activation-onboarding |
| M8 | What's our D30 retention for users who signed up in August? | none | retention |
| M8 | How many paid users did we have last month? | none | payments-revenue |
| M8 | What's our signup to activation rate for the last 7 days? | none | activation-onboarding |
| M8 | How many trials started last week, and how many converted to paid? | none | activation-onboarding |
| M8 | What's our average revenue per paying user this month? | none | payments-revenue |
| M8 | What share of last month's signups came from paid channels? | none | attribution |
| M8 | How many users completed onboarding yesterday? | none | activation-onboarding |
| F1 | Why are my analytics signups lower than my database signups? | none | activation-onboarding |
| F1 | The analytics tool is missing about 15% of payments vs the database. How much is tax and timezone? | none | payments-revenue |
| F1 | Why do analytics paying users and subscription tool subscribers not match? | none | payments-revenue |
| F1 | The ads platform reports 2,200 signups but analytics shows 1,266 for the same day. Which is right? | none | attribution |
| F1 | Funnel numbers don't match the CRM deal and lead counts. How do we reconcile them? | none | activation-onboarding |
| F1 | Why does pageview-by-channel not match GA4 and Google Ads clicks? | none | attribution |
| F1 | Organic search traffic doesn't match Search Console. Why? | none | attribution |
| F1 | Why is GA4 showing fewer users than Mixpanel? | none | attribution |
| F2 | Users show up twice when they move from our marketing site to the app. Why? | none | attribution |
| F2 | About 350 users a month have payment events but no signup event. Why? | none | activation-onboarding |
| F3 | Our signup event fires multiple times on one submit. How do we measure real signups? | none | activation-onboarding |
| F3 | Why does the login event fire on every app open, and not when someone signs up? | none | activation-onboarding |
| F3 | Why are we getting duplicate install events from our attribution SDK? | none | attribution |
| F4 | The cancel-subscription event is 0 for several days. Is no one cancelling, or is it broken? | none | retention |
| F4 | Our step events fire when a step is left, not opened, so the last step never counts. When should screen events fire? | none | activation-onboarding |
| F4 | Onboarding completed is 75% lower than onboarding started, but every step between converts near 100%. Which event is wrong? | none | activation-onboarding |
| F4 | This chart stopped updating after one date even though we have new signups. Why? | none | activation-onboarding |
| F4 | Signup isn't firing for SSO users. Is login firing instead? | none | activation-onboarding |
| F5 | We see a lot of 'not set' for signup UTM and device. How do we fix it? | none | attribution |
| F5 | The same plan shows up as 'annual' and 'yearly'. How do inconsistent values break analysis? | none | payments-revenue |
| F5 | One conversion recorded a value of 381 million. Where did it come from? | none | payments-revenue |
| F6 | How do we filter out spam or bot referral traffic? | none | attribution |
| F6 | Invited users fire signup and inflate our organic signups. How do we separate them? | none | attribution |
| F6 | Is our app-open-to-onboarding drop caused by reinstalls or automated tests? | none | activation-onboarding |
| F6 | How many genuine signups did we get, excluding internal, personal email and existing customers? | none | activation-onboarding |
| F7 | How much data do ad blockers make me lose? | none | attribution |
| F7 | How do I recover events lost to ad blockers and Safari cookie limits? | none | attribution |
| F9 | Three people gave me three different signup rates. Which one is right? | none | activation-onboarding |
| F12 | How do I set funnel alerts that don't fire every other day on small steps? | none | activation-onboarding |
| F13 | Why do last month's signup numbers change every time I look? | none | activation-onboarding |
| F13 | Has anything changed in how we identify successful payments in the warehouse? | none | payments-revenue |
| F14 | Why don't my GA4 order numbers match Shopify? 10 to 20% of orders are missing. | none | payments-revenue |
| F14 | Why is only some of my revenue showing in GA4? | none | payments-revenue |
| F14 | We've reported 0 purchases in GA4 since a certain date. What happened? | none | payments-revenue |
| F14 | Transaction ID isn't showing in GA4. Why? | none | payments-revenue |
| F14 | Is my Google Ads conversion tracking broken? | none | attribution |
| F14 | GA4 monetization totals don't match ecommerce purchase totals. Why? | none | payments-revenue |
| S1 | Our marketing site has several analytics and recording tools. Do we need all of them? | none | attribution |
| S3 | What events should every D2C store track from product view to order? | none | payments-revenue |
| S4 | Should the subscribe event fire on trial start or when someone actually pays? | none | payments-revenue |
| S5 | How do I keep one identity across my marketing site and app subdomain? | none | attribution |
| S5 | Can we use GA4 cross-domain tracking instead of custom user ID stitching? | none | attribution |
| S6 | 19% of paying users have no payment event. Should we send it from the server? | none | payments-revenue |
| S6 | Does server-side tracking break attribution? | none | attribution |
| S8 | What should utm_campaign contain: campaign name or campaign ID? | none | attribution |
| S8 | What naming convention should we use for UTMs? | none | attribution |
| S8 | How do I capture UTMs, gclid and fbclid at signup and save them on the user profile? | none | attribution |
| S8 | How do I tag ads so analytics, GA4 and the CRM agree on where a user came from? | none | attribution |
| S8 | Should Google Ads URLs carry UTMs at all when auto-tagging is on? | none | attribution |
| S8 | Are we passing UTMs through hidden form fields into the CRM? | none | attribution |
| S8 | How should we tag bio links, DMs, QR codes and emails? | none | attribution |
| S8 | Offline conversion imports fail for long sales cycles. Is it click ID expiry? | none | attribution |
| S9 | Do I need an MMP, or are UTMs enough? | none | attribution |
| S9 | Why can't I see which campaign brought a user who installed my app? | none | attribution |
| S9 | Does the App Store or Play Store pass UTMs to my app? | none | attribution |
| S9 | How do I send AppsFlyer or Branch install source into Mixpanel? | none | attribution |
| S9 | How do I measure installs by influencer? | none | attribution |
| S11 | What's the join key between marketing and product data? | none | attribution |
| S11 | How do I send ad spend into analytics without breaking my funnels? | none | attribution |
| S12 | How do I track KYC drop-off without sending PII to my analytics tool? | none | activation-onboarding |
| S12 | How can we do email attribution without sending PII into PostHog? | none | attribution |
| S13 | Can you build a basic signup dashboard from what we track now? This is urgent. | none | activation-onboarding |
| S14 | Why does AI give me a different activation rate every time I ask? | none | activation-onboarding |
| S15 | What data do Blinkit, Zepto and Swiggy Instamart actually give a D2C brand? | none | attribution |
| S15 | Why don't quick commerce numbers match my backend? | none | payments-revenue |
| S15 | How do I normalise gross vs net revenue across channels? | none | payments-revenue |
| S16 | My signup event fires from 10 places. Do I need to check all of them? | none | activation-onboarding |
| S16 | How do I check that every funnel step has fewer users than the step before? | none | activation-onboarding |
| X2 | What's the difference between attribution and incrementality? | none | attribution |
| X2 | Is my branded search spend actually bringing new customers? | none | attribution |
| X2 | How do I run a geo holdout test for my ads? | none | attribution |
| X2 | Why is my reported ROAS 4x but my incremental ROAS only 1.7x? | none | attribution |
| X2 | How do I measure influencer or offline campaigns? | none | attribution |
| X2 | Should we run a $5k paid marketing test? What should it answer first? | none | attribution |
| X3 | What is marketing mix modelling? | none | attribution |
| X3 | How much data do I need for MMM? | none | attribution |
| X3 | When should I use MMM instead of incrementality testing? | none | attribution |
| X3 | Why does my MMM give weird results when all my channels move together? | none | attribution |
| X3 | What are adstock and saturation? | none | attribution |
| X4 | How do we test a new onboarding flow without mixing it into old analytics? | none | activation-onboarding |
| X4 | How do I turn a retention finding into an experiment and re-baseline? | none | retention |
| X4 | How do I monitor experiments and on-page changes for SEO? | none | attribution |
| X5 | I put more money into a channel and revenue went up. Did the channel cause it? | none | attribution |
| X6 | Our analyst reconciles revenue perfectly but can't tell me where users drop off. Why? | none | activation-onboarding |

## Knowledge misses (start_task top 3)

| Problem | Question | Got |
|---|---|---|
| D2 | Why did signup-to-activation conversion suddenly drop? | metric-definitions, reading-data, rate-and-mix-analysis |
| D3 | Should returning users who reinstall be excluded from the new-user onboarding funnel? | experimentation, product-analyst-mindset, analytics-strategy |
| D4 | What should we learn from cohort conversion by channel, month and time to pay? | connecting-marketing-and-product-data, north-star-metric, the-click-is-the-only-thing-your-ad-platform-can-see |
| D9 | Dead clicks are mostly scrolls. How do I find the buttons that are actually broken? | event-verification, product-funnel, event-verification |
| D11 | Are users coming back to drafts they abandoned? | product-analyst-mindset, case-study-sama, solving-retention-problems-a-strategic |
| D11 | Did our renewal reminders bring users back? | case-study-foriio, product-analyst-mindset, week-14-learning-mixpanel-frequency |
| D11 | Can we see notification sends, timing, read rate and click rate? | reading-data, case-study-foriio, week-14-learning-mixpanel-frequency |
| M1 | What data questions will investors ask us at seed? | d2c-playbook-4-event-taxonomy-tool-stack-before-you-scale-spend, reading-data, reading-data |
| M2 | What share of our base are power users? | gamification-is-a-multiplier-but-multiply-by-zero-and-you-get-nothing, reading-data, media-mix-modelling |
| M3 | How do I set the right engaged-user threshold for each feature? | creating-a-tracking-plan, product-analytics-by-stage, product-funnel |
| M3 | Does activation count old signups who come back and do the core action? | identity-stitching, how-to-set-up-product-analytics-the-right-way, product-problem-framework |
| M5 | Should revenue be reported in local currency or USD? | d2c-playbook-5-how-to-actually-stitch-website-blinkit-and-swiggy-data, what-is-product-analytics, what-is-product-analytics |
| M5 | Is our usage cost before or after tax, and is the amount in the smallest currency unit? | unifying-data, d2c-playbook-5-how-to-actually-stitch-website-blinkit-and-swiggy-data, d2c-playbook-4-event-taxonomy-tool-stack-before-you-scale-spend |
| M5 | How do I write SQL for KPIs like net flows, CAC and conversion rate? | unifying-data, analytics-strategy, data-modelling |
| M7 | We want group-level insights broken down by user properties. Is there a workaround? | week-11-learning-mixpanel-insights, week-15-learning-mixpanel-mastering, week-25-learning-mixpanel-warehouse |
| M7 | How do we capture which partner organization a user is linked to? | mmp-and-utm-tracking, mmp-and-utm-tracking, identity-stitching |
| M8 | What's our D30 retention for users who signed up in August? | analytics-strategy, week-13-learning-mixpanel-retention, week-13-learning-mixpanel-retention |
| M8 | How many trials started last week, and how many converted to paid? | rate-and-mix-analysis, rate-and-mix-analysis, how-to-set-up-product-analytics-the-right-way |
| M8 | What share of last month's signups came from paid channels? | analytics-strategy, media-mix-modelling, analytics-strategy |
| M8 | How many users completed onboarding yesterday? | product-analytics-by-stage, product-analytics-by-stage, product-funnel |
| F3 | How do I stop duplicate events when our server retries a request? | data-loss, identity-stitching, identity-stitching |
| F3 | Why are we getting duplicate install events from our attribution SDK? | mmp-and-utm-tracking, mmp-and-utm-tracking, d2c-playbook-1-the-data-foundation |
| F5 | The same plan shows up as 'annual' and 'yearly'. How do inconsistent values break analysis? | analytics-and-ai, metric-definitions, analytics-and-ai |
| F5 | Our 'is first time' flags reset each session. How do we measure first-ever actions? | week-11-learning-mixpanel-insights, week-12-learning-mixpanel-mastering, segment-analysis |
| F5 | One conversion recorded a value of 381 million. Where did it come from? | d2c-playbook-3-why-your-conversions-look-too-good, d2c-playbook-3-why-your-conversions-look-too-good, d2c-playbook-6-incrementality-testing |
| S2 | How do we migrate from GA4 or Amplitude to Mixpanel without losing history or identity? | identity-stitching, data-loss, identity-stitching |
| S8 | What naming convention should we use for UTMs? | creating-a-tracking-plan, the-click-is-the-only-thing-your-ad-platform-can-see, creating-a-tracking-plan |
| S8 | Offline conversion imports fail for long sales cycles. Is it click ID expiry? | d2c-playbook-3-why-your-conversions-look-too-good, incremental-testing, event-verification |
| S16 | How do I check that every funnel step has fewer users than the step before? | product-funnel, analytics-debt-the-silent-killer-nobody-talks-about-until-series-b, product-funnel |
| X4 | How can I tell which user is in which arm of the experiment? | what-is-product-analytics, qual-plus-quant-analysis, unifying-data |
