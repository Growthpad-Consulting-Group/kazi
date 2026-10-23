# Implementation Plan — Four Features

_Grounded in codebase exploration as of the plan date. All file paths verified to exist or confirmed absent._

---

## Key facts established during exploration

- **Next.js 16.4.2**, App Router, TypeScript, Supabase service-role client (`supabaseAdmin`), NextAuth v4 JWT sessions.
- **Auth pattern**: `getServerSession(authOptions)` → 401 if no session; `can(session.user.role, 'permission')` → 403 if unauthorized. Permissions defined in `src/lib/rbac.ts`.
- **Route context pattern**: `type RouteContext = { params: Promise<{ id: string }> }` — params is a Promise in Next.js 16.
- **Migration naming**: last existing is `20261023000016_leaderboard_opt_in.sql`. Next sequential numbers: `20261023000017`, `20261023000018`.
- **`side_quests` table has no `points` column** (confirmed in migration 20261023000007). Use default of 10 points.
- **Wallet award pattern** (from `redeem/route.ts`): upsert wallet row → update balance → insert ledger entry.
- **IntegrationCard**: existing reusable component in `IntegrationsClient.tsx` accepts `status`, `onConnect`, `onDisconnect`.
- **`manage_system` permission** gates integration management (admin + hr).
- **`manage_rewards` permission** gates reward administration (admin + hr).

---

## FEAT-001 — Slack Incoming Webhook Integration

### Files to create
- `supabase/migrations/20261023000017_slack_connections.sql`
- `src/lib/slack.ts`
- `src/app/api/integrations/slack/connect/route.ts`
- `src/app/api/integrations/slack/disconnect/route.ts`
- `src/app/api/integrations/slack/status/route.ts`

### Files to modify
- `.env.local` — add `SLACK_WEBHOOK_URL=` placeholder
- `src/types/database.ts` — add `slack_connections` table definition + `SlackConnection` export
- `src/features/settings/components/IntegrationsClient.tsx` — add Slack state + connect modal + real integration card
- `src/app/(app)/settings/integrations/page.tsx` — query slack status, pass as prop

---

- [ ] 1. **DB migration for `slack_connections`**
      Create `supabase/migrations/20261023000017_slack_connections.sql`:
      ```sql
      CREATE TABLE IF NOT EXISTS slack_connections (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        webhook_url text NOT NULL,
        channel_name text NOT NULL,
        created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TRIGGER slack_connections_updated_at BEFORE UPDATE ON slack_connections
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      ALTER TABLE slack_connections ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "anon_no_access_slack_connections" ON slack_connections FOR ALL TO anon USING (false);
      GRANT ALL ON slack_connections TO service_role;
      ```
      Files: `supabase/migrations/20261023000017_slack_connections.sql`
      Verify: `npm run build` — no TypeScript errors introduced yet.

- [ ] 2. **Add `SlackConnection` type to `src/types/database.ts`**
      Add to `Database.public.Tables`:
      ```ts
      slack_connections: {
        Row: { id: string; webhook_url: string; channel_name: string; created_by: string; created_at: string; updated_at: string };
        Insert: Omit<..Row, "id" | "created_at" | "updated_at">;
        Update: Partial<{ webhook_url: string; channel_name: string }>;
        Relationships: [];
      };
      ```
      Add at bottom: `export type SlackConnection = Database["public"]["Tables"]["slack_connections"]["Row"];`
      Files: `src/types/database.ts`
      Verify: `npm run build` — passes.

- [ ] 3. **Create `src/lib/slack.ts`**
      ```ts
      import { supabaseAdmin } from "@/lib/supabase";

      export async function postSlackMessage(text: string, blocks?: object[]): Promise<void> {
        let webhookUrl: string | null = null;
        const { data } = await supabaseAdmin.from("slack_connections").select("webhook_url").limit(1).maybeSingle();
        webhookUrl = data?.webhook_url ?? process.env.SLACK_WEBHOOK_URL ?? null;
        if (!webhookUrl) return; // no-op
        try {
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, ...(blocks ? { blocks } : {}) }),
          });
        } catch (e) {
          console.error("[Slack] postSlackMessage failed:", e);
        }
      }
      ```
      Files: `src/lib/slack.ts`
      Verify: `npm run build` — no errors.

