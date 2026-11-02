# Kazi Timer extension

This is the local-first V1 shell for Chrome and Edge. It has access only to
Kazi, where it mirrors an active Kazi timer to the toolbar. It never reads page
content, browsing history, passwords or Kazi cookies.

## Load locally

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this `kazi-timer` directory.
4. Pin **Kazi Timer** to the toolbar.

The popup starts, pauses, resumes and stops a task. Use **Connect Kazi** to
approve a 12-hour, extension-only connection in an authenticated Kazi window.
Timers live on Kazi’s server, so pause, resume and stop made in Kazi or in another
browser window appear in the popup. A stop is sent once per timer and writes a
single entry to the day’s daily log. If Kazi cannot be reached, the stop waits in
the local queue and syncs when the connection returns. Disconnect revokes the current extension token.

## Enterprise distribution

Growthpad distributes the signed extension through Chrome Enterprise rather
than the Chrome Web Store. In Google Admin, choose **Devices → Chrome → Apps &
extensions → Users & browsers**, select the target staff group, then choose
**Add Chrome app or extension by ID → From a custom URL**.

- Extension ID: `dffnikiadlobakbogmmfjkobjieehcbc`
- Update manifest: `https://kazi.growthpad.africa/extensions/kazi-timer/updates.xml`

Use **Force install + pin to browser toolbar**. The signing key used to create
the package must stay outside source control; it is required for every update.
For a release, increase `version` in `manifest.json`, package with the same key,
and replace the CRX plus this update manifest.

## Deliberate limitation

Apply the matching Supabase migration before using Kazi sync. The extension
never receives Kazi cookies, staff passwords, Supabase keys or service keys.
