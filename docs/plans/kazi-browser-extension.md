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
- [x] Mirror a timer started in Kazi to the extension popup and toolbar badge, with controls kept in Kazi to prevent two timers drifting apart.
- [x] Add Chrome/Edge install, restart, sleep/wake, sign-out and concurrent-tab worker tests.

### P1 — V2 optional cross-site mini timer

- [x] Add an explicit opt-in for the floating mini timer; it must be disabled by default.
- [x] Let staff choose permitted sites individually. Request host permission only after they select a site.
- [x] Add a compact, dismissible overlay with elapsed time, pause/stop and “Open Kazi”.
- [x] Offer “Start from this page” only as a manual prefill; it reads the page title only on click, never page content, form fields, browsing history or credentials.
- [x] Add per-site enable/disable controls and a visible privacy explanation.
- [ ] Test overlays against common apps (Google Workspace, Asana and Slack) without interfering with their UI.

### P2 — Task-level integrations

- [x] Build an Asana integration that places a Kazi start button beside an open task. It runs automatically on app.asana.com, with no per-user opt-in, because Asana access is a declared host permission.
- [x] Read only the visible Asana task title; never collect descriptions, comments, attachments, credentials or browsing history.
- [x] Start the shared Kazi timer directly from the visible Asana task title.
- [x] Add Asana privacy copy in the extension popup and Kazi.
- [x] Add DOM-resilience tests for common Asana task views (mounting on div and button controls, labelled title fallback, no-op on unknown layouts, other-task and running states).

### P0.1 — Shared active timer authority

- [x] Define one persisted active-timer payload shared by Kazi and the extension: task, client, category, log date, start timestamp, accumulated milliseconds, running state, source and idempotency key.
- [x] Replace Kazi daily-log localStorage as the active-timer authority; retain it only as a short-lived recovery cache.
- [x] Add authenticated shared-timer start, pause, resume and read actions for both Kazi sessions and extension tokens.
- [x] Make stop an idempotent server action that writes exactly one daily-log entry, then clears the shared timer.
- [x] Reconcile the open Kazi daily-log page with shared timer changes from another surface, including paused state and elapsed time.
- [x] Preserve offline extension queueing only when no extension connection is available, then sync safely after reconnecting.
- [ ] Add end-to-end coverage for Kazi → extension and extension → Kazi start/pause/resume/stop flows, concurrent tabs, restart and offline retry. _Owner will cover this separately; not in this repo's plan._

### P0.2 — Connection experience

- [x] Keep the first Kazi authorization explicit and consent-based. Chrome connects on install; if the person isn't signed in to Kazi, Kazi's sign-in page opens once.
- [x] Restore a still-valid extension session automatically on browser startup without showing Connect Kazi again. The token is held in session storage and reconnects silently while the person is signed in to Kazi.
- [x] Show Connect Kazi only when the extension has no valid session or the staff member explicitly disconnects. Kazi's integrations page shows connection status.

### P3 — Cross-browser distribution

Assessment from the code. None of these builds has been run in its browser.

- [ ] Validate and document Microsoft Edge deployment through Edge for Business / Chromium enterprise policies. _Documented in `extensions/kazi-timer/README.md` (Microsoft Edge section): the same package and update URL, set with the `ExtensionInstallForcelist` policy. Edge runs Chromium extensions, so the code should load unchanged. Pending a test in Edge on one account._
- [ ] Package and test a Firefox build, including its identity redirect and Mozilla Add-ons signing requirements. _Built: `extensions/kazi-timer/build-firefox.mjs` makes a Firefox package (scripts background, gecko ID, generated icons). Passes `web-ext lint` with no errors or warnings and is covered by build tests. Still to do: run it in Firefox, check the connect flow, and submit for Mozilla signing._ _Assessed: Firefox does not run a `service_worker` background, so the manifest needs `background.scripts` and a `browser_specific_settings.gecko.id`. The identity redirect URL differs, so the connect flow needs testing. Enterprise installs need Mozilla signing. Not built._
- [ ] Assess a Safari Web Extension wrapper, Apple signing, and managed macOS distribution. _Assessed: Safari needs an Xcode wrapper (`safari-web-extension-converter`), an Apple Developer ID to sign it, and an MDM profile for managed installs. Needs an Apple account decision before building._
- [ ] Publish a supported-browser matrix; treat Brave, Arc and Opera as unverified Chromium compatibility until tested. _Matrix: Chrome (verified by the team), Edge (expected, untested), Firefox (needs a build), Safari (needs a wrapper), Brave, Arc, Opera (unverified)._

## Phase 1 — toolbar timer

Build a Chrome/Edge Manifest V3 extension that provides:

- A browser-action popup with the active task, elapsed time, start, pause, and stop controls.
- When a timer is started in Kazi, its task and elapsed time are mirrored to the popup and badge. The popup links back to Kazi for controls, so there is always one source of truth.
- A browser badge showing elapsed minutes while a timer is active.
- Reliable local timer state in `chrome.storage`, with `chrome.alarms` used to refresh the badge when the popup is closed.
- Secure synchronization with the Kazi daily-log API after an explicit staff sign-in.

Permissions stay minimal: `storage`, `alarms`, `identity`, and access only to `https://kazi.growthpad.africa/*`. The Kazi-only content bridge reads the active timer state, never page content or browsing data.

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
