# Kazi browser extension

## Purpose

Make active daily-log timing visible and controllable while staff work outside Kazi, without exposing private staff or client data.

## Actionable delivery plan

### P0 — V1 toolbar timer

- [x] Create a Chrome/Edge Manifest V3 extension workspace.
- [x] Add local, restart-safe timer state, pause/resume, stop and a live toolbar badge.
- [x] Add a popup for naming a task, choosing a category, controlling the timer and opening Kazi.
- [x] Add extension-specific authorization using a short-lived, revocable Kazi token. Never reuse browser cookies or a staff password.
- [x] Add narrowly scoped Kazi endpoints for the signed-in staff member’s completed timer entries.
- [x] Sync stopped entries into the appropriate daily log, with conflict handling and offline retry.
- [x] Retry queued entries from the background worker after browser startup and on the one-minute timer tick.
- [x] Let staff view and revoke active Kazi Timer connections from Profile settings.
- [ ] Add Chrome/Edge install, restart, sleep/wake, sign-out and concurrent-tab tests.

### P1 — V2 optional cross-site mini timer

- [ ] Add an explicit opt-in for the floating mini timer; it must be disabled by default.
- [ ] Let staff choose permitted sites individually. Request host permission only after they select a site.
- [ ] Add a compact, dismissible overlay with elapsed time, pause/stop and “Open Kazi”.
- [ ] Offer “Start from this page” only as a manual prefill; never read page content, form fields, browsing history or credentials.
- [ ] Add per-site enable/disable controls and a visible privacy explanation.
- [ ] Test overlays against common apps (Google Workspace, Asana and Slack) without interfering with their UI.

## Phase 1 — toolbar timer

Build a Chrome/Edge Manifest V3 extension that provides:

- A browser-action popup with the active task, elapsed time, start, pause, and stop controls.
- A browser badge showing elapsed minutes while a timer is active.
- Reliable local timer state in `chrome.storage`, with `chrome.alarms` used to refresh the badge when the popup is closed.
- Secure synchronization with the Kazi daily-log API after an explicit staff sign-in.

Permissions should stay minimal: `storage`, `alarms`, and `activeTab`. No broad site access is needed for this phase.

## Phase 2 — optional cross-site floating widget

Only build this if the toolbar experience proves insufficient. It would use a content script to show a compact, dismissible timer over approved websites.

- Request explicit host permissions only for selected domains, rather than all sites by default.
- Do not read page content, form fields, browsing history, or credentials.
- Show clear extension onboarding and per-site enable/disable controls.

## Authentication and API design

- Never embed a Kazi service key, Supabase service key, or staff password in the extension.
- Use an extension-specific OAuth/PKCE or short-lived, revocable Kazi token flow.
- Register the extension ID as an approved client/origin.
- Add narrowly scoped endpoints for reading and mutating only the signed-in user’s active timer.
- Store tokens with `chrome.storage.session` where possible; provide a disconnect action.

## Security gate

The extension can track a local timer before it is connected, but it must not
sync staff data until the P0 authorization work is complete. No service keys,
Supabase keys, Kazi passwords or browser cookies may be stored in the extension.
