# Implementation Plan — Analytics & Dashboards gaps

Worktree: `/Users/Apple/code/clients/kazi` (Next.js 16 + React 19 + Supabase). Relative paths in this plan are relative to it.

Per the workspace `AGENTS.md`, this Next.js ships breaking changes — read the relevant guide in `node_modules/next/dist/docs/` (exists: `01-app`, `02-pages`, `03-architecture`) before writing code. All changes are standard App Router server components / route handlers (Node runtime), which match the existing patterns in the files below.

Verified commands: type-check `npx tsc --noEmit`, lint `npm run lint` (eslint), tests `npm test` (vitest, node env, `src/**/*.test.ts`). There is no existing test harness for the Supabase-backed data layers (only `src/lib/cache/*.test.ts` exist), so Supabase-querying code is verified by tsc + lint; pure helpers get unit tests.

Verified role model (`src/lib/rbac.ts`): `can(role, "manage_system")` → admin/hr; `can(role, "manage_one_on_ones")` → admin/hr/manager; `view_people` → admin/hr/manager; `view_analytics` → admin/hr/manager. `session.user` carries `id`, `role`, `department`, `email`, `name` (`src/lib/auth.ts`). `users` has `manager_id` and `department`; `jobs` has `department`; `candidates` has `job_id` (join to jobs for department).

Note: the repo has pre-existing uncommitted edits to `src/lib/rbac.ts`, `LoginPage.tsx`, `AsanaTaskImport.tsx` — unrelated to this task. Do NOT stage or modify those files.

Out of scope for these 4 gaps: the Staff-page "Managers: 0" count and per-employee location seeding (Nairobi/Accra/New York) raised in the original chat — those are Staff-directory stats/data, not the analytics dashboards covered here.

Decisions resolved up front:
- Gap 1 view tiers use `manage_system` (org) / `manage_one_on_ones` (team) / else personal, matching `LeadershipDashboard`.
- Gap 2 email route always delivers to `session.user.email` and ignores client `recipients` (open-relay risk per brief). The recipient field in the export UI is left in place but ignored — noted as a known limitation.
- Gap 4: all three performance sources have schema support (`reward_ledger.amount`, `goals.status`, `performance_reviews.overall_rating` via `review_cycles`). Implement all three. Opt-out = exclude `engagement_notification_preferences.show_on_leaderboard = false` (Walk of Fame pattern).

---

## Gap 1 — Main dashboard role scoping

- [ ] 1. Extend `getDashboardData` to accept a session/user context and scope by view tier.
      Change signature to `getDashboardData(range, ctx)` where `ctx = { userId: string; role: UserRole; department: string | null }`. Add `view: "org" | "team" | "personal"` and an optional `personal` block to the `DashboardData` interface (personal: `{ recognitionsGiven: number; recognitionsReceived: number; goals: { onTrack; atRisk; completed; notStarted; total }; upcomingOneOnOnes: { id; scheduled_at; with }[]; pendingCheckin: boolean }`). Compute `view`: `can(role,"manage_system")` → org (unchanged queries); else `can(role,"manage_one_on_ones")` → team; else personal. Bump cache key to `dashboard`/`v4` and include `${view}_${ctx.userId}` so scoped data isn't served from the old org-wide cache. Team scope: fetch job ids where `jobs.department = ctx.department` and filter all candidate/pipeline/trend/rolePipeline/stageAging/scheduledJobs queries with `.in("job_id", jobIds)`; scope staff queries (`employees`, `newHires`) with `.eq("manager_id", ctx.userId)`; scope `checkins`/`goals` to direct-report ids (users where `manager_id = ctx.userId`); scope `one_on_ones` with `.eq("manager_id", ctx.userId)`. Personal scope: drop all hiring queries (return empty pipeline/trend/rolePipeline/stageAging/recent/interviewQueue/scheduledJobs and zero `stats` except as needed); fetch own goals (`owner_id = userId`), own upcoming 1-on-1s (`report_id = userId`), own pending check-in, `recognitionsGiven` = count `feedback` where `from_user_id = userId`, `recognitionsReceived` = count `feedback_recipients` where `user_id = userId`; populate `personal`.
      Files: `src/features/dashboard/data.ts`
      Verify: `npx tsc --noEmit` passes (no type errors from the new signature/fields).

