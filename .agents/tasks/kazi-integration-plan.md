# Kazi Suite Integration — Implementation Plan

Workspace: `/Users/Apple/code/clients/kazi`  
Verification command: `cd /Users/Apple/code/clients/kazi && npx tsc --noEmit`

---

## Sequencing overview

All 12 pending items are grouped into 6 FEATs, ordered by dependency:

| FEAT | Items | Dependency |
|------|-------|------------|
| FEAT-001 | DB migrations 11–12, all DB types, Staff groups API+UI, Media attachments | None — must run first (types block everything else) |
| FEAT-002 | notifications.ts library, engagement calendar actions, reminders cron route, vercel.json | FEAT-001 (DB types) |
| FEAT-003 | Migrations 13–15, Rewards, Milestones, Automation rules | FEAT-001 (DB types) |
| FEAT-004 | Recognition analytics page | FEAT-001 (DB types) |
| FEAT-005 | Culture health widget, culture export endpoint | FEAT-001 (DB types) |
| FEAT-006 | Privacy-safe leaderboard extensions | FEAT-001 (EngagementNotificationPreferences type) |

FEATs 002–006 are independent of each other; they only depend on FEAT-001.

---

## FEAT-001 — DB types + Staff groups + Media attachments

**Items covered:** #1 (Saved staff groups), #2 (Rich notes + GIF/image attachments)

### Files to create

```
supabase/migrations/20261023000011_staff_groups.sql
supabase/migrations/20261023000012_feedback_media.sql
src/app/api/pulse/staff-groups/route.ts
src/features/settings/components/StaffGroupsClient.tsx
src/features/settings/components/StaffGroupsPage.tsx
src/app/(app)/settings/staff-groups/page.tsx
```

### Files to modify

```
src/types/database.ts          — add all new table types (staff_groups, media_url on feedback,
                                  reward_wallets, reward_ledger, reward_catalogue,
                                  reward_redemptions, milestones, automation_rules,
                                  engagement_notification_preferences + type aliases)
src/lib/rbac.ts                — add manage_rewards, manage_automations permissions
src/features/settings/components/SettingsShell.tsx  — add Staff Groups nav item
src/features/pulse/feedback/components/SendFeedbackForm.tsx  — add groups prop + media field
src/features/pulse/feedback/components/FeedbackPage.tsx      — fetch + pass groups
src/features/pulse/feedback/components/FeedbackWall.tsx      — render media_url img
src/app/api/pulse/feedback/route.ts                          — accept + insert media_url
```

### Migration SQL

**20261023000011_staff_groups.sql**
```sql
CREATE TABLE IF NOT EXISTS staff_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  member_ids uuid[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE staff_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_staff_groups" ON staff_groups FOR ALL TO anon USING (false);
GRANT ALL ON staff_groups TO service_role;
```

**20261023000012_feedback_media.sql**
```sql
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS media_url text;
```

### TypeScript types to add to `src/types/database.ts`

Add at the top of the file alongside other union types:
```typescript
export type RedemptionStatus = "pending" | "approved" | "fulfilled" | "rejected";
export type MilestoneType = "work_anniversary" | "birthday" | "onboarding_complete" | "service_achievement";
export type AutomationTrigger = "milestone_anniversary" | "campaign_start" | "quest_ends_soon" | "recognition_received";
export type AutomationAction = "send_notification" | "award_points";
```

