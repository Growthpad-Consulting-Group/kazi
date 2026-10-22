# Kazi suite integration

## Goal

Make Kazi Hire, Kazi Pulse, Staff and Kazi Signatures feel like one employee lifecycle product, while preserving their specialised workflows.

## Actionable delivery checklist

### Foundation: one employee record

- [x] Add a dedicated employee profile at `/people/[id]`.
- [x] Show a cross-suite employee snapshot: manager, department, start date, latest check-in, goals, upcoming 1-on-1 and signature status.
- [x] Add profile navigation for Overview, Pulse, Performance, Development and Signature.
- [x] Replace list-filter “View profile” links with the employee profile.
- [x] Add reciprocal links from Signature staff profiles back to the employee profile.

### Hire to employee onboarding

- [x] Add a deliberate “Create staff record” action for a hired candidate.
- [x] Pre-fill the staff form from candidate and job data.
- [x] On confirmation, create the Kazi user, preserve a link to the source candidate, and create the mapped signature profile where the email domain is configured.
- [x] Add onboarding checklist items: manager, department, start date, first check-in, goals and signature assignment.
- [x] Surface incomplete onboarding in the shared work queue.

### Canonical organisation data

- [x] Make Departments the canonical shared reference for Staff, Jobs, reporting and Signatures.
- [x] Replace new free-text department writes with the canonical department value, while retaining existing values during migration.
- [x] Add department drill-downs for staff, open jobs, hiring pipeline and goals.

### Shared navigation and operating context

- [x] Add contextual links between job details, employee profiles and departments.
- [x] Upgrade the command palette into global entity search for staff, candidates, jobs, goals, reviews and signature profiles.
- [x] Consolidate cross-suite pending work in a shared work queue.
- [x] Keep specialised module navigation: the single generic Staff destination is the employee hub, while Signature staff remains a clearly labelled deployment-specific workspace.

## Delivery order

1. Employee profile and reciprocal links.
2. Hire-to-staff onboarding conversion.
3. Canonical department data and drill-downs.
4. Global search and shared work queue.

## Engagement and culture expansion

High5 parity is not just recognition, surveys and dashboards. Its current product also covers value-linked recognition, configurable campaigns, timed participation activities, rewards, milestone moments, automation and dedicated culture analytics. Kazi already has check-ins, goals, feedback, anonymous surveys and role-aware Pulse reporting; the checklist below targets the remaining gaps without duplicating those foundations.

### Phase 0: product and policy decisions

- [ ] Decide whether Kazi recognition remains non-monetary or includes redeemable points and rewards.
- [ ] Define the permitted anonymous-report categories, escalation owners, response-time expectations and retention policy for Voice Out.
- [x] Define the organisation values that can be used as recognition tags and campaign themes.
- [x] Choose the initial eligible audiences for culture campaigns: company-wide, department, location, manager group or custom staff group.

### Phase 1: safe, actionable employee voice

- [x] Add a dedicated **Voice Out** destination for anonymous, free-form employee feedback.
- [x] Apply and verify the Voice Out database migration in each target Supabase environment.
- [x] Let employees select a topic, add optional media, and choose whether HR may contact them through an identity-protected reply channel.
- [x] Create a restricted HR case queue with owner, status, priority, internal notes and resolution outcome.
- [x] Add safe aggregation rules so leaders only see anonymous themes when the minimum response threshold is met.
- [x] Add trend reporting for recurring themes, sentiment and unresolved cases without exposing an author.

### Phase 2: recognition campaigns that reflect Kazi customers

- [x] Add reusable recognition values/tags and require one when sending public recognition.
- [ ] Support multiple recipients, team recognition, rich notes and optional GIF/image attachments on a recognition post.
  - [x] Let a public shout-out celebrate multiple individual staff members while preserving private-note boundaries.
  - [ ] Add saved staff groups so a team can be recognised with one selection.
  - [ ] Add rich-format notes and optional GIF/image attachments with appropriate media controls.
- [x] Build a campaign editor with name, goal, audience and highlighted values; scheduling and participation rules remain next.
- [x] Add scheduled campaign states: draft, upcoming, live, paused, completed and archived.
- [x] Add a campaign hub that shows active campaigns, participation progress, recent recognitions and clear calls to action.
- [x] Add campaign-level reporting for participation, recognition volume, values represented and audience reach.

### Phase 3: interactive engagement

- [ ] Extend surveys with single-choice polls, timed quizzes and scored quiz questions.
  - [x] Add single-choice poll questions with live response distribution in survey results.
  - [x] Add scored quiz questions with author-configured time limits and server-side score calculation.
- [x] Add **Side Quests**: time-bound challenges with a clear brief, eligible audience, completion criteria and progress.
  - [x] Add manager-created time-bound challenges with a brief, completion criteria, lifecycle dates and visible completion progress.
  - [x] Enforce targeted eligibility for departments, locations, managers and selected staff groups.
- [x] Add optional leaderboards for quiz scores, campaign participation and completed challenges, with an organisation-level opt-out.
  - [x] Add an organisation-level opt-in and privacy-conscious leaderboards page for recognition and Side Quest participation.
  - [x] Add quiz-score and campaign-specific leaderboard views.
- [ ] Let managers schedule, target and close polls, quizzes and Side Quests from one engagement calendar.
- [ ] Add participant reminders and a completion digest that respects notification preferences.

### Phase 4: rewards, milestones and automation

- [ ] Add a staff reward wallet and auditable points ledger.
- [ ] Build a reward catalogue, redemption workflow, approval rules, fulfilment status and monthly budget controls.
- [ ] Add milestones for work anniversaries, birthdays where enabled, onboarding milestones and service achievements.
- [ ] Create automation rules for milestone recognition, campaign reminders, points allocation and manager nudges.
- [ ] Add branded email and in-app notification templates for recognition, campaigns, milestones and reward activity.

### Phase 5: culture intelligence

- [ ] Add recognition analytics for sent/received activity, value distribution, participation trend and cross-team reach.
- [ ] Add filters for period, department, location, manager, campaign and staff cohort.
- [ ] Add privacy-safe top-contributor and participation leaderboards, with clear role-based visibility.
- [ ] Add an exportable culture report combining campaigns, recognition, Voice Out themes, survey participation and engagement trends.
- [ ] Add health indicators that surface low participation, neglected values, campaign drop-off and teams needing follow-up.

## Engagement delivery order

1. Product policy decisions and Voice Out safeguards.
2. Values-linked recognition and campaigns.
3. Polls, quizzes and Side Quests.
4. Rewards, milestones and automations.
5. Culture intelligence and exports.
