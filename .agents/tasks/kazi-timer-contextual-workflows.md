# Kazi Timer — Contextual workflows

## P0 — Implement now

- [x] **Inline Asana controls.** Replace the passive `Timer running` state beside Asana's **Mark complete** control with elapsed time plus Pause/Resume and Stop actions for the active task.
- [x] **Gmail message timer (opt-in).** Let a staff member enable a compact Start Kazi timer action for an open Gmail message. Read only the displayed subject after the staff member clicks; never read message bodies, recipients, attachments, or mail history.
- [x] **Selected-text timer.** Add a browser context-menu action, **Start Kazi timer with selected text**, which starts the shared Kazi timer from text the staff member deliberately selected.
- [x] **GitHub and Slack task helpers.** Add focused timer actions for an open GitHub issue/pull request and the active Slack channel or direct-message header.

## P1 — Follow-up validation

- [ ] Test the Gmail placement against current Gmail desktop layouts and adjust only the narrow message-header selector if Google changes it.
- [ ] Gather pilot feedback on whether selected text should start immediately or first open a compact confirmation form for client/category.

## Guardrails

- Every entry point controls the same shared Kazi timer and preserves the local-first, lifecycle-only sync model.
- Gmail support is available by default and can be hidden from the extension popup at any time.
- Asana reads only the open task title; Gmail reads only the open message subject after an explicit click; GitHub reads only the open issue/pull-request title; Slack reads only the active conversation label; selected text is only read after the context-menu action is chosen.