- [ ] 4. **Add `SLACK_WEBHOOK_URL=` placeholder to `.env.local`**
      Add before the `# ─── Cron` section:
      ```
      # ─── Slack ─────────────────────────────────────────────────────────────────
      SLACK_WEBHOOK_URL=
      ```
      Files: `.env.local`
      Verify: File has the key; `npm run build` unaffected.

- [ ] 5. **Create `POST /api/integrations/slack/connect`**
      `src/app/api/integrations/slack/connect/route.ts`:
      - Auth: `getServerSession` + `can(role, "manage_system")` → 403 if not.
      - Parse body `{ webhook_url, channel_name }`.
      - Validate: `webhook_url` must start with `https://hooks.slack.com/` — return 400 otherwise.
      - Delete any existing `slack_connections` row; insert new row with `created_by: session.user.id`.
      - Return `{ ok: true }`.
      Files: `src/app/api/integrations/slack/connect/route.ts`
      Verify: `npm run build` — no errors.

- [ ] 6. **Create `DELETE /api/integrations/slack/disconnect`**
      `src/app/api/integrations/slack/disconnect/route.ts`:
      - Auth: `getServerSession` + `can(role, "manage_system")`.
      - `DELETE FROM slack_connections` (no WHERE — clears the single org row).
      - Return `{ ok: true }`.
      Files: `src/app/api/integrations/slack/disconnect/route.ts`
      Verify: `npm run build` — no errors.

- [ ] 7. **Create `GET /api/integrations/slack/status`**
      `src/app/api/integrations/slack/status/route.ts`:
      - Auth: `getServerSession` → 401 if not.
      - `SELECT channel_name FROM slack_connections LIMIT 1`.
      - Return `{ connected: Boolean(row), channel_name: row?.channel_name ?? null }`.
      Files: `src/app/api/integrations/slack/status/route.ts`
      Verify: `npm run build` — no errors.

- [ ] 8. **Update `IntegrationsClient.tsx` — move Slack to real integration**
      Changes:
      - Add `slackStatus: { connected: boolean; channelName: string | null }` to `Props`.
      - Add local state: `slackConnected`, `slackChannel`, `showSlackModal`, `slackWebhookInput`, `slackChannelInput`.
      - Add `connectSlack` function: POST `/api/integrations/slack/connect`, on success set `slackConnected(true)`, close modal.
      - Add `disconnectSlack` function: DELETE `/api/integrations/slack/disconnect`, on success set `slackConnected(false)`.
      - Add a new `<SettingsSection title="Messaging" description="Connect messaging tools for automated notifications" icon="logos:slack-icon">` section before "Coming soon".
      - Inside it, render `<IntegrationCard>` for Slack with `status={slackConnected ? "connected" : "disconnected"}`, `meta={slackConnected ? Slack channel: #${slackChannel} : undefined}`, `onConnect={() => setShowSlackModal(true)}`, `onDisconnect={disconnectSlack}`.
      - Add a `<SimpleModal open={showSlackModal} onClose={() => setShowSlackModal(false)} title="Connect Slack" icon="logos:slack-icon">` with two inputs (Webhook URL, Channel name) and a connect button.
      - Remove Slack from the "Coming soon" grid.
      Files: `src/features/settings/components/IntegrationsClient.tsx`
      Verify: `npm run build` — no errors.

- [ ] 9. **Update `settings/integrations/page.tsx` to pass Slack status**
      - Query `slack_connections` for one row.
      - Pass `slackStatus={{ connected: Boolean(slackRow), channelName: slackRow?.channel_name ?? null }}` to `<IntegrationsClient>`.
      Files: `src/app/(app)/settings/integrations/page.tsx`
      Verify: `npm run build` — exits 0. Full FEAT-001 complete.

---

## FEAT-002 — Reward Points Awarding

### Files to create
- `src/lib/award-points.ts`
- `src/app/api/pulse/rewards/grant/route.ts`
- `src/features/staff/components/GrantPointsModal.tsx`

