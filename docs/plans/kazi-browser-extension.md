# Kazi browser extension

## Purpose

Make active daily-log timing visible and controllable while staff work outside Kazi, without exposing private staff or client data.

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

## Delivery checklist

1. Create an extension workspace with `manifest.json`, popup, service worker, and shared timer state.
2. Add secure extension authentication and token revocation in Kazi.
3. Build start/pause/stop synchronization and conflict handling with the Kazi daily log.
4. Add badge updates, offline recovery, and error states.
5. Test Chrome and Edge, including browser restart, sleep/wake, sign-out, and concurrent Kazi tabs.
6. Complete a privacy/permission review before enabling any content script.
