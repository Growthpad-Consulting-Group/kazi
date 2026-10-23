# Analytics & Dashboard — Role-based dashboards, email export, culture CSV, top performers

The implementation adds role-scoped dashboards (personal/team/org), a secure email-export route, a CSV download option on the culture report button, and a three-tab Top Performers leaderboard on the Leadership Analytics page. All four gaps are addressed. The approach is largely correct and follows existing patterns, but there are two blocking concerns: the email export modal still requires a recipients field before it will submit — creating a dead-end UX since the server ignores it — and the `reward_ledger.amount` filter silently drops negative-balance users without a floor check, which may misrepresent totals for users whose reward points were reversed.

Watch for:
- **confirmed** — `ExportModal.handleEmailExport` blocks submission when `emailRecipients` is empty, but the recipients field is documented as ignored. Employees without the habit of entering their own email will hit an error and never successfully export.
- **confirmed** — `nav.ts` `sidebarNavGroups` contains a duplicate `/dashboard` entry in the `Home` group (visible in the raw array before filtering). The filter logic produces the correct result, but the duplicate is a latent defect that would show two Dashboard entries for any role that doesn't filter them.
- **likely** — `reward_ledger` aggregation only sums rows where `amount > 0`. If a user's positive transactions exist but are offset by reversals with negative amounts, the leaderboard total overstates their net points. The plan says "sum of positive `amount`" so this matches spec, but it diverges from what a user would expect "reward points" to mean.

**Verdict**: NEEDS_CHANGES

---

## High-level view

`getDashboardData` correctly computes a view tier from `can(role, "manage_system")` / `can(role, "manage_one_on_ones")` / else personal, isolates cache keys per user+view with a `v4` suffix, and the personal branch fetches only the employee's own data. The org/team branch applies team-scope filters via `jobIds` and `directReportIds`. `DashboardPage` branches on `data.view === "personal"` to render the four KPI cards and personal action items, leaving the org/team JSX untouched.

The auth guard on `dashboard/page.tsx` is a straightforward server-component redirect. `nav.ts` correctly excludes `/dashboard` from any per-role filter — every authenticated user sees it — while keeping `/staff` behind `isManager`. However, the static `sidebarNavGroups` array has a duplicate `/dashboard` entry that the grep confirms; it's harmless at runtime because the filter passes both through, but it is a mistake that should be cleaned up.

The email route correctly sends to `session.user.email` and rejects unauthenticated requests, but the modal's client-side guard still requires at least one recipient before it will call the route. An employee choosing "email" format must type their own address to proceed, which contradicts the stated purpose of locking delivery to the session user.

`export-attachment.ts` is a clean, dependency-isolated helper covering all three formats with RFC-4180 CSV escaping. The route passes `content` and `filename` to Resend; `contentType` is optional in Resend's `Attachment` interface and will be inferred from the extension.

`ExportReportButton` is correctly converted to a split-button dropdown. The primary button triggers JSON; the caret reveals JSON and CSV options; both paths call the existing culture-export endpoint.

The `TopPerformersSection` is a clean client component implementing the three-tab podium + ranked list. `LeadershipDashboard` fetches the three data sources and applies the opt-out set before building the Top-10 lists. The section renders only when at least one list has entries. One data semantic worth noting: the reward-points list sums only positive ledger rows, which means reversed transactions don't reduce the total shown on the leaderboard.

<details>
<summary>Issues (3)</summary>

1. **Email export client guard** — `ExportModal.handleEmailExport` blocks when `emailRecipients` is empty, but the server ignores recipients. A user with no recipients entered will see "Please enter at least one email recipient!" even though the route would deliver to their session email. Remove or soften the client-side guard (e.g. proceed if empty, since the route handles delivery) or update the modal to pre-populate the field with `session.user.email`.
2. **Duplicate `/dashboard` nav entry** — `sidebarNavGroups` in `nav.ts` contains two `{ href: "/dashboard" }` items in the `Home` group (confirmed by code read). The filter lets both through, so any role will see two "Dashboard" links in the sidebar. Remove the duplicate definition.
3. **Reward points over-count on reversals** — `LeadershipDashboard` sums `reward_ledger.amount` where `amount > 0`, ignoring negative (reversal) rows. If the intent is "net points earned", the query should sum all amounts per user and filter out negatives only at the display layer, or use a net-positive-only semantic consistently documented in the UI. As-is, it misrepresents totals for users with reversed transactions.