### Files to modify
- `src/app/api/pulse/automations/run/route.ts` — add `award_points` branch
- `src/app/api/pulse/feedback/route.ts` — award +5 on public recognition
- `src/app/api/pulse/side-quests/[id]/progress/route.ts` — award +10 on quest completion
- `src/app/api/pulse/checkins/route.ts` — award +2 on check-in submitted
- `src/features/staff/components/EmployeeProfilePage.tsx` — add Grant Points button

---

- [ ] 10. **Create `src/lib/award-points.ts`**
      ```ts
      import { supabaseAdmin } from "@/lib/supabase";

      interface AwardPointsArgs {
        userId: string;
        amount: number;
        reason: string;
        referenceType?: string;
        referenceId?: string;
        createdBy?: string;
      }

      export async function awardPoints({ userId, amount, reason, referenceType, referenceId, createdBy }: AwardPointsArgs): Promise<void> {
        // Ensure wallet exists
        await supabaseAdmin.from("reward_wallets").upsert({ user_id: userId, balance: 0 }, { onConflict: "user_id", ignoreDuplicates: true });
        // Increment balance
        const { data: wallet } = await supabaseAdmin.from("reward_wallets").select("balance").eq("user_id", userId).single();
        await supabaseAdmin.from("reward_wallets").update({ balance: (wallet?.balance ?? 0) + amount }).eq("user_id", userId);
        // Ledger entry
        await supabaseAdmin.from("reward_ledger").insert({
          user_id: userId,
          amount,
          reason,
          reference_type: referenceType ?? null,
          reference_id: referenceId ?? null,
          created_by: createdBy ?? null,
        });
      }
      ```
      Files: `src/lib/award-points.ts`
      Verify: `npm run build` — no errors.

- [ ] 11. **Add `award_points` branch to automations runner**
      In `src/app/api/pulse/automations/run/route.ts`, after the existing `milestone_anniversary → send_notification` block, add:
      ```ts
      if (rule.trigger_type === "milestone_anniversary" && rule.action_type === "award_points") {
        const pts = Number(rule.config.points ?? 50);
        for (const type of ["work_anniversary", "service_achievement"] as const) {
          const { data: milestones } = await supabaseAdmin
            .from("milestones")
            .select("user_id, years_count")
            .eq("milestone_date", todayStr)
            .eq("type", type);
          for (const milestone of milestones ?? []) {
            await awardPoints({ userId: milestone.user_id, amount: pts, reason: `${type.replace("_"," ")} award`, referenceType: "milestone", createdBy: undefined });
            processed++;
          }
        }
      }
      ```
      Import `awardPoints` at top.
      Files: `src/app/api/pulse/automations/run/route.ts`
      Verify: `npm run build` — no errors.

- [ ] 12. **Award +5 points in feedback route on public recognition**
      In `src/app/api/pulse/feedback/route.ts`, after `if (visibility === "public") await invalidatePublicFeedback();`, add:
      ```ts
      if (visibility === "public") {
        try {
          await awardPoints({ userId: from_user_id, amount: 5, reason: "Public recognition given", referenceType: "feedback", referenceId: feedback.id });
        } catch { /* non-blocking */ }
      }
      ```
      Import `awardPoints` at top.
      Files: `src/app/api/pulse/feedback/route.ts`
      Verify: `npm run build` — no errors.

- [ ] 13. **Award +10 points in side quest completion**
      In `src/app/api/pulse/side-quests/[id]/progress/route.ts`, after the successful upsert `if (error) return ...`, add before final `return NextResponse.json({ ok: true })`:
      ```ts
      try {
        await awardPoints({ userId: session.user.id, amount: 10, reason: "Side quest completed", referenceType: "side_quest_completion", referenceId: id });
      } catch { /* non-blocking */ }
      ```
      Import `awardPoints`.
      Files: `src/app/api/pulse/side-quests/[id]/progress/route.ts`
      Verify: `npm run build` — no errors.

- [ ] 14. **Award +2 points in check-in route on submission**
      In `src/app/api/pulse/checkins/route.ts`, after `await invalidateUserCheckins(userId);`, add:
      ```ts
      if (status === "submitted") {
        try {
          await awardPoints({ userId, amount: 2, reason: "Check-in submitted", referenceType: "checkin", referenceId: weekStart });
        } catch { /* non-blocking */ }
      }
      ```
      Import `awardPoints`.
      Files: `src/app/api/pulse/checkins/route.ts`
      Verify: `npm run build` — no errors.

