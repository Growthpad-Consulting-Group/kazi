# Analytics & Dashboards — Implementation Audit

**Audited feature:** "Analytics & Dashboards: Role-based access dashboards providing self-service reports, recognition trends, top-performer tracking, and culture insights."

**Scope:** `src/features/dashboard/`, `src/features/pulse/`, `src/lib/auth.ts`, `src/lib/rbac.ts`, `src/lib/nav.ts`, `src/app/api/`

---

## Summary answer

The Analytics & Dashboards feature is **partially implemented overall**. Of its five sub-capabilities, two are **fully implemented** (recognition trends, culture insights), and three are **partially implemented** (role-based dashboards, self-service reports, top-performer tracking). The pieces exist and render, but coverage is uneven and there are concrete gaps: the main dashboard is not role-scoped, report scheduling and the email-delivery export channel are missing/broken, the culture-report CSV format is not exposed in the UI, and all "top-performer" views are participation/recognition-based rather than performance-based.

| # | Sub-capability | Status |
|---|----------------|--------|
| 1 | Role-based access dashboards | Partially implemented |
| 2 | Self-service reports | Partially implemented |
| 3 | Recognition trends | Fully implemented |
| 4 | Top-performer tracking | Partially implemented |
| 5 | Culture insights | Fully implemented |

---

## 1. Role-based access dashboards — PARTIALLY IMPLEMENTED

The product has three distinct "dashboard" surfaces, and only one of them implements a proper role-based data scope.

### Main dashboard (`/dashboard`) — NOT role-scoped
- `src/features/dashboard/components/DashboardPage.tsx` reads the session for a greeting and a role label string (`session?.user.role?.replace("_", " ")`) but never branches content by role.
- The data layer `getDashboardData(range)` in `src/features/dashboard/data.ts` takes only a `DashboardRange` and **no user/role/department parameter**. Every query is org-wide (`supabaseAdmin.from("candidates")…`, `.from("users")…`). Admin, HR, manager, and (if they reach the URL) everyone else see identical org-wide hiring numbers.
- Access control is inconsistent with the data. The nav (`src/lib/nav.ts`, `navigationForRole`) hides `/dashboard` unless `can(role, "view_people")` (admin/hr/manager), but `src/app/(app)/layout.tsx` only checks for a session, and `src/app/(app)/dashboard/page.tsx` adds no role guard. The `nav.ts` comment itself notes "Navigation is an affordance, not the access-control boundary." A direct URL hit by a non-manager still renders the org-wide dashboard.

### Pulse dashboard (`/pulse`) — binary manager/not adaptation
- `src/features/pulse/dashboard/components/PulseDashboard.tsx` is **personal** for everyone: your own check-in, goals, 1-on-1s, recent recognition.
- It adapts by a single boolean: `const isManager = can(session.user.role, "manage_one_on_ones")` (admin/hr/manager). When true it adds a "Team radar" panel (submitted/awaiting/avg mood/blockers for direct reports), `MilestonesWidget`, and `CultureHealthWidget`.
- This is a 2-tier (personal + manager extras), not the 3-tier (org-wide / team / personal) implied by the feature description. An admin on this page sees the same manager-scoped view as a line manager — there is no org-wide pulse view here.

### Leadership Analytics — proper 3-tier scoping (the best example)
- `src/features/pulse/analytics/components/LeadershipDashboard.tsx` is the only surface that scopes data by role properly:
  - Guards access with `if (!can(session.user.role, "view_analytics")) redirect("/pulse")` (admin/hr/manager only).
  - `const isHr = can(session.user.role, "manage_surveys")` (admin/hr). If `isHr`, it loads **all** active members; otherwise it loads only direct reports (`membersQuery.eq("manager_id", session.user.id)`).
  - The "Department Breakdown" table and org-wide stats render only `if (isHr)`. The header literally reads "Organisation-wide" vs "Your team".
  - Managers who are not HR see their team only; employees (no `view_analytics`) are redirected.

### Evidence of gaps
- The main dashboard returns org-wide hiring data to whoever can reach it with no personal/team view.
- The Pulse dashboard's `isManager` check is binary; there is no admin-level org-wide pulse view (that role is satisfied only inside Leadership Analytics).
- Route-level guards exist only on the analytics pages; the main dashboard route has none.

**Verdict:** Role adaptation exists but is inconsistent across surfaces. Leadership Analytics is the model to follow; the main dashboard and Pulse dashboard do not match it.

---

