# Implementation Plan — Google Calendar Integration + Slack Notifications

> Structured as two separable features. FEAT-001 (Google Calendar) and FEAT-002 (Slack notifications) are independent and can be implemented sequentially. Full FEAT artifacts live at `.agents/tasks/task-google-calendar-slack/`.

---

## FEAT-001 — Google Calendar Integration

- [ ] 1. Create `supabase/migrations/20261023000019_google_calendar_connections.sql`.
      Table `google_calendar_connections(id uuid PK, user_id uuid FK users.id UNIQUE, access_token_ciphertext text NOT NULL, refresh_token_ciphertext text NOT NULL, token_expiry timestamptz, calendar_id text NOT NULL DEFAULT 'primary', created_at, updated_at)`. RLS: authenticated users own their row; anon no access; service_role full access. set_updated_at trigger (same as `20261023000017_slack_connections.sql`).
      Files: `supabase/migrations/20261023000019_google_calendar_connections.sql`
      Verify: `npx tsc --noEmit` (no new type errors from migration alone).

- [ ] 2. Create `supabase/migrations/20261023000020_one_on_ones_google_event_id.sql`.
      `ALTER TABLE one_on_ones ADD COLUMN IF NOT EXISTS google_event_id text;`
      Files: `supabase/migrations/20261023000020_one_on_ones_google_event_id.sql`
      Verify: file created and valid SQL.

- [ ] 3. Add missing env var placeholders to `.env.local`.
      `GOOGLE_REDIRECT_URI=` and `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY=` (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET already exist).
      Files: `.env.local`
      Verify: placeholders are present.

- [ ] 4. Create `src/lib/google-calendar.ts`.
      Exports: `getGoogleConfig()`, `encryptGoogleToken(value)`, `decryptGoogleToken(value)` (same AES-256-GCM `v1:iv:tag:ciphertext` pattern as `src/lib/asana.ts`), `getGoogleAccessToken(userId)` (reads DB, refreshes token if within 60s of expiry via POST to `https://oauth2.googleapis.com/token`, updates stored ciphertexts), `createCalendarEvent(userId, opts)`, `updateCalendarEvent(userId, eventId, opts)`, `deleteCalendarEvent(userId, eventId)`. All calendar functions use plain `fetch` against Google Calendar REST API. Functions gracefully no-op/return null when user has no `google_calendar_connections` row.
      Files: `src/lib/google-calendar.ts`
      Verify: `npx tsc --noEmit` — no errors in this file.

- [ ] 5. Create `src/app/api/integrations/google-calendar/connect/route.ts`.
      GET handler: auth guard → build Google OAuth URL (`https://accounts.google.com/o/oauth2/v2/auth`) with scopes `https://www.googleapis.com/auth/calendar.events openid email`, `access_type=offline`, `prompt=consent` → store state+returnTo in `kazi_gcal_oauth` cookie (httpOnly, sameSite: lax, maxAge: 10 min) → redirect to Google.
      Files: `src/app/api/integrations/google-calendar/connect/route.ts`
      Verify: `npx tsc --noEmit`.

- [ ] 6. Create `src/app/api/integrations/google-calendar/callback/route.ts`.
      GET handler: validate `kazi_gcal_oauth` cookie + state param → POST to `https://oauth2.googleapis.com/token` (authorization_code) → encrypt tokens → upsert `google_calendar_connections` with `onConflict: 'user_id'` → redirect to `/settings/integrations?google_calendar=connected`. Any error → redirect to `/settings/integrations?google_calendar=error`.
      Files: `src/app/api/integrations/google-calendar/callback/route.ts`
      Verify: `npx tsc --noEmit`.

- [ ] 7. Create `src/app/api/integrations/google-calendar/disconnect/route.ts` and `src/app/api/integrations/google-calendar/status/route.ts`.
      Disconnect: DELETE handler, auth guard, `supabaseAdmin.from('google_calendar_connections').delete().eq('user_id', session.user.id)`.
      Status: GET handler, auth guard, returns `{ connected: boolean, calendar_id: string | null }`.
      Files: `src/app/api/integrations/google-calendar/disconnect/route.ts`, `src/app/api/integrations/google-calendar/status/route.ts`
      Verify: `npx tsc --noEmit`.

- [ ] 8. Update `src/app/api/pulse/one-on-ones/route.ts` (POST).
      After successful insert + cache invalidation: fetch manager and report users. If `scheduledAt` is set, call `createCalendarEvent` (non-blocking try/catch). On success, UPDATE the one_on_ones row with the returned `eventId`.
      Files: `src/app/api/pulse/one-on-ones/route.ts`
      Verify: `npx tsc --noEmit`.

