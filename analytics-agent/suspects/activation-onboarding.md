---
id: activation-onboarding
name: Usual suspects for activation, onboarding and signup funnel drops
topic: signup, onboarding, activation, trial to paid, a funnel step
problems: [D2, D3, D4, D6]
status: approved
---

# Usual suspects: activation, onboarding or a signup step dropped

Check in this order.

1. **An event in the funnel stopped firing or started firing twice.** Check daily volume of every step's event, and events per user, around the date. A sudden halving from one date can be tracking or a real break (a release that broke a step); check the events fire correctly before deciding which.
2. **The funnel's denominator changed.** Returning users who reinstall, logged-in users hitting the signup page, bots or test accounts now counted as new users. Check who is entering step one.
3. **Identity breaks between steps.** The user gets a new ID between signup and onboarding (web to app, marketing site to app domain, client to server event), so the funnel can't connect the steps and conversion looks low. Check a handful of users end to end.
4. **The traffic mix changed.** A new campaign, channel or country with lower intent, or a shift between mobile and desktop. Each segment converts the same as before; there are just more of the low-converting one. Run rate vs mix by source and platform.
5. **A release changed the flow on one platform.** Check conversion by platform and app version. A drop on one app version is a release bug.
6. **A step got harder.** A new required field, an eligibility question, a permission prompt, an email verification, a paywall moved earlier. Look at the step-by-step funnel for the step where the drop starts, then watch replays there.
7. **The core action is failing.** Uploads, payments, integrations or imports erroring out, so users try and fail. Check the core action's success and failure rate and failure reasons.
8. **Users don't understand the product.** Short first sessions, users who leave right after signup or land on the activation page and do nothing. This is the "why" question: watch replays and talk to users.

## For trial or free to paid specifically

- **The paywall moved or the price changed.** Check paywall views per user and the date of pricing changes.
- **Users aren't hitting the limit that makes them upgrade.** If upgrades come from running out of credits or seats, check how many users reach the limit at all.
- **Payment is failing, not intent.** Split checkout started into completed and failed, with failure reasons, by payment provider and method.

## Knowledge
- "A framework for any product problem", "Every product is a funnel", "Rate and mix analysis", "Event verification", "Qual plus quant analysis", "Identity stitching", "Metric definitions" (the 5% that was really 12%), "How to hire a product analyst" (the VideoTap activation example).
- Blog: "Finding the AHA moment for your product".

## If a step is low rather than dropping

There is no "before", so compare segments instead, and agree with the user what "low" is measured against (their best segment, a target, last year). Check the first three before reading it as user behaviour.

1. **The denominator is wrong.** Returning users, bots, test accounts or logged-in users counted as entering the step.
2. **Identity breaks between steps,** so finishers aren't joined to starters (item 3 above).
3. **The step is defined too strictly or the window is too short** for how long the step really takes. Try a longer window and a looser event.
4. **Some users never intended to finish.** Browsers, competitors, students, one-off users. Split by source and onboarding answers.
5. **The step is hard, failing or unclear** (items 6 to 8 above). Find the segment that converts best and compare what it did differently (`modules/funnel-deep-dive`).