Add inside `Database["public"]["Tables"]`:
```typescript
staff_groups: {
  Row: { id: string; name: string; member_ids: string[]; created_by: string; created_at: string };
  Insert: Omit<...["staff_groups"]["Row"], "id" | "created_at">;
  Update: Partial<{ name: string; member_ids: string[] }>;
  Relationships: [];
};
engagement_notification_preferences: {
  Row: { user_id: string; show_on_leaderboard: boolean; campaign_updates: boolean; side_quest_updates: boolean; created_at: string; updated_at: string };
  Insert: { user_id: string; show_on_leaderboard?: boolean; campaign_updates?: boolean; side_quest_updates?: boolean };
  Update: Partial<...["engagement_notification_preferences"]["Insert"]>;
  Relationships: [];
};
reward_wallets: {
  Row: { user_id: string; balance: number; updated_at: string };
  Insert: { user_id: string; balance?: number };
  Update: { balance?: number };
  Relationships: [];
};
reward_ledger: {
  Row: { id: string; user_id: string; amount: number; reason: string; reference_type: string | null; reference_id: string | null; created_by: string | null; created_at: string };
  Insert: Omit<...["reward_ledger"]["Row"], "id" | "created_at"> & { reference_type?: string | null; reference_id?: string | null; created_by?: string | null };
  Update: never;
  Relationships: [];
};
reward_catalogue: {
  Row: { id: string; name: string; description: string | null; points_cost: number; image_url: string | null; is_active: boolean; created_at: string };
  Insert: Omit<...["reward_catalogue"]["Row"], "id" | "created_at" | "description" | "image_url" | "is_active"> & { description?: string | null; image_url?: string | null; is_active?: boolean };
  Update: Partial<...["reward_catalogue"]["Insert"]>;
  Relationships: [];
};
reward_redemptions: {
  Row: { id: string; user_id: string; catalogue_item_id: string; points_spent: number; status: RedemptionStatus; approved_by: string | null; fulfilled_at: string | null; notes: string | null; created_at: string };
  Insert: Omit<...["reward_redemptions"]["Row"], "id" | "created_at" | "status" | "approved_by" | "fulfilled_at" | "notes"> & { status?: RedemptionStatus; approved_by?: string | null; fulfilled_at?: string | null; notes?: string | null };
  Update: Partial<{ status: RedemptionStatus; approved_by: string | null; fulfilled_at: string | null; notes: string | null }>;
  Relationships: [];
};
milestones: {
  Row: { id: string; user_id: string; type: MilestoneType; milestone_date: string; years_count: number | null; acknowledged: boolean; created_at: string };
  Insert: Omit<...["milestones"]["Row"], "id" | "created_at" | "acknowledged" | "years_count"> & { acknowledged?: boolean; years_count?: number | null };
  Update: Partial<{ acknowledged: boolean }>;
  Relationships: [];
};
automation_rules: {
  Row: { id: string; trigger_type: AutomationTrigger; action_type: AutomationAction; config: Record<string, unknown>; is_active: boolean; created_by: string; created_at: string };
  Insert: Omit<...["automation_rules"]["Row"], "id" | "created_at" | "config" | "is_active"> & { config?: Record<string, unknown>; is_active?: boolean };
  Update: Partial<{ config: Record<string, unknown>; is_active: boolean }>;
  Relationships: [];
};
```

Add `media_url: string | null;` to feedback.Row and `media_url?: string | null;` to feedback.Insert.

Add type aliases at the bottom:
```typescript
export type StaffGroup = Database["public"]["Tables"]["staff_groups"]["Row"];
export type RewardWallet = Database["public"]["Tables"]["reward_wallets"]["Row"];
export type RewardLedger = Database["public"]["Tables"]["reward_ledger"]["Row"];
export type RewardCatalogue = Database["public"]["Tables"]["reward_catalogue"]["Row"];
export type RewardRedemption = Database["public"]["Tables"]["reward_redemptions"]["Row"];
export type Milestone = Database["public"]["Tables"]["milestones"]["Row"];
export type AutomationRule = Database["public"]["Tables"]["automation_rules"]["Row"];
export type EngagementNotificationPreferences = Database["public"]["Tables"]["engagement_notification_preferences"]["Row"];
```

### RBAC additions (`src/lib/rbac.ts`)

In `Permission` union type add:
```typescript
| "manage_rewards"
| "manage_automations"
```

In `PERMISSION_MAP` add:
```typescript
manage_rewards:      ["admin", "hr"],
manage_automations:  ["admin", "hr"],
```

### API route: `src/app/api/pulse/staff-groups/route.ts`

- **GET**: `getServerSession` → 401 if none. `supabaseAdmin.from('staff_groups').select('*').order('name')`. Return array.
- **POST**: session required. Body `{ name, member_ids }`. Validate: name non-empty, member_ids ≥ 2 items, all valid active user UUIDs. Insert with `created_by = session.user.id`. Return `{ id }`.
- **DELETE**: session required. Body `{ id }`. Verify `created_by = session.user.id` OR `can(role, 'manage_recognition_campaigns')`. Delete.

### UI: `StaffGroupsClient.tsx`

Client component. Props: `{ initial: StaffGroup[]; users: { id: string; name: string }[] }`.
- List groups with name, member count, delete button.
- 'New group' button → SimpleModal with name input + `<select multiple>` of users.
- Save → POST `/api/pulse/staff-groups`. Delete → DELETE same route. router.refresh() on both.
- Pattern: follow `DepartmentsClient.tsx` (useState + useTransition + toast).