- [ ] 9. Update `src/app/api/pulse/one-on-ones/[id]/route.ts`.
      (a) PATCH: accept `scheduledAt` in body; if present, call `updateCalendarEvent` if `google_event_id` exists or `createCalendarEvent` + UPDATE row if not (non-blocking). (b) Add DELETE handler: fetch existing row, call `deleteCalendarEvent` if `google_event_id` set, delete row, return `{ ok: true }`.
      Files: `src/app/api/pulse/one-on-ones/[id]/route.ts`
      Verify: `npx tsc --noEmit`.

- [ ] 10. Update `src/types/database.ts`.
      (a) Add `google_calendar_connections` table definition (Row/Insert/Update) inside the `Tables` section after `asana_connections`. (b) Add `google_event_id: string | null` to `one_on_ones` Row, and optional `google_event_id?: string | null` to Insert/Update. (c) Add `export type GoogleCalendarConnection = ...` alias near the bottom.
      Files: `src/types/database.ts`
      Verify: `npx tsc --noEmit`.

- [ ] 11. Update `src/app/(app)/settings/integrations/page.tsx`.
      Query `google_calendar_connections` for current user. Pass `googleCalendarStatus={{ connected: Boolean(gcalRow), calendarId: gcalRow?.calendar_id ?? null }}` to `IntegrationsClient`.
      Files: `src/app/(app)/settings/integrations/page.tsx`
      Verify: `npx tsc --noEmit`.

- [ ] 12. Update `src/features/settings/components/IntegrationsClient.tsx`.
      (a) Add `GoogleCalendarStatus` interface and to `Props`. (b) Add state for `googleCalendarConnected` and `googleCalendarId`. (c) Add useEffect branch handling `?google_calendar=connected` / `?google_calendar=error` (same pattern as asana useEffect). (d) Add `connectGoogleCalendar()` and `disconnectGoogleCalendar()` functions. (e) Add a "Productivity" `SettingsSection` with `IntegrationCard` for Google Calendar. (f) Remove Google Calendar from the "Coming soon" grid.
      Files: `src/features/settings/components/IntegrationsClient.tsx`
      Verify: `npx tsc --noEmit`.

---

## FEAT-002 — Slack Notifications

- [ ] 13. Update `src/app/api/pulse/one-on-ones/route.ts` (POST) — Slack notification.
      After successful insert (can reuse user fetch from step 8): if `scheduledAt` is set, non-blocking `postSlackMessage` with Block Kit header "📅 1-on-1 Scheduled" + context with manager name, report name, formatted date, link to `/pulse/one-on-ones`.
      Files: `src/app/api/pulse/one-on-ones/route.ts`
      Verify: `npx tsc --noEmit`.

- [ ] 14. Update `src/app/api/pulse/one-on-ones/[id]/route.ts` (PATCH) — Slack notification.
      If `scheduledAt` in request body, non-blocking `postSlackMessage` with same Block Kit shape. Fetch names using `manager_id`/`report_id` from existing row.
      Files: `src/app/api/pulse/one-on-ones/[id]/route.ts`
      Verify: `npx tsc --noEmit`.

- [ ] 15. Update `src/app/api/pulse/checkins/route.ts` (POST) — Slack notification.
      After successful upsert + `awardPoints`: if `status === 'submitted'`, fetch employee name, non-blocking `postSlackMessage` with Block Kit header "✅ Check-in Submitted" + context with employee name, formatted week start, link to `/pulse/checkins`.
      Files: `src/app/api/pulse/checkins/route.ts`
      Verify: `npx tsc --noEmit`.

- [ ] 16. Update `src/app/api/pulse/automations/run/route.ts` — Slack milestone notifications.
      In the `milestone_anniversary → send_notification` branch, for each `work_anniversary` and `service_achievement` milestone: after `notifyMilestone`, non-blocking `postSlackMessage` with Block Kit. Work anniversary: header "🎉 Work Anniversary!", context includes name + years count if present. Service achievement: header "🏆 Service Achievement!".
      Files: `src/app/api/pulse/automations/run/route.ts`
      Verify: `npx tsc --noEmit`.

- [ ] 17. Update `src/app/api/pulse/goals/progress/route.ts` (PATCH) — Slack goal-completed notification.
      Add `title` to the existing `select('owner_id, parent_id')` so it reads `select('owner_id, parent_id, title')`. After successful update + cache invalidation: if `status === 'completed'` and `ownerId` is non-empty, fetch owner name, non-blocking `postSlackMessage` with Block Kit header "🎯 Goal Completed!" + context with owner name, goal title, link to `/pulse/goals`.
      Files: `src/app/api/pulse/goals/progress/route.ts`
      Verify: `npx tsc --noEmit`.

---

## Final verification

- [ ] 18. Run `npx tsc --noEmit` from `/Users/Apple/code/clients/kazi` — must exit 0. Fix any remaining type errors.
      Files: any files with remaining type errors.
      Verify: `npx tsc --noEmit` exits 0.
