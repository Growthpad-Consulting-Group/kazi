# Performance reviews backlog

## P0 — security and data integrity

- [x] Restrict cycle detail data to assigned reviewers and review administrators.
- [x] Use the review-management permission and authenticated creator when creating a cycle.
- [x] Validate review payloads, ratings, text limits, and submission transitions server-side.
- [x] Record key review-cycle actions in an audit trail.
- [x] Enforce direct-report ownership when managers create PIPs; retain HR oversight.
- [x] Make IDP/PIP visibility explicit for employees, direct managers, and HR rather than relying on page-level query shape.

## P1 — complete the review conversation

- [x] Add stage-specific deadlines and use them for review reminders.
- [x] Show the current-stage due/overdue state in the cycle UI.
- [x] Add controlled deadline extension controls for HR/admin.
- [x] Add a final-results release stage so feedback stays private until HR/management shares it.
- [x] Give employees a final-review view with acknowledgement and an optional response.
- [x] Add completion safeguards and an explicit waiver reason when advancing a stage with outstanding work.
- [x] Prevent a cycle from completing without peer feedback unless an auditable waiver is supplied.
- [x] Add database-backed peer assignment limits and enforce the maximum during assignment.
- [x] Expose minimum/maximum peer limits and employee-facing anonymity in the cycle setup UI.
- [x] Add a peer nomination/approval flow.
- [x] Let managers create an IDP for a direct report and link final review development areas into it.
- [x] Add PIP acknowledgement, dated progress notes, and check-in history.
- [x] Require employee acknowledgement before a PIP becomes active, with an HR exception path.

## P2 — quality and long-term value

- [x] Add reusable competency templates by company, department, and role with weights and guidance.
- [x] Add calibration: rating distributions, manager comparison, and outlier review before release.
- [x] Connect review context to goals, check-ins, 1-on-1s, daily work, and development plans.
- [x] Create an agreed-development action from final review feedback.
- [x] Add performance reporting, exportable final summaries, and cycle history.
- [x] Add separate IDP and PIP history, review outcomes, and audit export for HR.
