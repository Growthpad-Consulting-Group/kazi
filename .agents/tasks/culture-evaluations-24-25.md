# Culture evaluations: items 24 and 25

Written as part of the HeyTaco-inspired culture set in `slack-engagement-roadmap.md`. These are evaluations, not builds. Nothing here changes behaviour.

## 24. Read-only recognition display mode

**Question:** Should Kazi offer an office-TV or all-hands "Recognition Wall"?

**What exists today**

- Public recognition is visible to all active staff in Kazi and is posted to the company channel when recipient and sender have opted in to culture announcements (`src/lib/recognition-create.ts`).
- Wall of Fame winners and live side quests are already announced to the company channel (`src/lib/slack-digest-worker.ts`).
- There is no kiosk, display token or viewing-only role. Access is by signed-in session only.

**What a display mode would need**

1. A dedicated read-only role or device token, stored hashed, revocable, and tied to a named owner. A session cookie is not suitable for a shared screen.
2. A route that returns only: public recognition the sender and recipient opted in to show, and approved Wall of Fame outcomes. The query must filter on opt-in in the database, not in the page.
3. No link-outs to profiles, no comments, no admin controls, and no counts that rank people.
4. An empty state that shows nothing sensitive, plus a refresh interval.

**Risks**

- A shared URL on a public screen is easy to leak. The token must be scoped to recognition read-only and rotatable.
- Opt-in rules change over time. The display must re-check them on every refresh, not cache a list.
- Recognition text is free text written by people. It may name colleagues or mention sensitive topics. Only the recognition value and short message would appear, and HR should review the first week's output.

**Recommendation:** Do not build yet. Pilot it later as a static, company-channel weekly digest, which the existing weekly culture recap already does. Build the screen only if the team asks for it after that.

## 25. Gift-card marketplace and public API

**Question:** Should Kazi add global gift cards or a public API?

**What exists today**

- A curated rewards catalogue with redemption, fulfilment status and expiry (`src/app/api/pulse/rewards/`).
- No public API, no API keys, and no service-account model. The only outbound integrations are Slack, Asana, Google Calendar and Giphy.

**Gift cards: what would need to be settled first**

- Which countries Growthpad staff are in, and the tax treatment of gift-card rewards in each.
- Who fulfils each card, how codes are delivered securely, and how refunds or expired codes are handled.
- How gift-card cost is recorded in accounts, and who approves redemptions above a set amount.
- Fraud controls: duplicate redemptions, account takeover, and point manipulation.

**Public API: what would need to be settled first**

- A concrete integration that cannot be met with the existing Slack and Asana connections.
- A narrow scope list, OAuth or service-account authentication, per-key rate limits, and an audit log.
- A named owner who will maintain it after launch.

**Recommendation:** Keep the curated catalogue as the default. Do not start either project until an owner, a budget, a security review and a specific Growthpad use case exist. The roadmap's acceptance criteria already require this, so nothing else needs to change.