- [ ] 15. **Create `POST /api/pulse/rewards/grant`**
      `src/app/api/pulse/rewards/grant/route.ts`:
      - Auth: `getServerSession` + `can(role, "manage_rewards")` → 403.
      - Parse `{ user_id, points, reason }`.
      - Validate: UUID regex on `user_id`, `points` is integer 1–10000, `reason` non-empty.
      - Verify user exists and is active.
      - Call `awardPoints({ userId: user_id, amount: points, reason, referenceType: "manual_grant", createdBy: session.user.id })`.
      - Return `{ ok: true }`.
      Files: `src/app/api/pulse/rewards/grant/route.ts`
      Verify: `npm run build` — no errors.

- [ ] 16. **Create `GrantPointsModal` and add Grant Points button to staff profile**
      Create `src/features/staff/components/GrantPointsModal.tsx` as a client component:
      - Props: `{ userId: string; userName: string }`.
      - State: `open`, `points` (number), `reason` (string), `isPending`.
      - Uses `SimpleModal`, `Button`, `toast` — same pattern as `EditStaffModal.tsx`.
      - On save: POST `/api/pulse/rewards/grant` with `{ user_id: userId, points, reason }`.
      - Input validation: points 1–9999, reason non-empty.

      Update `src/features/staff/components/EmployeeProfilePage.tsx`:
      - Import `GrantPointsModal`.
      - When `canManage`, render `<GrantPointsModal userId={user.id} userName={user.name} />` alongside `<EditStaffModal>` in the `trailing` prop of `SetPageHeader`.
      Files: `src/features/staff/components/GrantPointsModal.tsx`, `src/features/staff/components/EmployeeProfilePage.tsx`
      Verify: `npm run build` — exits 0. Full FEAT-002 complete.

---

## FEAT-003 — Birthday DOB + Service Achievement Milestones

### Files to create
- `supabase/migrations/20261023000018_users_dob.sql`

### Files to modify
- `src/types/database.ts` — add `date_of_birth` to users Row/Insert
- `src/features/staff/components/EditStaffModal.tsx` — add DOB field
- `src/features/staff/components/EmployeeProfilePage.tsx` — include DOB in select + display
- `src/app/api/staff/[id]/route.ts` — handle `date_of_birth` in PATCH
- `src/app/api/pulse/milestones/generate/route.ts` — add birthday + service achievement blocks
- `src/app/api/pulse/automations/run/route.ts` — add service_achievement notification branch

---

- [ ] 17. **DB migration: add `date_of_birth` to `users`**
      `supabase/migrations/20261023000018_users_dob.sql`:
      ```sql
      ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth date;
      ```
      Files: `supabase/migrations/20261023000018_users_dob.sql`
      Verify: `npm run build` — no errors.

- [ ] 18. **Update `users` type in `src/types/database.ts`**
      Add `date_of_birth: string | null;` to `Database.public.Tables.users.Row`.
      Add `date_of_birth?: string | null;` to the Insert type.
      (Update is `Partial<Insert>` so it auto-includes it.)
      Files: `src/types/database.ts`
      Verify: `npm run build` — no errors.

- [ ] 19. **Add DOB field to `EditStaffModal.tsx` and update staff PATCH**
      `EditStaffModal.tsx`: Add `date_of_birth: string | null` to `StaffFields`. Add a `Date of birth` input (`type="date"`) below Start date in the form grid. Pass `date_of_birth` in the fetch body.

      `src/app/api/staff/[id]/route.ts`: In the PATCH handler, after the `start_date` block add:
      ```ts
      if (body.date_of_birth !== undefined) { const v = str(body.date_of_birth); if (v !== undefined) patch.date_of_birth = v; }
      ```
      The `patch` record is typed as `Record<string, string | null>` so no TS type change needed — supabaseAdmin cast to `any` already handles it.

      `EmployeeProfilePage.tsx`: Add `date_of_birth: string | null` to local `User` type, add it to the `.select()` string, add `date_of_birth: user.date_of_birth` to `EditStaffModal` initial prop, add `<ProfileRow label="Date of birth" value={relativeDate(user.date_of_birth)} />` in the Employment section.
      Files: `src/features/staff/components/EditStaffModal.tsx`, `src/app/api/staff/[id]/route.ts`, `src/features/staff/components/EmployeeProfilePage.tsx`
      Verify: `npm run build` — no errors.

