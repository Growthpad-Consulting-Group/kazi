# Slack Engagement Roadmap

> **Goal:** Keep Growthpad staff and managers engaged with Kazi while Slack remains the notification surface—not the system of record. Every message must have a clear next action or a genuine reason to celebrate.
>
> **Current baseline (November 2026):** Kazi can DM managers when a weekly check-in is submitted, DM both 1-on-1 participants, and post completed goals to one configured company channel. `src/lib/slack.ts` uses a bot token for DMs and an incoming webhook for the company channel.

## Operating principles

- **DMs are for personal action.** Use a channel only for announcements, recognition and opt-in culture updates.
- **No duplicate prompts.** Once an action is completed, the associated reminder must stop.
- **Respect working time.** Default delivery follows each staff member's stored location/timezone and quiet-hours preference; never assume Nairobi time for everyone.
- **Kazi holds the detail.** Messages contain a concise summary, one primary deep link, and no more sensitive data than needed to act.
- **Protect sensitive information.** Never post low mood, blockers, Voice Out, PIPs, private feedback, compensation, candidate CV data, or performance details in a public channel.
- **Make delivery observable.** Every attempt needs an auditable delivery record, idempotency key and failure reason. Slack delivery must never block the main Kazi action.

## P0 — Notification foundation and high-value actions

- [x] **1. Build a Slack delivery model.**
  - Create migrations for `slack_member_links` (Kazi user ID, Slack member ID, last verified) and `slack_notification_deliveries` (event key, recipient, category, destination, status, Slack timestamp, error, delivered_at).
  - Resolve Slack members from work email once and cache the ID; do not call `users.lookupByEmail` for every message.
  - Add a shared `deliverSlackNotification()` service with idempotency, retry-safe status writes and structured Block Kit payloads.
  - Acceptance: a repeated event key results in one Slack message; an unavailable Slack user is recorded and does not fail Kazi.

- [x] **2. Add staff Slack preferences and quiet hours.**
  - Extend notification settings with Slack enabled/disabled, instant versus digest delivery, enabled categories and local quiet hours.
  - Determine time zone from staff profile/location with an explicit editable override; fall back to Africa/Nairobi only when unknown.
  - Acceptance: users can opt out of non-critical Slack messages, and scheduled jobs defer messages outside quiet hours.

- [x] **3. Add manager-action DMs.**
  - Notify the direct manager for a submitted weekly check-in, with a stronger callout only where blockers or low mood are present.
  - Notify the appropriate approver for overtime/TOIL requests, reward redemptions and side-quest evidence awaiting review.
  - Include “Review in Kazi” links; do not include private narrative content in the Slack preview.
  - Acceptance: one DM per action, routed to the real manager/approver, with no public-channel fallback.

- [x] **4. Add recruiting and interview DMs.**
  - Notify the hiring owner/recruiter when a new application arrives and when AI screening completes or flags an exception.
  - Remind assigned interviewers about upcoming interviews and overdue scorecards.
  - Acceptance: recruiting messages contain candidate name, role and Kazi link only—never CV text or AI rationale.

- [x] **5. Add scheduled 1-on-1 reminders.** *(Both participants get one reminder about 90 minutes before a meeting, unless a calendar invitation already covers the meeting. The manager gets one follow-up when notes and actions are still empty an hour or more after it.)*
  - Send participants a configurable reminder before the meeting and a follow-up if notes/actions are still incomplete after it.
  - Deduplicate against calendar invitations; Slack is a reminder, not a second calendar system.
  - Acceptance: both participants get exactly one reminder in their local time.

## P1 — Helpful daily rhythm and conversations

- [x] **6. Create timezone-aware digest workers.**
  - Add authenticated scheduled routes and GitHub Actions/Vercel cron configuration for daily and weekly deliveries.
  - Use `slack_notification_deliveries` event keys to prevent retries or reruns from duplicating messages.
  - Acceptance: workers can be run manually, are safe to rerun, and report counts without exposing message content in logs.