## 2. Self-service reports — PARTIALLY IMPLEMENTED

On-demand export is present in several forms; report building and scheduling are not.

### Client-side export on list pages (works)
- `src/components/ui/export/ExportModal.tsx`, rendered by `src/components/ui/GenericTable.tsx`, offers CSV, XLSX, PDF, and "email" output with field selection, sort order, and a preview.
- CSV uses react-csv (`CsvLink`), XLSX uses the `xlsx` package (`src/components/ui/export/exportUtils.ts` → `exportXLSX`), PDF uses `jspdf` + `jspdf-autotable` (`exportPDF` in `ExportModal.tsx`). These are genuinely functional on-demand exports from any `GenericTable`-backed list (staff, candidates, jobs, etc.).

### Server-side CSV exports (works, admin-only)
- `src/app/api/export/employees/route.ts`, `src/app/api/export/reviews/route.ts`, `src/app/api/export/candidates/route.ts` each return CSV, all gated with `can(session.user.role, "manage_system")` (admin/hr).

### Culture report export (works, but UI limited)
- `src/app/api/pulse/reports/culture-export/route.ts` supports both `format=json` and `format=csv` (5 sections: campaigns, recognition summary, voice-out themes, survey participation, 12-week engagement trend). Gated with `can(session.user.role, "view_analytics")`.
- The wired UI, `src/features/pulse/analytics/components/ExportReportButton.tsx`, only ever requests `?format=json` and downloads a JSON blob. **The CSV format the endpoint supports is never exposed through the button**, so a user cannot download the culture report as CSV from the UI.

### Email delivery — BROKEN
- `ExportModal.handleEmailExport` POSTs to `/api/export/email`. **That route does not exist** — `src/app/api/export/` contains only `candidates/`, `employees/`, `reviews/`. Selecting "email" as the export format fails at runtime (404).

### What is missing
- No report **builder** (composing arbitrary metrics/dimensions into a custom report). The closest is the ExportModal field selector.
- No **report scheduling / recurring delivery** (cron-driven or user-scheduled recurring reports). Grep across the repo found no scheduled-report feature; existing crons cover CV screening and milestone generation, not reports.

**Verdict:** On-demand download (CSV/XLSX/PDF) works on list pages and via admin CSV endpoints. The email export channel is broken, the culture-report CSV is unexposed, and there is no scheduling or true report builder.

---

## 3. Recognition trends — FULLY IMPLEMENTED

- `src/features/pulse/analytics/components/RecognitionTrendChart.tsx`: a `recharts` `AreaChart` (`"use client"`) plotting recognitions sent per week. Accepts `TrendPoint[]` (`{ label, count }`).
- It is rendered by `src/features/pulse/analytics/components/RecognitionAnalyticsSection.tsx` inside the "Recognition trend" card ("Recognitions sent per week over the last 8 weeks"). Data is derived from public `feedback` rows bucketed into the last 8 weekly intervals, respecting the selected campaign filter.
- The page is reachable at `/pulse/analytics` (`src/app/(app)/pulse/analytics/page.tsx`) which renders `LeadershipDashboard` then `RecognitionAnalyticsPage`.
- The chart is complete, wired to live data, and respects filters (range/department/campaign via `RecognitionAnalyticsFilters`).

**Verdict:** Complete and functional. Note it tracks recognition *volume over time*; there is no separate trend for *types* of recognition beyond the value-distribution bar chart on the same page.

---

## 4. Top-performer tracking — PARTIALLY IMPLEMENTED

Several recognition/participation rankings exist; none rank by performance metrics.

- **Walk of Fame** — `src/features/pulse/walk-of-fame/` (`WalkOfFamePage.tsx` + `data.ts`): all-time recognition champions (top 20 by recognition received), with a podium for the top 3, tenure badges (1/3/5/10yr), an "Active" flag for last-30-days recipients, and opt-out enforcement via `engagement_notification_preferences.show_on_leaderboard`.
- **Culture Leaderboards** — `src/features/pulse/leaderboards/components/LeaderboardsPage.tsx`: five boards over the last 90 days — Campaign participation, Side Quests completed, Quiz scores, Recognition givers, Recognition receivers. Opt-in enforced; togglable via `company_settings.culture_leaderboards_enabled`.
- **Recognition Analytics top givers/receivers** — `RecognitionAnalyticsSection.tsx` renders time/department/campaign-filtered "Top givers" and "Top receivers" leaderboards (top 5 each). More filterable than the standalone leaderboards.
- **LeadershipDashboard flight-risk** — `LeadershipDashboard.tsx` surfaces *at-risk* employees (2+ low-mood check-ins or blockers in 3+ of last 4 weeks), i.e. the inverse of top performers.
- **Rewards** — `src/features/pulse/rewards/components/RewardsPage.tsx` is a personal points balance + redemption (and HR pending-approval queue). There is **no "top points earners" leaderboard**.