- [ ] 2. Make `DashboardPage` pass the session context and render a personal view for employees.
      In `DashboardPage.tsx`, call `getDashboardData(range, { userId: session.user.id, role: session.user.role, department: session.user.department ?? null })`. Branch on `data.view`: `"personal"` → a personal layout (keep the hero greeting banner but drop the "awaiting AI screen" badge; render a 4-card personal KPI row built from `data.personal` — Recognitions given `/pulse/feedback`, Recognitions received `/pulse/feedback`, Goals on track `/pulse/goals`, Upcoming 1-on-1s `/pulse/one-on-ones`; then a row with "My action items" (own pending check-in / at-risk goals), the `GoalsWidget`, and "Upcoming 1-on-1s"; hide interview queue, org team pulse, pipeline funnel, top roles, all charts, hiring health, pipeline outcomes, role schedule, new hires, active surveys). `org` and `team` reuse the existing JSX unchanged (team just receives scoped data). Keep the existing `KpiCard`/`PipelineFunnel` components and `var(--border)`/`var(--surface)`/`brand-500` styling.
      Files: `src/features/dashboard/components/DashboardPage.tsx`
      Verify: `npx tsc --noEmit` and `npm run lint` pass.

- [ ] 3. Add an explicit auth route guard to the dashboard page.
      Convert `src/app/(app)/dashboard/page.tsx` to an async server component that calls `getServerSession(authOptions)` and `redirect("/login")` when there is no session, then renders `<DashboardPage />` (the `(app)` layout already redirects, but the brief asks for an explicit guard; this also makes the page safe if reached standalone).
      Files: `src/app/(app)/dashboard/page.tsx`
      Verify: `npx tsc --noEmit` passes.

- [ ] 4. Show the dashboard nav affordance to all authenticated roles.
      In `navigationForRole` (`src/lib/nav.ts`), stop gating `/dashboard` behind `view_people` so employees with a personal dashboard can reach it from the sidebar; keep `/staff` gated to managers. Change the `Home` group filter to keep `/dashboard` for everyone and only filter `/staff` by `isManager`.
      Files: `src/lib/nav.ts`
      Verify: `npm run lint` passes; `npx tsc --noEmit` passes.

## Gap 2 — Fix email export

- [ ] 5. Create a pure export-attachment builder helper + unit tests.
      Add `src/lib/export-attachment.ts` exporting `buildExportAttachment(format, data, headers, filename)` → `{ content: Buffer; filename: string; contentType: string }` where `format: "csv" | "xlsx" | "pdf"`, `data: Record<string, unknown>[]`, `headers: { label: string; key: string }[]`. CSV: header row of labels + value rows, RFC-style quoting (reuse the escaping pattern from `culture-export/route.ts`). XLSX: dynamic-import `xlsx`, map rows to label-keyed objects, `XLSX.utils.json_to_sheet` + `XLSX.write(wb, { type: "buffer", bookType: "xlsx" })`. PDF: `new jsPDF()` + `autoTable(doc, { head, body })` then `doc.output("arraybuffer")` (both libs are already deps). Add `src/lib/export-attachment.test.ts` covering CSV (header + escaping), XLSX (Buffer + correct filename/contentType), and PDF (Buffer produced) using vitest.
      Files: `src/lib/export-attachment.ts`, `src/lib/export-attachment.test.ts`
      Verify: `npm test` — new test passes; `npx tsc --noEmit` passes.

- [ ] 6. Create the `/api/export/email` POST route, authenticated and sending to the session user.
      Create `src/app/api/export/email/route.ts` as a Node-runtime POST handler. Gate with `getServerSession(authOptions)` (require any authenticated session — the data exported is what the caller already sees on their list page). Parse the ExportModal payload `{ data, headers, format, recipients, subject, message, filename, user }` but IGNORE `recipients` and `user`; set `to = session.user.email` (400 if missing). Validate `data` is a non-empty array, `headers` non-empty, `format` in `csv|xlsx|pdf`. Call `buildExportAttachment(...)`; send via `resend.emails.send({ from: EMAIL_FROM, to, subject: subject||default, html, text, attachments: [{ content, filename, contentType }] })` reusing `src/lib/email.ts` and the pattern from `src/app/api/hire/candidates/send-email/route.ts`. Return `{ id }` on success, 400 on bad input, 500 on Resend error.
      Files: `src/app/api/export/email/route.ts`
      Verify: `npx tsc --noEmit` and `npm run lint` pass.