- [x] **7. Send a personal daily Kazi brief.** *(opt-in toggle in Settings → Notifications; covers today's 1-on-1s, goals due within three days, Asana due-today and overdue counts, daily-log status and check-in status. Interview reminders are sent as their own DMs under item 4, so they are not repeated in the brief.)*
  - At each employee's chosen workday start, send an optional DM with today’s 1-on-1s/interviews, active goals, due work and daily-log status.
  - Suppress it when there is nothing actionable.
  - Acceptance: one compact message with one “Open today in Kazi” link; no empty digests.

- [x] **8. Add check-in and manager cadence reminders.**
  - Friday: gently prompt only staff who have not submitted their weekly reflection.
  - Monday morning: send managers an actionable team pulse—missing check-ins, new blockers, pending review—without exposing sensitive details.
  - Friday afternoon: send managers a concise review queue.
  - Acceptance: reminders stop as soon as the check-in/review is complete.

- [x] **8a. Add long-running timer guardrails.**
  - Send the timer owner a private Slack check-in after eight hours and a stronger reminder at twenty hours, keyed per timer and respecting Slack preferences/quiet hours.
  - Acceptance: an accidentally running timer can be stopped before it blocks the daily log; no timer details reach a public channel.

- [x] **9. Add Kazi mentions and threaded conversation alerts.** *(`@Name` mentions in 1-on-1 notes, goal descriptions, public recognition and review text notify only the authorised people involved, with generic wording and no source text. Mentions attach to these existing text fields rather than new comment threads.)*
  - Introduce `@name` mentions in supported Kazi notes/comments (1-on-1s, goals, feedback and review collaboration where appropriate).
  - Parse only valid active staff mentions, create an in-app notification and DM the mentioned person with a direct deep link.
  - Preserve the comment thread in Kazi; Slack replies are not treated as Kazi records in this phase.
  - Acceptance: mention sends one private alert and does not notify the author or duplicate names.

- [x] **10. Add survey and feedback lifecycle reminders.** *(Survey launch and closing DMs go only to staff who have not responded. Released review results that are not yet acknowledged get a reminder on Monday and Thursday mornings. HR gets a Voice Out alert with no reporter, topic or message.)*
  - DM eligible staff when a survey launches and before it closes, only if they have not responded.
  - Notify HR privately when Voice Out or feedback needs a response; never identify an anonymous reporter.
  - Acceptance: anonymous Voice Out stays anonymous end-to-end.

## P1.5 — Asana signals without duplicate notification noise

> **System boundaries:** Asana remains the source of truth for project work. Kazi remains the source of truth for people operations, daily reporting, performance and engagement. Slack is the delivery surface for actionable prompts. Do not mirror every system event across the other two.

- [x] **11. Pull selected Asana task-health signals into Kazi.** *(Staff see their own due-today, overdue, blocked and recently completed Asana work in Pulse, using only the title, project, due date, state and deep link. Completed work stays opt-in for daily-log and check-in imports.)*
  - Build a staff-facing task-health read model for tasks assigned to the connected Asana user: due today, overdue, completed recently, and explicitly blocked/dependent work where available.
  - Feed completed tasks into the existing daily-log and weekly check-in import experience; do not automatically create Kazi time entries.
  - Use task title, project, due date, completion state and Asana deep link only. Do not ingest task descriptions, comments or attachments by default.
  - Acceptance: staff can see a current, privacy-minimised summary without Kazi becoming a second project manager.

- [x] **12. Add Asana-aware Slack digests.** *(The personal daily brief shows due-today and overdue counts without task titles. A manager sees only counts, and only from team members who chose to share. Kazi leaves Asana counts out of its brief when an admin has set that an Asana-to-Slack rule already sends them.)*
  - Include a concise, optional “due today”/“overdue” section in the personal daily Kazi brief.
  - Include a manager task-health signal only when manager access to the relevant Asana work has been explicitly approved; otherwise notify the task owner only.
  - Suppress Kazi Slack alerts for events already delivered through an enabled Asana-to-Slack rule, using an organisation setting and event-key deduplication.
  - Acceptance: no person receives the same task reminder from Asana and Kazi in the same reminder window.

- [x] **13. Add intentional Kazi-to-Asana action creation.** *(Staff can add a 1-on-1 commitment or development-plan action to Asana, after choosing a project and seeing exactly what will be created. The task holds the action text and one Kazi link, and nothing else from their records. Each action can be turned into a task once, and the link is stored.)*
  - Add a user-confirmed “Create Asana task” / “Link Asana task” action for 1-on-1 commitments and development-plan actions.
  - Let the user choose workspace/project, assignee and due date; persist the returned Asana task GID plus the Kazi source record in `asana_task_links`.
  - Never push weekly check-ins, mood, blockers, feedback, Voice Out, rewards, performance reviews, candidate data or other private HR data to Asana.
  - Acceptance: a created task includes a non-sensitive Kazi deep link and is never created without a visible user confirmation.

- [x] **14. Add selected-project webhook ingestion with reconciliation.** *(Administrators subscribe Kazi to chosen projects only. Deliveries are checked against Asana's signature, stored once per event, and a scheduled job reads each project's event log to catch anything missed. Events are stored but do not yet trigger notifications, because the roadmap does not say which events should notify.)*
  - Subscribe only to explicitly selected projects/portfolios—not the entire workspace—and store webhook metadata, event keys and signing secrets securely.
  - Verify the Asana webhook handshake/signature, enqueue processing, and acknowledge within Asana’s response window.
  - Run a periodic reconciliation pull for subscribed resources because webhook delivery is at-most-once; record misses and retries without creating duplicate notifications.
  - Acceptance: webhook retries, duplicate events and a missed event result in at most one Kazi/Slack notification.

- [x] **15. Add Asana sync controls and auditability.** *(Settings shows the last successful sync and any error, lets staff choose projects and turn Asana counts in the Slack brief on or off, and offers disconnect. Admins see only how many connections are failing. Disconnect removes Kazi's stored tokens but does not revoke the grant in Asana.)*
  - Add connection health, last sync time, selected projects, delivery preference and disconnect/revoke controls to Settings → Integrations.
  - Add admin-only operational metrics for sync failures and notification suppression, without displaying task content to unauthorised staff.
  - Acceptance: staff can tell whether their own sync is working, and admins can diagnose integrations without accessing private work details.

## P2 — Culture, recognition and compelling Slack experiences

- [x] **16. Add opt-in culture-channel announcements.** *(Public recognition, Wall of Fame winners and newly live Side Quests post as they happen. Milestones and goal completions are batched into the weekly recap. Names appear only for people who opted in. Recognition tied to a restricted campaign is left out.)*
  - Publish recognition, milestones, goal completions, approved Wall of Fame winners and newly live side quests to the configured culture/company channel.
  - Respect campaign visibility and user opt-ins; batch low-priority celebrations into a weekly recap.
  - Acceptance: no PIP, review, candidate or private feedback event can use this channel.

- [x] **17. Create a weekly culture recap.** *(One recap each Monday for the previous week, posted only when there is something to share. It counts everything and names only people who opted in.)*
  - Post a compact, opt-in recap of recognition, milestone celebrations, open side quests and completed quests.
  - Link to Kazi rather than displaying leaderboard or staff-sensitive details beyond the approved culture context.
  - Acceptance: one recap per week, skipped when there is no eligible content.

- [x] **18. Build Slack interactive actions.** *(Signed button clicks are accepted and every action is permission checked. Check-in DMs have "Mark reviewed" and "Remind me later". Review-results DMs have "Acknowledge" when exactly one review is waiting, plus "Remind me later". A snooze re-checks the item before sending again, four hours later. Needs SLACK_SIGNING_SECRET and the Interactivity URL set in the Slack app.)*
  - Upgrade from webhook-only delivery where needed: store bot/channel configuration securely, add `SLACK_SIGNING_SECRET`, verify Slack signatures, and implement an Interactivity request route.
  - Support safe actions first: “Open Kazi”, “Acknowledge”, “Mark reviewed”, and “Remind me later”. Write all state changes through Kazi permission checks.
  - Do not approve overtime, rewards, hires or performance actions directly from Slack until audit and confirmation design is complete.
  - Acceptance: invalid Slack signatures are rejected; every action is attributable and permission checked.

- [x] **19. Add on-demand Slack shortcuts and commands.** *(/kazi today, check-in, goals and timer reply privately with the person's own data only. The global "Open Kazi" message shortcut (callback_id `open_kazi`) replies privately with a Kazi link and never reads the message. Needs SLACK_SIGNING_SECRET, the slash command URL and the shortcut registered in the Slack app.)*
  - Provide `/kazi today`, `/kazi check-in`, `/kazi goals` and `/kazi timer` as private, ephemeral responses with Kazi deep links.
  - Add a global “Open Kazi” message shortcut only after the above commands are stable.
  - Acceptance: commands expose only the invoking user’s own data unless they have a relevant manager/admin permission.

- [x] **20. Add Slack notification analytics and admin controls.** *(Settings → Slack delivery shows 30-day counts by category, the most common reasons messages were held back, per-category switches and a test send, limited to five an hour. A workspace-wide rate guard holds back bursts. Message contents are never shown.)*
  - Add an admin view for routing, delivery success/failure, suppression reasons and message volume by category—not message bodies.
  - Include per-category toggles, test-send capability and a rate-limit guardrail.
  - Acceptance: admins can diagnose a missing notification without viewing private content.

## P3 — HeyTaco-inspired culture enhancements

> **Decision:** Kazi already covers the core recognition, values, rewards, milestones, quests, leaderboards, analytics and Slack delivery loop. These are selective improvements, not a second “taco economy”.

- [x] **21. Add a Slack-native “Recognise teammate” shortcut.** *(A message shortcut with callback ID `recognise_teammate` opens a modal: colleague, company value, optional live campaign and message. It creates public recognition through the same shared rules as the web form. Image upload is not included. Needs the shortcut registered in the Slack app.)*
  - Offer a message/global shortcut that opens a modal to choose a colleague, company value, message and optional image.
  - Save through Kazi’s existing public-recognition API, then send the recipient DM and company-channel post already in place.
  - Acceptance: recognition created in Slack appears immediately in Kazi with the same permissions, campaign validation, privacy controls and audit trail as web-created recognition.

- [x] **22. Add an optional cross-team connection match.** *(Staff can opt in at Pulse → Coffee chats. Admins generate the monthly private matches; direct reporting lines and recent pairings are excluded. Slack introduces each pair with a calendar-template link, never creates an event, and each staff member can accept, skip, request a rematch, or opt out.)*
  - Let staff opt into a monthly “Growthpad coffee chat” pairing; avoid repeat pairings for a configurable period and exclude reporting-line pairs by default.
  - Deliver a private Slack introduction with an optional Google Calendar scheduling link, not an automatic calendar event.
  - Acceptance: the match can be skipped, rematched or opted out of; no private staff data is exposed.

- [x] **23. Add recognition programme templates.** *(Campaign creation now offers editable starters for client wins, project launches, values spotlights, onboarding welcomes and monthly peer appreciation. Templates prefill the ordinary campaign form; values, audience, schedule, guidance point rule and Slack copy remain editable, with no hidden automation or reward.)*
  - Provide reusable campaign starters for client wins, project launches, values spotlights, onboarding welcomes and monthly peer appreciation.
  - Let HR customise values, audience, schedule, point rules and Slack copy before activating a template.
  - Acceptance: creating from a template produces an ordinary editable Kazi campaign—no hidden automation or duplicated rewards.

- [x] **24. Evaluate a read-only recognition display mode.** *(Written evaluation in `.agents/tasks/culture-evaluations-24-25.md`. Recommendation: no screen yet. Pilot as a company-channel weekly digest first.)*
  - Create a screen-safe, auto-refreshing “Kazi Recognition Wall” for an office TV or all-hands display, using only public opted-in recognition and approved Wall of Fame outcomes.
  - Include a privacy-safe empty state and a simple display URL protected by a dedicated viewing role or device token.
  - Acceptance: it cannot expose private feedback, performance data, daily logs, candidate data or admin controls.

- [x] **25. Reassess gift-card marketplace and public API only after reward operations mature.** *(Written reassessment in `.agents/tasks/culture-evaluations-24-25.md`. Recommendation: keep the curated catalogue; no gift cards or public API until an owner, budget and security review exist.)*
  - Document country, tax, fulfilment, accounting, fraud and refund requirements for global gift cards; keep the curated reward catalogue as the default meanwhile.
  - Define a narrow API surface and OAuth/service-account model only for validated integration demand.
  - Acceptance: neither project starts without an owner, budget, security review and a concrete Growthpad use case.

- [x] **26. Avoid recognition-volume incentives.** *(Removed the automatic +5 points for public recognition and reversed only unspent legacy recognition-award lots, preserving redeemed rewards and the audit trail.)*
  - Keep recognition quality tied to values, project impact and manager/HR review where points are involved; do not introduce daily transferable “tacos”.
  - Review reward-ledger reports quarterly for low-value recognition patterns before adding any new earning rule.
  - Acceptance: no point rule is added solely for sending or receiving a high volume of recognition.

## Slack app configuration needed before P2

- Retain least-privilege bot scopes already needed for direct messages: `chat:write`, `users:read.email`, plus conversation-opening permission where Slack requires it.
- For channel routing, add only the specific channel discovery/posting scopes required by the selected installation model.
- For interactive buttons and commands, add `SLACK_SIGNING_SECRET`, configure Interactivity and Request URLs, and enable only the relevant command scopes.
- Reinstall the Slack app after scope changes. Store bot tokens and signing secrets in Vercel/GitHub secrets only—never in source or the database.

## Explicit non-goals for this roadmap

- Replacing Kazi with Slack as the approval, performance or HR record.
- Posting confidential staff, recruiting or employee-relations data to channels.
- Sending every Kazi event to Slack.
- Reading Slack messages, browsing history or private channel content.
- Turning Kazi into a duplicate Asana task manager or syncing confidential HR information into Asana.
