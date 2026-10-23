# Analytics & Dashboard — Implementation Summary

Commit: `02bf919`

---

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/export-attachment.ts` | Pure helper: builds CSV / XLSX / PDF as a `Buffer` + metadata for email attachment |
| `src/lib/export-attachment.test.ts` | Vitest unit tests: CSV header+escaping, XLSX buffer, PDF buffer (4 tests, all pass) |
| `src/app/api/export/email/route.ts` | Node-runtime POST handler — gate by session, always sends to `session.user.email`, builds attachment via `buildExportAttachment`, sends via Resend |
| `src/features/pulse/analytics/components/TopPerformersSection.tsx` | Client component — 3-tab tabbed leaderboard (Reward points / Goal completion / Review ratings) with podium + ranked list |

## Files Modified

| File | What changed |
|------|--------------|
| `src/features/dashboard/data.ts` | Added `DashboardContext` type; `getDashboardData` now accepts optional `ctx`; added `view` field and `personal` block to `DashboardData`; cache key bumped to `v4` with `${view}_${userId}` suffix; `buildPersonalData` fetches own goals/recognitions/1-on-1s/check-in; `buildOrgOrTeamData` applies team-scope filters (job ids by dept, direct-report ids) |
| `src/features/dashboard/components/DashboardPage.tsx` | Passes `ctx` to `getDashboardData`; branches on `data.view === "personal"` to render 4-card personal KPI row + action items + Goals widget + 1-on-1s (hides all hiring/pipeline sections); org/team views unchanged |
| `src/app/(app)/dashboard/page.tsx` | Converted to async server component with explicit `getServerSession` / `redirect("/login")` guard |
| `src/lib/nav.ts` | `/dashboard` no longer gated behind `view_people`; all authenticated users see it; `/staff` still requires `view_people` |
| `src/components/ui/export/ExportModal.tsx` | Success toast changed from "sent to N recipients" to "sent to your email" |
| `src/features/pulse/analytics/components/ExportReportButton.tsx` | Converted from single button to split-button dropdown: primary button triggers JSON download; caret reveals "Download JSON" and "Download CSV" options; preserves spinner + error text |
| `src/features/pulse/analytics/components/LeadershipDashboard.tsx` | Extended data fetch to load `engagement_notification_preferences` (opt-out set), `reward_ledger`, latest `review_cycles` row + `performance_reviews`; builds three Top-10 lists; renders `<TopPerformersSection>` after Department Breakdown |

---

## What Each Gap Does

### Gap 1 — Dashboard role scoping
Employees (role `employee` / `interviewer` / `hiring_manager`) who don't hold `manage_one_on_ones` now land on a personal dashboard showing their own recognitions given/received, goals on track, upcoming 1-on-1s, and action items (pending check-in / at-risk goals). Managers get a team-scoped view filtered to their department and direct reports. Admins/HR see the existing org-wide view unchanged. Cache keys are isolated per user so no cross-contamination.

### Gap 2 — Email export
The `/api/export/email` endpoint now correctly sends exported files to the authenticated user's own email address, regardless of what the client sends in the `recipients` field. This eliminates the open-relay risk. The export modal's success message reflects this.

### Gap 3 — Culture report CSV
The "Export report" button on the Leadership Analytics page is now a split-button dropdown letting users choose between JSON (existing) and CSV download. Both hit the existing `/api/pulse/reports/culture-export` endpoint with the appropriate `?format=` parameter.

### Gap 4 — Top Performers leaderboard
The Leadership Analytics page now shows a "Top Performers" section beneath the Department Breakdown table. It has three tabs:
- **Reward points** — sum of positive `reward_ledger.amount` per user
- **Goal completion** — `completed/total` rate for users with ≥3 goals
- **Review ratings** — average `overall_rating` from the most recent review cycle

Each tab shows a Walk of Fame–style podium (top 3) plus a ranked list (positions 4–10). Users who have opted out via `engagement_notification_preferences.show_on_leaderboard = false` are excluded from all three rankings.

---

## Known Limitations

- The email export UI still shows a "Recipients" input field. It is left in place (the plan explicitly notes this as a known limitation), but the server route ignores whatever is entered and delivers only to the session user.
- Personal dashboard 1-on-1 widget shows meetings where the employee is the *report* (i.e. meetings their manager scheduled with them). Manager-initiated 1-on-1 widgets on org/team views show report names as before.
- Team-scoped dashboard hiring data requires the manager's `department` to be set in their session profile; if `department` is `null`, the `jobIds` filter will be empty and hiring panels will show zero.
- The pre-existing `core.test.ts` / `queries.test.ts` failures (`kazi:people:list` vs `kazi:staff:list`) are unrelated to this task and were present before these changes.