### UI: `StaffGroupsPage.tsx`

Server component. Requires `can(role, 'manage_recognition_campaigns')` (redirect `/settings` otherwise).
Fetches groups + active users. Renders `SetPageHeader` + `StaffGroupsClient`.

### Settings nav addition (`SettingsShell.tsx` → `SETTINGS_NAV`)

Under `Organization`:
```typescript
{ id: "staff-groups", label: "Staff Groups", icon: "solar:users-group-rounded-broken", href: "/settings/staff-groups" }
```

### SendFeedbackForm changes

1. Add prop `groups: { id: string; name: string; member_ids: string[] }[]` to Props.
2. Add `recipientMode` state (`'individual' | 'group'`, default `'individual'`).
3. When `visibility === 'public'` and `groups.length > 0`: show two sub-tab buttons before the recipient select (Individual / Staff group). Toggle `recipientMode`.
4. When `recipientMode === 'group'`: show group select; on change call `setRecipientIds(group.member_ids)`.
5. Add `mediaUrl` state, optional text input + Giphy search (8 results from `https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=QUERY&limit=8&rating=g`), thumbnail grid.
6. Add `media_url: mediaUrl || null` to POST body.

### FeedbackPage changes

Add `supabaseAdmin.from('staff_groups').select('id,name,member_ids')` query. Pass result as `groups` prop to `SendFeedbackForm`.

### feedback/route.ts changes

Accept `media_url` from request body. Pass `media_url: media_url ?? null` to the feedback insert.

### FeedbackWall changes

After the message paragraph inside each article:
```tsx
{item.media_url && (
  <img src={item.media_url} alt="" className="mt-3 max-h-48 w-full rounded-xl object-cover" loading="lazy" />
)}
```

**Verify:** `npx tsc --noEmit`

---

## FEAT-002 — Notification templates + Engagement calendar actions + Reminders cron

**Items covered:** #3 (Engagement calendar actions), #4 (Participant reminders + completion digest), #8 (Notification templates)

### Files to create

```
src/lib/notifications.ts
src/app/api/pulse/notifications/reminders/route.ts
```

### Files to modify

```
vercel.json
src/features/pulse/engagement-calendar/components/EngagementCalendarPage.tsx
```

### `src/lib/notifications.ts`

Plain server-only module (not a Server Action file). Exports:
- `notifyRecognitionReceived(userId, fromName, message)` — inserts into notifications table with link `/pulse/feedback`
- `notifyMilestone(userId, type, years?)` — formats label by type, inserts
- `notifyCampaignLive(userId, campaignName)` — inserts with link `/pulse/campaigns`
- `notifyQuestEndingSoon(userId, questTitle, endsAt)` — formats date, inserts
- `notifySurveyClosingSoon(userId, surveyTitle, closesAt)` — formats date, inserts
- `notifyWeeklyDigest(userId, { questsCompleted, recognitionReceived })` — only inserts if either > 0

All use `supabaseAdmin.from('notifications').insert(...)`.

### `src/app/api/pulse/notifications/reminders/route.ts` (POST)

