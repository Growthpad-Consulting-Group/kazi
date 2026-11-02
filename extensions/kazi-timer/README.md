# Kazi Timer extension

This is the local-first V1 shell for Chrome and Edge. It intentionally has no
host permissions and cannot access page contents, browsing history, passwords
or Kazi cookies.

## Load locally

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this `kazi-timer` directory.
4. Pin **Kazi Timer** to the toolbar.

The popup starts, pauses, resumes and stops a task. Use **Connect Kazi** to
approve a 12-hour, extension-only connection in an authenticated Kazi window.
Stopped tasks are queued locally and then appended to the current day’s Kazi
daily log. Disconnect revokes the current extension token.

## Deliberate limitation

Apply the matching Supabase migration before using Kazi sync. The extension
never receives Kazi cookies, staff passwords, Supabase keys or service keys.
