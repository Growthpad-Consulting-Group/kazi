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

- [~] **5. Add scheduled 1-on-1 reminders.** *(partial: both participants get one reminder about 90 minutes before a meeting, and the manager gets one follow-up when notes and actions are still empty an hour or more after it. Not yet deduplicated against calendar invitations.)*
  - Send participants a configurable reminder before the meeting and a follow-up if notes/actions are still incomplete after it.
  - Deduplicate against calendar invitations; Slack is a reminder, not a second calendar system.
  - Acceptance: both participants get exactly one reminder in their local time.

## P1 — Helpful daily rhythm and conversations

- [x] **6. Create timezone-aware digest workers.**
  - Add authenticated scheduled routes and GitHub Actions/Vercel cron configuration for daily and weekly deliveries.
  - Use `slack_notification_deliveries` event keys to prevent retries or reruns from duplicating messages.
  - Acceptance: workers can be run manually, are safe to rerun, and report counts without exposing message content in logs.

- [~] **7. Send a personal daily Kazi brief.** *(partial: opt-in toggle in Settings → Notifications; covers today's 1-on-1s, goals due within three days, daily-log status and check-in status. Interviews and Asana due-today items are not included yet.)*
  - At each employee's chosen workday start, send an optional DM with today’s 1-on-1s/interviews, active goals, due work and daily-log status.
  - Suppress it when there is nothing actionable.
  - Acceptance: one compact message with one “Open today in Kazi” link; no empty digests.

- [x] **8. Add check-in and manager cadence reminders.**
  - Friday: gently prompt only staff who have not submitted their weekly reflection.
  - Monday morning: send managers an actionable team pulse—missing check-ins, new blockers, pending review—without exposing sensitive details.
  - Friday afternoon: send managers a concise review queue.
  - Acceptance: reminders stop as soon as the check-in/review is complete.

- [~] **9. Add Kazi mentions and threaded conversation alerts.** *(privacy-safe `@Name` mentions now work in shared 1-on-1 notes for the other authorised participant; dedicated comments/threads for goals, feedback and review collaboration remain.)*
  - Introduce `@name` mentions in supported Kazi notes/comments (1-on-1s, goals, feedback and review collaboration where appropriate).
  - Parse only valid active staff mentions, create an in-app notification and DM the mentioned person with a direct deep link.
  - Preserve the comment thread in Kazi; Slack replies are not treated as Kazi records in this phase.
  - Acceptance: mention sends one private alert and does not notify the author or duplicate names.

- [~] **10. Add survey and feedback lifecycle reminders.** *(partial: survey launch and closing DMs go only to staff who have not responded; HR gets a privacy-safe Voice Out alert with no reporter, topic or message. Feedback-needs-response reminders are not yet built.)*
  - DM eligible staff when a survey launches and before it closes, only if they have not responded.
  - Notify HR privately when Voice Out or feedback needs a response; never identify an anonymous reporter.
  - Acceptance: anonymous Voice Out stays anonymous end-to-end.

## P1.5 — Asana signals without duplicate notification noise

> **System boundaries:** Asana remains the source of truth for project work. Kazi remains the source of truth for people operations, daily reporting, performance and engagement. Slack is the delivery surface for actionable prompts. Do not mirror every system event across the other two.

- [~] **11. Pull selected Asana task-health signals into Kazi.** *(partial: employees can already import their completed Asana tasks into daily logs and weekly check-ins; there is no due/overdue/blocked task-health model yet)*
  - Build a staff-facing task-health read model for tasks assigned to the connected Asana user: due today, overdue, completed recently, and explicitly blocked/dependent work where available.
  - Feed completed tasks into the existing daily-log and weekly check-in import experience; do not automatically create Kazi time entries.
  - Use task title, project, due date, completion state and Asana deep link only. Do not ingest task descriptions, comments or attachments by default.
  - Acceptance: staff can see a current, privacy-minimised summary without Kazi becoming a second project manager.

- [ ] **12. Add Asana-aware Slack digests.**
  - Include a concise, optional “due today”/“overdue” section in the personal daily Kazi brief.
  - Include a manager task-health signal only when manager access to the relevant Asana work has been explicitly approved; otherwise notify the task owner only.
  - Suppress Kazi Slack alerts for events already delivered through an enabled Asana-to-Slack rule, using an organisation setting and event-key deduplication.
  - Acceptance: no person receives the same task reminder from Asana and Kazi in the same reminder window.

- [ ] **13. Add intentional Kazi-to-Asana action creation.**
  - Add a user-confirmed “Create Asana task” / “Link Asana task” action for 1-on-1 commitments and development-plan actions.
  - Let the user choose workspace/project, assignee and due date; persist the returned Asana task GID plus the Kazi source record in `asana_task_links`.
  - Never push weekly check-ins, mood, blockers, feedback, Voice Out, rewards, performance reviews, candidate data or other private HR data to Asana.
  - Acceptance: a created task includes a non-sensitive Kazi deep link and is never created without a visible user confirmation.

- [ ] **14. Add selected-project webhook ingestion with reconciliation.**
  - Subscribe only to explicitly selected projects/portfolios—not the entire workspace—and store webhook metadata, event keys and signing secrets securely.
  - Verify the Asana webhook handshake/signature, enqueue processing, and acknowledge within Asana’s response window.
  - Run a periodic reconciliation pull for subscribed resources because webhook delivery is at-most-once; record misses and retries without creating duplicate notifications.
  - Acceptance: webhook retries, duplicate events and a missed event result in at most one Kazi/Slack notification.

- [ ] **15. Add Asana sync controls and auditability.**
  - Add connection health, last sync time, selected projects, delivery preference and disconnect/revoke controls to Settings → Integrations.
  - Add admin-only operational metrics for sync failures and notification suppression, without displaying task content to unauthorised staff.
  - Acceptance: staff can tell whether their own sync is working, and admins can diagnose integrations without accessing private work details.

## P2 — Culture, recognition and compelling Slack experiences

- [~] **16. Add opt-in culture-channel announcements.** *(partial: completed goals can post to the configured company webhook; culture routing, opt-ins and the remaining eligible event types are not implemented)*
  - Publish recognition, milestones, goal completions, approved Wall of Fame winners and newly live side quests to the configured culture/company channel.
  - Respect campaign visibility and user opt-ins; batch low-priority celebrations into a weekly recap.
  - Acceptance: no PIP, review, candidate or private feedback event can use this channel.

- [ ] **17. Create a weekly culture recap.**
  - Post a compact, opt-in recap of recognition, milestone celebrations, open side quests and completed quests.
  - Link to Kazi rather than displaying leaderboard or staff-sensitive details beyond the approved culture context.
  - Acceptance: one recap per week, skipped when there is no eligible content.

- [ ] **18. Build Slack interactive actions.**
  - Upgrade from webhook-only delivery where needed: store bot/channel configuration securely, add `SLACK_SIGNING_SECRET`, verify Slack signatures, and implement an Interactivity request route.
  - Support safe actions first: “Open Kazi”, “Acknowledge”, “Mark reviewed”, and “Remind me later”. Write all state changes through Kazi permission checks.
  - Do not approve overtime, rewards, hires or performance actions directly from Slack until audit and confirmation design is complete.
  - Acceptance: invalid Slack signatures are rejected; every action is attributable and permission checked.

- [ ] **19. Add on-demand Slack shortcuts and commands.**
  - Provide `/kazi today`, `/kazi check-in`, `/kazi goals` and `/kazi timer` as private, ephemeral responses with Kazi deep links.
  - Add a global “Open Kazi” message shortcut only after the above commands are stable.
  - Acceptance: commands expose only the invoking user’s own data unless they have a relevant manager/admin permission.

- [ ] **20. Add Slack notification analytics and admin controls.**
  - Add an admin view for routing, delivery success/failure, suppression reasons and message volume by category—not message bodies.
  - Include per-category toggles, test-send capability and a rate-limit guardrail.
  - Acceptance: admins can diagnose a missing notification without viewing private content.

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