- [ ] 7. Make the export modal's success message reflect delivery to the user's own email.
      In `ExportModal.handleEmailExport`, change the success toast from "sent to N recipients" to "sent to your email" (the route ignores `recipients`). Leave the recipient input in place (known limitation, see notes); do not otherwise alter the modal.
      Files: `src/components/ui/export/ExportModal.tsx`
      Verify: `npx tsc --noEmit` and `npm run lint` pass.

## Gap 3 — Expose culture report CSV in the UI

- [ ] 8. Offer JSON/CSV download in `ExportReportButton`.
      Convert the single button into a small dropdown (relative wrapper + `useState` open toggle, no new dependency) matching the existing border/surface/brand-500 style: a primary "Export report" button plus a caret that reveals two options — "Download JSON" and "Download CSV". Add a shared `download(blob, filename)` helper inside the component. Keep the existing JSON path (`?format=json` → Blob `application/json` → `culture-report-DATE.json`). Add the CSV path (`?format=csv` → response text → Blob `text/csv;charset=utf-8` → `culture-report-DATE.csv`), reusing the endpoint that already supports `format=csv`. Preserve the loading spinner and error text.
      Files: `src/features/pulse/analytics/components/ExportReportButton.tsx`
      Verify: `npx tsc --noEmit` and `npm run lint` pass.

## Gap 4 — Performance-based Top Performers

- [ ] 9. Add the Top Performers data queries to `LeadershipDashboard` (scoped + opt-out).
      In `LeadershipDashboard.tsx`, extend the existing data fetch to also load: (a) `engagement_notification_preferences` where `show_on_leaderboard = false` → `optedOutSet` (exclude these from all three rankings, the Walk of Fame opt-out pattern); (b) `reward_ledger` `select user_id, amount` `.in("user_id", memberIds)`; (c) the most recent `review_cycles` row (order by `start_date` desc, limit 1) then `performance_reviews` `select reviewee_id, overall_rating` `.eq("cycle_id", latest)` `.not("overall_rating","is",null)` `.in("reviewee_id", memberIds)`. Reuse the already-fetched `goals` array for the goal-completion ranking. Build three Top-10 lists joined to the existing `members` map (name/department): (1) reward points = sum of positive `amount` per user; (2) goal completion rate = `completed/total` per `owner_id`, only owners with ≥3 goals; (3) review ratings = average `overall_rating` per `reviewee_id` for the latest cycle. Drop opted-out users from each.
      Files: `src/features/pulse/analytics/components/LeadershipDashboard.tsx`
      Verify: `npx tsc --noEmit` passes.

- [ ] 10. Render a tabbed Top Performers leaderboard matching the Walk of Fame style.
      Add a `TopPerformersSection` (in the same file or a new `TopPerformersSection.tsx` next to it) with three tabs — "Reward points", "Goal completion", "Review ratings" — each showing a podium for the top 3 and a ranked list for 4–10, mirroring `WalkOfFamePage.tsx`'s `PodiumCard`/ranked-list visuals (emoji medals, `brand-500/10` avatars, `var(--border)`/`var(--surface)` cards, tenure/active badges omitted). Place the section after the existing Flight Risk / Department Breakdown sections so it inherits the same `isHr`/direct-reports scoping. Render only when at least one list has entries.
      Files: `src/features/pulse/analytics/components/LeadershipDashboard.tsx` (and optionally `src/features/pulse/analytics/components/TopPerformersSection.tsx`)
      Verify: `npx tsc --noEmit` and `npm run lint` pass.

## Final cross-cutting verification (after all gaps)

- [ ] 11. Run the full type-check, lint, and test suite; fix any errors introduced by these changes only.
      Files: n/a
      Verify: `npx tsc --noEmit`, `npm run lint`, and `npm test` all pass; report any pre-existing unrelated failures rather than fixing them.