### Evidence of gaps
- Every ranking is activity/recognition-based (recognitions sent/received, quests completed, quiz points), not performance-based. There is **no ranking by performance-review ratings, goal-completion rate, or total reward points earned**.
- A prior audit in `.agents/tasks/features-audit.md` states the same: "Leaderboard is participation-only, not performance. It counts activity (recognitions, quest completions) rather than quality or impact metrics, which may not satisfy a 'top performers' requirement."

**Verdict:** Recognition-based top-performer views are well-built and exist in multiple forms, but performance-based top-performer tracking is absent.

---

## 5. Culture insights — FULLY IMPLEMENTED

Culture health, mood/engagement trends, and survey/voice analytics are all present.

- **Culture health widget** — `src/features/pulse/dashboard/components/CultureHealthWidget.tsx`: four live indicators, each green/yellow/red — Recognition participation (% of staff giving recognition, 30d), Neglected values (values unused in 30d), Campaign drop-off (live campaigns with no recognition in 7d), Teams needing follow-up (departments with no check-ins in 14d). Shown to managers on the Pulse dashboard.
- **Leadership Analytics** — `LeadershipDashboard.tsx` + `PulseAnalyticsCharts.tsx`: Check-in rate, Average mood, Goal progress, Attention signals (flight-risk count); a 4-week "Team rhythm" dual-axis area chart (check-in rate % + average mood); a "Goal health" donut (not started/in progress/at risk/completed); and an HR-only Department Breakdown table (headcount, check-ins %, avg mood, at-risk).
- **Survey analytics** — `src/features/pulse/surveys/components/SurveyResults.tsx` (rendered on survey detail): per-question insights — scale questions show average score + 1–5 distribution (`SurveyDistributionChart.tsx` bar chart); choice/quiz questions show option distribution; text questions list responses.
- **Voice Out insights** — `src/features/pulse/voice-out/components/VoiceOutInsights.tsx`: privacy-thresholded recurring themes and reporter-selected sentiment signal (suppressed below a 5-report minimum), plus open/priority case counts.
- **Culture export report** — `src/app/api/pulse/reports/culture-export/route.ts` bundles campaigns, recognition summary, voice-out themes, survey participation, and a 12-week engagement (recognition) trend.
- Mood trends and engagement scores appear in the Pulse dashboard team radar, the Leadership Analytics charts, and the export report.

**Verdict:** Complete. Culture/mood/engagement/survey/voice insights are all implemented and role-gated to managers/HR.

---

## Conclusions

The feature as a whole is substantially built — the analytics page, culture-health widget, recognition trend chart, and leadership dashboard all render live, role-gated data. The shortfalls are specific:

1. **Role scoping is uneven.** Leadership Analytics does org/team/personal correctly; the main `/dashboard` shows org-wide hiring data to everyone with no personal/team variant, and the Pulse dashboard is only a binary manager/not split.
2. **Self-service reports lack scheduling and a working email channel**, and the culture-report CSV is not exposed in the UI.
3. **Top-performer tracking is recognition/activity-only**; there is no performance-based (review ratings, goal completion, points earned) ranking.

## Recommendations (no implementation)

- **Unify role-based data scoping.** Make `getDashboardData` accept a session/user context and return org-wide (HR/admin), team (manager, by `manager_id`), or personal (employee) datasets. Add a route guard to `/dashboard` to match the nav affordance, or build a personal dashboard for non-managers.
- **Fix report exports.** Implement `src/app/api/export/email` (or remove the email option from `ExportModal`), add a CSV toggle to `ExportReportButton` (the endpoint already supports `format=csv`), and consider a report-scheduling feature (a recurring-report record + a cron worker) if recurring delivery is in scope.
- **Add performance-based top-performer views.** Surface rankings by review-cycle ratings, goal-completion rate, and/or total reward points — alongside the existing recognition/participation boards — so "top performer" reflects impact, not just activity.
- **Keep what works.** RecognitionTrendChart, CultureHealthWidget, LeadershipDashboard scoping, SurveyResults, and VoiceOutInsights are complete; no changes needed there.