```typescript
// Auth check
const authHeader = request.headers.get('Authorization');
if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

Logic:
1. Quests ending within 48h → `notifyQuestEndingSoon` for each eligible user
2. Surveys closing within 48h → `notifySurveyClosingSoon` for all active users
3. Weekly digest per user (count feedback_recipients + side_quest_completions in current week)

### `vercel.json`

```json
{
  "crons": [
    { "path": "/api/pulse/notifications/reminders", "schedule": "0 8 * * 1" },
    { "path": "/api/pulse/milestones/generate", "schedule": "0 7 * * *" },
    { "path": "/api/pulse/automations/run", "schedule": "0 9 * * *" }
  ]
}
```

### `EngagementCalendarPage.tsx` changes

Since this is a server component that can import client components, extend it to:
1. Add `getServerSession` + `can()` checks.
2. Fetch additional props needed by action buttons: `recognition_values` (for NewCampaignButton), audience options (for NewSideQuestButton), `surveys` status list (NewSurveyButton just needs `userId`).
3. Conditionally render buttons in a `<div className="flex gap-2 flex-wrap mb-4">` placed between SetPageHeader and the stat cards.
4. Add `ArchiveItemButton` — a small `"use client"` component (same file or separate) that POSTs to the correct PATCH route on click and calls `router.refresh()`. Render it on timeline items where `item.end && new Date(item.end) < new Date() && !['archived','closed','completed'].includes(item.status)`.

The PATCH endpoints already exist: `/api/pulse/campaigns/[id]` (check its handler) and `/api/pulse/side-quests` (check if PATCH exists — if not, extend side-quests route to handle status updates). Check `src/app/api/pulse/campaigns/[id]/route.ts` before implementing.

**Verify:** `npx tsc --noEmit`

---

## FEAT-003 — Migrations 13–15 + Rewards + Milestones + Automation rules

**Items covered:** #5 (Reward catalogue + redemption), #6 (Milestones), #7 (Automation rules)

### Files to create

```
supabase/migrations/20261023000013_rewards.sql
supabase/migrations/20261023000014_milestones.sql
supabase/migrations/20261023000015_automation_rules.sql
src/app/api/pulse/rewards/catalogue/route.ts
src/app/api/pulse/rewards/redeem/route.ts
src/app/api/pulse/rewards/redemptions/[id]/route.ts
src/app/api/pulse/milestones/generate/route.ts
src/app/api/pulse/automations/run/route.ts
src/app/api/pulse/automations/rules/route.ts
src/app/api/pulse/automations/rules/[id]/route.ts
src/features/pulse/rewards/components/RewardsPage.tsx
src/features/pulse/rewards/components/RedeemButton.tsx
src/features/pulse/rewards/components/RedemptionActions.tsx
src/features/pulse/dashboard/components/MilestonesWidget.tsx
src/features/settings/components/AutomationsClient.tsx
src/features/settings/components/AutomationsPage.tsx
src/app/(app)/pulse/rewards/page.tsx
src/app/(app)/settings/automations/page.tsx
```

### Files to modify

```
src/lib/nav.ts                                        — add Rewards entry
src/features/pulse/dashboard/components/PulseDashboard.tsx  — add MilestonesWidget
src/features/settings/components/SettingsShell.tsx    — add Automations nav entry
```

### Migration SQL summaries

**20261023000013_rewards.sql**: reward_catalogue + reward_redemptions tables with indexes, RLS, service_role grants. (Full SQL in FEAT-003.json step 1.)

**20261023000014_milestones.sql**: milestones table with unique index on (user_id, type, milestone_date), RLS, grants. (Full SQL in FEAT-003.json step 2.)

**20261023000015_automation_rules.sql**: automation_rules table with RLS, grants. (Full SQL in FEAT-003.json step 3.)

### Rewards API routes

- `GET /api/pulse/rewards/catalogue` → active items, session required
- `POST /api/pulse/rewards/catalogue` → requires `manage_rewards`; body: `{ name, description?, points_cost, image_url? }`
- `POST /api/pulse/rewards/redeem` → session; validate balance ≥ cost; insert redemption + deduct wallet + ledger entry
- `PATCH /api/pulse/rewards/redemptions/[id]` → requires `manage_rewards`; update status/notes/approved_by

### Rewards UI (`RewardsPage.tsx`)

Server component:
- Fetch wallet balance, active catalogue, user redemption history
- HR/admin: also fetch pending redemptions from all users
- Render: SetPageHeader + wallet StatCard + catalogue grid + history table + (HR) pending redemptions section
- `RedeemButton` client component: disabled if balance < cost; POST to `/api/pulse/rewards/redeem`; router.refresh() on success
- `RedemptionActions` client component: approve/reject buttons → PATCH route

### Nav addition (`src/lib/nav.ts`)

In `Kazi Pulse` items after `leaderboards`:
```typescript
{ href: "/pulse/rewards", icon: "solar:gift-broken", label: "Rewards" }
```

### Milestones generate route

`POST /api/pulse/milestones/generate` — CRON_SECRET Bearer auth. Scans users with start_date, upserts work anniversary milestones for next 7 days; upserts onboarding_complete for recently created users with a check-in.

### `MilestonesWidget.tsx`

Async server component. Fetches next 5 milestones with user name. Renders as a section card with Solar icons per type. Import in `PulseDashboard.tsx` (render for `isManager` only).

### Automation rules routes

- `GET /api/pulse/automations/rules` → list, requires `manage_automations`
- `POST /api/pulse/automations/rules` → create, requires `manage_automations`
- `PATCH /api/pulse/automations/rules/[id]` → update is_active/config

### Automation run route

`POST /api/pulse/automations/run` — CRON_SECRET auth. Fetches active rules, executes supported rule types using notification helpers from `src/lib/notifications.ts`.

### AutomationsClient + AutomationsPage

Client component (toggle + new rule modal via SimpleModal). Settings page server component (guards with `manage_automations`). Page at `/settings/automations`.

### Settings nav addition

Under `Organization` in `SETTINGS_NAV`:
```typescript
{ id: "automations", label: "Automations", icon: "solar:bolt-circle-broken", href: "/settings/automations" }
```

**Verify:** `npx tsc --noEmit`

---

## FEAT-004 — Recognition analytics page

**Item covered:** #9 (Recognition analytics page)

### Files to create

```
src/features/pulse/analytics/components/RecognitionAnalyticsSection.tsx
src/features/pulse/analytics/components/RecognitionTrendChart.tsx
src/features/pulse/analytics/components/RecognitionAnalyticsFilters.tsx
src/features/pulse/analytics/components/RecognitionAnalyticsPage.tsx
```

### Files to modify

```
src/app/(app)/pulse/analytics/page.tsx   — compose LeadershipDashboard + RecognitionAnalyticsPage
```

### `RecognitionAnalyticsSection.tsx` (server, async)

Props: `{ since: Date; departmentFilter?: string; campaignId?: string }`

Queries:
1. Top 5 givers: aggregate `feedback` (visibility=public, since) by `from_user_id`
2. Top 5 receivers: aggregate `feedback_recipients` (filtered via feedback IDs in period) by `user_id`
3. Value distribution: all active recognition_values + count feedback per value in period
4. Weekly trend: feedback rows last 8 weeks grouped by ISO week in TypeScript
5. Cross-team reach: distinct departments from recipient users

Renders: StatCards row + top givers list + top receivers list + `SurveyDistributionChart` for value distribution + `RecognitionTrendChart` for trend.

### `RecognitionTrendChart.tsx` (client)

Simple `"use client"` AreaChart from recharts. Props: `{ data: { week: string; count: number }[] }`.

### `RecognitionAnalyticsFilters.tsx` (client)

Props: `{ departments, campaigns, currentRange, currentDept, currentCampaign }`. Three selects that push URL searchParams via `useRouter().push(...)`.

### `RecognitionAnalyticsPage.tsx` (server, async)

Props: `{ searchParams: { range?: string; dept?: string; campaign?: string } }`. Auth guard (`view_analytics`). Parses since date. Fetches departments + campaigns for filter. Renders filters + section.

### `src/app/(app)/pulse/analytics/page.tsx` update

```typescript
import LeadershipDashboard from '@/features/pulse/analytics/components/LeadershipDashboard';
import RecognitionAnalyticsPage from '@/features/pulse/analytics/components/RecognitionAnalyticsPage';

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; dept?: string; campaign?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="space-y-8">
      <LeadershipDashboard />
      <RecognitionAnalyticsPage searchParams={params} />
    </div>
  );
}
```

> **Note:** In Next.js 16 App Router, `searchParams` prop on pages is a `Promise` — must be awaited. `LeadershipDashboard` manages its own auth internally.

**Verify:** `npx tsc --noEmit`

---

## FEAT-005 — Culture health widget + Exportable culture report

**Items covered:** #10 (Culture health indicators), #11 (Exportable culture report)

### Files to create

```
src/features/pulse/dashboard/components/CultureHealthWidget.tsx
src/app/api/pulse/reports/culture-export/route.ts
src/features/pulse/analytics/components/ExportReportButton.tsx
```

### Files to modify

```
src/features/pulse/dashboard/components/PulseDashboard.tsx       — add CultureHealthWidget
src/features/pulse/analytics/components/RecognitionAnalyticsPage.tsx  — add export button
```

### `CultureHealthWidget.tsx` (server, async)

Queries for last 30 days:
- Active staff count
- Distinct recognition givers count → if < 30% of staff → yellow warning
- Values with 0 uses in period → neglected values list
- Live campaigns with no recognition in last 7 days → drop-off campaigns
- Departments with no check-in submissions in last 14 days

Builds `{ label, status: 'green'|'yellow'|'red', description }[]` indicators. Renders "Culture health" section with colored indicator chips.

Add to `PulseDashboard.tsx` for managers: import + render after the milestones widget.

### `src/app/api/pulse/reports/culture-export/route.ts` (GET)

Auth: `getServerSession` + `can(role, 'view_analytics')` → 403 if not.

Accepts `?format=json` (default) or `?format=csv`.

Gathers: campaign summary, recognition summary (total, top values, top givers), voice out themes, survey participation, engagement trend (12 weeks weekly check-in count).

Returns JSON with `Content-Disposition: attachment` or CSV (flat key-value structure).

### `ExportReportButton.tsx` (client)

Fetches `/api/pulse/reports/culture-export`, downloads blob. Rendered in `RecognitionAnalyticsPage.tsx` below the SetPageHeader.

**Verify:** `npx tsc --noEmit`

---

## FEAT-006 — Privacy-safe leaderboard extensions

**Item covered:** #12 (Privacy-safe top-contributor leaderboards)

### Files to create

```
supabase/migrations/20261023000016_leaderboard_opt_in.sql
src/app/api/pulse/notifications/preferences/route.ts
```

### Files to modify

```
src/features/pulse/leaderboards/components/LeaderboardsPage.tsx
src/features/settings/components/NotificationsClient.tsx
src/types/database.ts  — (already done in FEAT-001; engagement_notification_preferences has show_on_leaderboard)
```

### Migration SQL

**20261023000016_leaderboard_opt_in.sql**
```sql
CREATE TABLE IF NOT EXISTS engagement_notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  show_on_leaderboard boolean NOT NULL DEFAULT true,
  campaign_updates boolean NOT NULL DEFAULT true,
  side_quest_updates boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Idempotent if table already exists with different columns