- [ ] 20. **Add birthday generation block to milestones cron**
      In `src/app/api/pulse/milestones/generate/route.ts`, after the onboarding_complete block:
      ```ts
      // ── 3. Birthdays in the next 7 days ───────────────────────────
      const { data: dobUsers } = await supabaseAdmin
        .from("users")
        .select("id, date_of_birth")
        .eq("is_active", true)
        .not("date_of_birth", "is", null);

      for (const user of dobUsers ?? []) {
        if (!user.date_of_birth) continue;
        const [, dobMonth, dobDay] = user.date_of_birth.split("-").map(Number);
        const birthdayThisYear = new Date(currentYear, dobMonth - 1, dobDay);
        const birthdayStr = birthdayThisYear.toISOString().slice(0, 10);
        if (birthdayThisYear >= today && birthdayThisYear <= windowEnd) {
          const { error } = await supabaseAdmin.from("milestones").upsert(
            { user_id: user.id, type: "birthday", milestone_date: birthdayStr },
            { onConflict: "user_id,type,milestone_date", ignoreDuplicates: true }
          );
          if (!error) created++;
        }
      }
      ```
      Files: `src/app/api/pulse/milestones/generate/route.ts`
      Verify: `npm run build` — no errors.

- [ ] 21. **Add service achievement generation block to milestones cron**
      In `src/app/api/pulse/milestones/generate/route.ts`, after birthday block (still using the `activeUsers` result from block 1):
      ```ts
      // ── 4. Service achievements (1, 3, 5, 10 years) ──────────────────────────
      const SERVICE_MILESTONES = [1, 3, 5, 10];
      for (const user of activeUsers ?? []) {
        if (!user.start_date) continue;
        const [startYear, startMonth, startDay] = user.start_date.split("-").map(Number);
        for (const years of SERVICE_MILESTONES) {
          if (currentYear - startYear !== years) continue;
          const achievementDate = new Date(currentYear, startMonth - 1, startDay);
          const achievementStr = achievementDate.toISOString().slice(0, 10);
          if (achievementDate >= today && achievementDate <= windowEnd) {
            const { error } = await supabaseAdmin.from("milestones").upsert(
              { user_id: user.id, type: "service_achievement", milestone_date: achievementStr, years_count: years },
              { onConflict: "user_id,type,milestone_date", ignoreDuplicates: true }
            );
            if (!error) created++;
          }
        }
      }
      ```
      Files: `src/app/api/pulse/milestones/generate/route.ts`
      Verify: `npm run build` — no errors.

- [ ] 22. **Add `service_achievement` notification branch to automations runner**
      In `src/app/api/pulse/automations/run/route.ts`, inside the `milestone_anniversary → send_notification` block, after the `work_anniversary` milestones query loop, add:
      ```ts
      // service achievements
      const { data: svcMilestones } = await supabaseAdmin
        .from("milestones")
        .select("user_id, years_count")
        .eq("milestone_date", todayStr)
        .eq("type", "service_achievement");
      for (const milestone of svcMilestones ?? []) {
        await notifyMilestone(milestone.user_id, "service_achievement", milestone.years_count ?? undefined);
        processed++;
      }
      ```
      Files: `src/app/api/pulse/automations/run/route.ts`
      Verify: `npm run build` — exits 0. Full FEAT-003 complete.

---

## FEAT-004 — Walk of Fame Page

### Files to create
- `src/features/pulse/walk-of-fame/data.ts`
- `src/features/pulse/walk-of-fame/components/WalkOfFamePage.tsx`
- `src/app/(app)/pulse/walk-of-fame/page.tsx`

### Files to modify
- `src/lib/nav.ts` — add Walk of Fame nav item

