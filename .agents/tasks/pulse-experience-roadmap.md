# Kazi Pulse Experience Roadmap

> **Goal:** Make Pulse a useful daily home for every staff member and a decisive, calm operating surface for managers and admins. Kazi remains the source of truth; Slack and Asana provide timely supporting signals.

## Experience rules

- Prioritise one obvious next action over more dashboard cards.
- Show employees only their own work, growth and culture opportunities; show managers only information they are authorised to act on.
- Do not reward basic compliance (such as merely opening Kazi or saving a daily log) with points.
- Suppress completed, expired and irrelevant calls to action automatically.
- Use the existing shared `StatCard`, card, avatar, shadow, date-picker, modal and action-queue patterns.

## P0 — Employee Pulse: a clear daily next step

- [x] **1. Create a personalised “Your next step” action queue on `/pulse`.**
  - Rank only relevant work: today’s daily log, weekly reflection, survey response, Side Quest evidence, Wall of Fame nomination/vote, released review acknowledgement, upcoming 1-on-1 preparation and open personal action items.
  - Each item needs an urgency label, a single primary action and a direct Kazi link.
  - Remove an item immediately once the underlying action is completed.
  - Acceptance: an employee can understand their highest-value next action without navigating through tabs.

- [x] **2. Remove repeated check-in prompts from the employee home.**
  - Consolidate the hero’s daily-log reminder and the duplicated weekly check-in card into the action queue.
  - Keep a compact weekly progress indicator when there is useful progress to show.
  - Acceptance: no employee sees two cards that lead to the same check-in task.

- [x] **3. Add a compact “My week” momentum module.**
  - Show workdays logged out of five, tracked time, completed Asana tasks when connected, and active-goal progress.
  - Add an informational consistency streak only; it is not a reward-point trigger.
  - Keep time and Asana data private to the employee unless explicitly shared through normal reporting.
  - Acceptance: one at-a-glance weekly summary links to daily activity and goals.

## P1 — Employee Pulse: growth, culture and follow-through

- [x] **4. Surface contextual culture opportunities.**
  - Show a single relevant card only when applicable: a live Side Quest, reward ready to redeem, newly received recognition, open Wall of Fame nomination/voting, or survey closing soon.
  - Do not show empty campaign/reward/quest placeholders.
  - Acceptance: the card is actionable, time-bound and disappears when there is nothing relevant.

- [x] **5. Add personal follow-through from conversations and feedback.**
  - Surface outstanding 1-on-1 action items, manager follow-ups, released performance feedback that needs acknowledgement, and active development-plan commitments.
  - Link to the source record, not a duplicated summary editor.
  - Acceptance: staff can see the next commitment from a conversation without exposing manager-only notes.

- [x] **6. Build a privacy-safe “My impact” history view.**
  - Show personal work/goal trends, recognition received, approved quest completions, achievements and development milestones.
  - Use own-data-only aggregation; never reveal peer performance comparisons here.
  - Acceptance: staff can review their progress before a 1-on-1 or performance review.

- [ ] **7. Connect employee Pulse to Slack/Asana only when useful.**
  - Feed the action queue into the optional Slack daily brief with per-user preferences and quiet hours.
  - Include selected Asana task-health signals; do not create time entries automatically.
  - Acceptance: Slack provides a deep link to the same next action, not a competing workflow.

## P0 — Admin and manager Pulse: a decisive operating workbench

- [x] **8. Add an admin/manager “Needs attention” queue at the top of `/pulse`.**
  - Prioritise direct-report check-ins needing review, flagged blockers/low mood, overdue scorecards, pending overtime/TOIL, reward redemptions, Side Quest evidence, open review actions and owned Voice Out cases. Surveys are response workflows, not assigned cases, so they are intentionally not treated as a confidential case queue.
  - Every item must state why it needs attention and provide one safe action/link.
  - Never put anonymous Voice Out identity information, private PIP detail or sensitive feedback in a generic queue.
  - Acceptance: actionable work is visible before broad metrics and disappears after resolution.

- [x] **9. Consolidate admin metrics into a “Pulse health” snapshot.**
  - Keep compact counts for team check-ins, blockers, mood trend, upcoming 1-on-1s, open engagement work and critical hiring dependencies where the user has permission.
  - Reuse the inline StatCard variant and avoid duplicate metrics already visible in the action queue.
  - Acceptance: a manager gets a clear weekly signal without needing the Analytics page for routine work.

- [x] **10. Make the admin view role-aware.**
  - Managers see only direct-report work; HR sees employee-relations queues they are assigned; admins see organisation-level operational controls.
  - Hide rather than empty-state unavailable widgets.
  - Acceptance: no role can infer confidential staff information outside its scope.

## P1 — Admin and manager Pulse: better decisions, not more noise

- [x] **11. Add a lightweight weekly trend strip.**
  - Show changes in submission coverage, blockers, mood signals, open 1-on-1 actions, participation and recognition over time.
  - Use the existing analytics chart primitives with short explanatory copy and drill-down links.
  - Acceptance: trends invite a drill-down; they are not presented as a performance score for individuals.

- [ ] **12. Add proactive, preference-aware Slack summaries.**
  - Deliver the manager action queue through an optional Monday/Friday Slack digest and immediate DMs only for high-value new actions.
  - Respect timezone, quiet hours, staff preferences and per-event idempotency.
  - Acceptance: Slack gives managers useful prompts without duplicating Kazi or Asana notifications.

- [x] **13. Add operational hand-off context.**
  - Allow an authorised admin/manager to assign a queue item to another authorised owner with an in-app note and audit entry.
  - Do not use Slack replies as the system of record.
  - Acceptance: reassignment preserves accountability and does not expose private details to unauthorised staff.

## P2 — Measurement and refinement

- [ ] **14. Instrument Pulse usefulness, not surveillance.**
  - Measure aggregate completion of action-queue items, reminder suppression, clicked deep links and unresolved duration by category.
  - Do not track browsing behaviour, keystrokes or time spent reading sensitive pages.
  - Acceptance: the team can identify noisy or ineffective prompts without creating employee surveillance.

- [ ] **15. Add configurable home modules after the core queue is proven.**
  - Let staff choose from approved optional modules such as rewards, recognition, goals or upcoming events.
  - Keep the action queue fixed and prioritised.
  - Acceptance: personalisation cannot hide mandatory or sensitive action items.
