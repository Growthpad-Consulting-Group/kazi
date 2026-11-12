# Kazi Timer extension

This is the local-first V1 shell for Chrome and Edge. It has access only to
Kazi, where it mirrors an active Kazi timer to the toolbar. It never reads page
content, browsing history, passwords or Kazi cookies.

## Load locally

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this `kazi-timer` directory.
4. Pin **Kazi Timer** to the toolbar.

The popup starts, pauses, resumes and stops a task. On an open Asana task, the
same controls sit beside **Mark complete**. Use **Connect Kazi** once to approve
a 12-hour, extension-only connection in an authenticated Kazi window.
The revocable token survives browser restarts and managed extension updates, but
Kazi still requires a new connection when its 12-hour expiry is reached.
Timers live on Kazi’s server, so pause, resume and stop made in Kazi or in another
browser window appear in the popup. A stop is sent once per timer and writes a
single entry to the day’s daily log. If Kazi cannot be reached, the stop waits in
the local queue and syncs when the connection returns. Disconnect revokes the current extension token.

## Contextual timer controls

- **Asana:** Kazi reads only the title of the task currently open after you use
  its timer control. It never reads task descriptions, comments, attachments or
  other Asana content.
- **Gmail:** A Start Kazi timer action appears beside an open message subject by
  default. Kazi reads that subject only after you click it; it never reads
  message bodies, recipients, attachments or mailbox history. Hide the feature
  from the extension popup at any time.
- **Selected text:** Highlight text on any page, right-click, then choose
  **Start Kazi timer with selected text**. Only the text you explicitly select
  and invoke is used as the task title.
- **GitHub:** An open issue or pull request shows a Start Kazi timer action.
  Only its visible title is used after you click; issue text, code, reviews and
  files are not read.
- **Slack:** The active channel or direct-message header shows a Start Kazi
  timer action. Only that visible label is used after you click; messages,
  threads, people and files are not read.

All three controls use the same shared Kazi timer. Starting a second timer is
blocked, and stopping it writes one daily-log entry as usual.

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

## Microsoft Edge (Edge for Business)

Edge runs Chromium extensions, so the same package and update manifest apply.
Use this only if staff use Edge instead of Chrome. Edge does not use the Google
Admin console; set the policy in Microsoft Intune or Group Policy instead.

Force-install the extension with the `ExtensionInstallForcelist` policy:

```
dffnikiadlobakbogmmfjkobjieehcbc;https://kazi.growthpad.africa/extensions/kazi-timer/updates.xml
```

- **Windows (Group Policy or Intune):** `HKLM\Software\Policies\Microsoft\Edge\ExtensionInstallForcelist`, as a list value.
- **macOS (MDM profile):** the `com.microsoft.Edge` domain, key `ExtensionInstallForcelist`, as an array of strings.

Verify on one test account that the extension appears in `edge://extensions`
with the install marked as managed, and that it connects to Kazi. Edge is
expected to behave like Chrome, but this has not been tested yet.

## Firefox build (source for Mozilla review)

The Firefox package is generated from this folder's source. It is not
transpiled or minified; the build script only copies the files, rewrites the
manifest for Firefox and generates the icon sizes.

Requirements:

- macOS (the icon step uses the built-in `sips` tool)
- Node.js 20 or later, and `zip`

Steps, from the repository root:

```bash
node extensions/kazi-timer/build-firefox.mjs
```

The package is written to `extensions/kazi-timer/build/kazi-timer-firefox.zip`,
and the unpacked files to `extensions/kazi-timer/build/firefox/`. The build
does not need network access or npm packages.

## Deliberate limitation

Apply the matching Supabase migration before using Kazi sync. The extension
never receives Kazi cookies, staff passwords, Supabase keys or service keys.
