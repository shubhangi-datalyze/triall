---
id: attribution
name: Usual suspects for attribution, UTM and channel problems
topic: traffic sources, UTMs, channel performance, ad platform numbers
problems: [F8, X1]
status: approved
---

# Usual suspects: channel numbers look wrong, or a channel's performance changed

Check in this order.

1. **UTMs are missing or inconsistent.** Links without UTMs, mixed case (`Facebook`, `facebook`, `fb`), typed campaign names that don't join to the ad platform. `utm_campaign` should carry the campaign ID through the platform's macro (`{campaignid}` in Google, `{{campaign.id}}` in Meta), not a name. Look at the share of signups with no source over time, and list distinct source values.
2. **The source is captured on the session, not the user.** If the first-touch source isn't stored on the user profile, a user who returns later direct shows up as direct. Check where the source property lives.
3. **Identity breaks across domains or devices.** The marketing site and the app don't share identity, or the user saw the ad on their phone and bought on their laptop. The sale lands under direct. Check cross-domain identity (`suspects/activation-onboarding` step 3).
4. **The app install breaks the chain.** UTMs don't survive an app store install. Without an MMP, app users from paid campaigns show up as organic. Running UTMs on web and an MMP on the app gives two systems whose numbers never quite agree; if there's an MMP, use it for every link.
5. **Core events moved server side and lost their source.** Server-side events don't get UTMs, country or device automatically. If the source went missing from the date sign-ups moved to the backend, that's why.
6. **The ad platform is counting differently.** Meta's default 7-day click and 1-day view counts conversions your product never connects to the ad. Google and Meta both claim the same order. Platform totals added together will exceed your backend. Don't reconcile them to match; use your own attribution as the source of truth and take only spend from the platforms.
7. **Ad blockers and consent hide the source.** Client-side tracking loses 15 to 20% of web events to ad blockers, more with technical audiences, so sources go missing unevenly.
8. **The channel intercepts demand rather than creating it.** Branded search and retargeting look great because those users were coming anyway. Only an incrementality test (matched market holdout) separates the two.
9. **The channel converts but doesn't retain.** Cheap signups that never activate or pay. Judge channels on activated users and revenue at months 1 to 3, not cost per signup.

## Knowledge
- "MMP vs UTM tracking", "Incremental testing", "Media mix modelling", "Unifying data", "Analytics data loss", "Identity stitching".
- Blog: "Your Cheapest Channel Is Probably Your Worst" (note: it says campaign names must match the ad platform; the playbook's unifying-data chapter says use the campaign ID, and the playbook wins), "D2C Playbook 3: Why your conversions look too good", "70% of Your Branded Search Conversions Would Have Happened Anyway", "Connecting marketing and product data".