</details>

<details>
<summary>Details</summary>

### Recipients guard blocks functional email export

`handleEmailExport` in `ExportModal.tsx` line 160 returns early with a toast error if `emailRecipients.length === 0`. The plan explicitly states the route ignores `recipients` and always delivers to `session.user.email`. This means the email export path is unusable for any employee who reads the UI literally and doesn't think to enter their own address as a workaround. The modal has no copy explaining this, and the guard is not matched to the server's actual validation logic.

The simplest fix is to drop the client-side recipient check (the route validates `session.user.email` itself) or to pre-fill `emailRecipients` with `session?.user?.email` on mount.

### Duplicate dashboard nav item

Reading `nav.ts` lines 12–13, the `sidebarNavGroups` array's `Home.items` has `/dashboard` defined twice. The grep output confirms this:
```
{ href: "/dashboard", ... label: "Dashboard" },
{ href: "/dashboard", ... label: "Dashboard" },   // duplicate
```
The `navigationForRole` filter only strips `/staff` for non-managers; both `/dashboard` entries survive into the rendered sidebar for every role.

### Reward ledger semantics

`rewardTotals` in `LeadershipDashboard.tsx` iterates `rewardRows` and accumulates only rows where `amount > 0`. Net points = sum of all transactions (positive debits + negative credits). The current implementation will show Alice's gross positive postings even if she had points reversed. The scoreLabel "120 pts" looks authoritative on the leaderboard. This is a data-accuracy risk on any org that uses point reversals. The minimum fix is a comment documenting this is intentional gross-only semantics; a correct fix is to sum all amounts and show net.

### Personal action items source mismatch

`DashboardPage` renders personal action items from `operations.actionItems`, which in `buildPersonalData` is populated correctly with pending check-in and at-risk goals. The `data.personal` block also carries `pendingCheckin` and `goals.atRisk` independently. These are consistent, so there is no actual bug, but the duplication between `personal.pendingCheckin` and `operations.actionItems` means a future edit to one path may not update the other.

</details>

---

<details>
<summary>File map</summary>

| File | What changed |
|------|-------------|
| `src/features/dashboard/data.ts` | Added `DashboardContext`, view-tier logic, `buildPersonalData`, team-scope filters in `buildOrgOrTeamData`, cache key bumped to v4 |
| `src/features/dashboard/components/DashboardPage.tsx` | Passes ctx to `getDashboardData`; personal branch renders 4 KPI cards, action items, GoalsWidget, 1-on-1 list |
| `src/app/(app)/dashboard/page.tsx` | Converted to async server component with explicit `getServerSession` / `redirect` guard |
| `src/lib/nav.ts` | `/dashboard` no longer filtered by any role; `/staff` still behind `isManager`; has duplicate `/dashboard` entry in static array |
| `src/lib/export-attachment.ts` | New helper: CSV/XLSX/PDF from data+headers, returns Buffer + metadata |
| `src/lib/export-attachment.test.ts` | 4 vitest tests: CSV header, CSV quoting, XLSX buffer, PDF buffer |
| `src/app/api/export/email/route.ts` | New POST handler: authenticated, always sends to `session.user.email`, calls `buildExportAttachment`, sends via Resend |
| `src/components/ui/export/ExportModal.tsx` | Success toast changed to "Export email sent to your email!"; recipients guard still present |
| `src/features/pulse/analytics/components/ExportReportButton.tsx` | Split-button dropdown: primary = JSON, caret reveals JSON + CSV options |
| `src/features/pulse/analytics/components/LeadershipDashboard.tsx` | Extended fetch: opt-out set, reward ledger, latest review cycle + reviews; builds 3 Top-10 lists; renders `<TopPerformersSection>` |
| `src/features/pulse/analytics/components/TopPerformersSection.tsx` | New client component: 3-tab leaderboard with podium (top 3) + ranked list (4–10) |

Full diff: `git diff HEAD~1` from `/Users/Apple/code/clients/kazi`

</details>