---

- [ ] 23. **Create `src/features/pulse/walk-of-fame/data.ts`**
      Export `getWalkOfFameData()` using four parallel Supabase queries:
      1. `feedback_recipients` grouped by `user_id` → all-time count per recipient.
      2. `feedback_recipients` WHERE `created_at >= 30 days ago` → recent receiver set.
      3. `engagement_notification_preferences` WHERE `show_on_leaderboard = false` → opted-out set.
      4. `users` WHERE `is_active = true` SELECT `id, name, department, start_date`.

      Merge in JS:
      - Filter out opted-out users.
      - Join user details onto counts.
      - Compute tenure badge: loop `[10, 5, 3, 1]`, first match wins (years from `start_date` to today).
      - Attach `isRecent` boolean.
      - Sort by count desc, slice top 20.

      Return type:
      ```ts
      interface WalkOfFameEntry {
        id: string;
        name: string;
        department: string | null;
        count: number;
        tenureBadge: "10yr" | "5yr" | "3yr" | "1yr" | null;
        isRecent: boolean;
      }
      ```
      Files: `src/features/pulse/walk-of-fame/data.ts`
      Verify: `npm run build` — no TypeScript errors.

- [ ] 24. **Create `WalkOfFamePage.tsx` server component**
      `src/features/pulse/walk-of-fame/components/WalkOfFamePage.tsx`:
      - Calls `getWalkOfFameData()`.
      - Uses `SetPageHeader` with `title="Walk of Fame"`, `description="All-time recognition champions"`, `icon="solar:cup-star-broken"`.
      - **Podium** (top 3): `flex items-end justify-center gap-4` container. Order: [1] center (gold, taller), [2] left (silver), [3] right (bronze). Each pedestal: avatar initials circle (`h-14 w-14` for 1st, `h-12 w-12` for 2nd/3rd), ring color (`ring-2 ring-amber-400` / `ring-slate-400` / `ring-orange-700`), name, department, count badge.
      - **Ranked list** (4–20): `div.divide-y` with each row `flex items-center gap-4 py-3`. Rank number (mono text), avatar initials circle `h-9 w-9 rounded-full bg-brand-500/10 text-brand-500`, name+dept stack, then badges on the right. Tenure badge: `rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-semibold text-brand-500`. Recency badge: `rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600`. Count: `font-mono text-xs font-bold text-brand-500`.
      - Footer link: `<Link href="/pulse/leaderboards">View 90-day leaderboards →</Link>`.
      - Empty state if data is empty.
      Files: `src/features/pulse/walk-of-fame/components/WalkOfFamePage.tsx`
      Verify: `npm run build` — no errors.

- [ ] 25. **Create `src/app/(app)/pulse/walk-of-fame/page.tsx`**
      ```tsx
      import { getServerSession } from "next-auth";
      import { redirect } from "next/navigation";
      import { authOptions } from "@/lib/auth";
      import WalkOfFamePage from "@/features/pulse/walk-of-fame/components/WalkOfFamePage";

      export default async function WalkOfFameRoute() {
        const session = await getServerSession(authOptions);
        if (!session) redirect("/login");
        return <WalkOfFamePage />;
      }
      ```
      Files: `src/app/(app)/pulse/walk-of-fame/page.tsx`
      Verify: `npm run build` — no errors.

- [ ] 26. **Add Walk of Fame to sidebar nav**
      In `src/lib/nav.ts`, in the `"Kazi Pulse"` group's `items` array, after the leaderboards entry, add:
      ```ts
      { href: "/pulse/walk-of-fame", icon: "solar:cup-star-broken", label: "Walk of Fame" },
      ```
      Files: `src/lib/nav.ts`
      Verify: `npm run build` — exits 0. Full FEAT-004 complete.

---

## Final verification

After all 26 items are complete:
- `npm run build` exits 0 with no TypeScript errors.
- `npm run lint` has no new errors in changed files.
- Migration files: `20261023000017_slack_connections.sql` and `20261023000018_users_dob.sql` exist in `supabase/migrations/`.
- `src/lib/award-points.ts` and `src/lib/slack.ts` are new shared utilities.
- No unrelated files were modified.