ALTER TABLE engagement_notification_preferences ADD COLUMN IF NOT EXISTS show_on_leaderboard boolean NOT NULL DEFAULT true;
ALTER TABLE engagement_notification_preferences ADD COLUMN IF NOT EXISTS campaign_updates boolean NOT NULL DEFAULT true;
ALTER TABLE engagement_notification_preferences ADD COLUMN IF NOT EXISTS side_quest_updates boolean NOT NULL DEFAULT true;
ALTER TABLE engagement_notification_preferences ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'engagement_notification_preferences' AND policyname = 'anon_no_access_engagement_notification_preferences') THEN
    CREATE POLICY "anon_no_access_engagement_notification_preferences" ON engagement_notification_preferences FOR ALL TO anon USING (false);
  END IF;
END $$;
GRANT ALL ON engagement_notification_preferences TO service_role;
```

### `LeaderboardsPage.tsx` additions

1. Fetch opted-in user IDs: `supabaseAdmin.from('engagement_notification_preferences').select('user_id').eq('show_on_leaderboard', true)` → build `optedInIds: Set<string>`. If empty set (no prefs stored), allow all (default `true` means everyone is opted in by default).
2. Fetch recognition givers: `supabaseAdmin.from('feedback').select('from_user_id').eq('visibility','public').gte('created_at', since.toISOString())` — filter to optedInIds before calling `leaders()`.
3. Fetch recognition receivers: first fetch `feedback` IDs in period, then `supabaseAdmin.from('feedback_recipients').select('user_id').in('feedback_id', feedbackIds)` — filter to optedInIds.
4. Campaign participation: `supabaseAdmin.from('feedback').select('from_user_id, campaign_id').eq('visibility','public').not('campaign_id','is',null).gte('created_at',since.toISOString())` — deduplicate (user_id, campaign_id) pairs in TS, then count distinct campaigns per user, filter to optedInIds.
5. Add to the `enabled` boards section below existing boards:
   ```tsx
   <Board title="Recognition givers" icon="solar:star-fall-broken" items={recognitionGivers} label="shout-outs" />
   <Board title="Recognition receivers" icon="solar:heart-broken" items={recognitionReceivers} label="received" />
   <Board title="Campaign participation" icon="solar:medal-ribbon-broken" items={campaignParticipants} label="campaigns" />
   ```

### `/api/pulse/notifications/preferences/route.ts` (PATCH)

Session required. Body: `{ show_on_leaderboard?, campaign_updates?, side_quest_updates? }`. Upsert into `engagement_notification_preferences`.

### `NotificationsClient.tsx` addition

Add "Leaderboard visibility" section with a toggle for `show_on_leaderboard`. PATCH `/api/pulse/notifications/preferences` on change.

**Verify:** `npx tsc --noEmit`

---

## Dependency graph

```
FEAT-001 (DB types, staff groups, media)
    ├── FEAT-002 (notifications lib, calendar actions, cron)
    ├── FEAT-003 (rewards, milestones, automations)
    ├── FEAT-004 (recognition analytics)
    ├── FEAT-005 (culture health, export)
    └── FEAT-006 (leaderboard extensions)
```

All FEATs must leave the codebase in a buildable state. Run `npx tsc --noEmit` after each.
