# Kazi suite integration

## Goal

Make Kazi Hire, Kazi Pulse, Staff and Kazi Signatures feel like one employee lifecycle product, while preserving their specialised workflows.

## Actionable delivery checklist

### Foundation: one employee record

- [x] Add a dedicated employee profile at `/people/[id]`.
- [x] Show a cross-suite employee snapshot: manager, department, start date, latest check-in, goals, upcoming 1-on-1 and signature status.
- [x] Add profile navigation for Overview, Pulse, Performance, Development and Signature.
- [x] Replace list-filter “View profile” links with the employee profile.
- [x] Add reciprocal links from Signature staff profiles back to the employee profile.

### Hire to employee onboarding

- [x] Add a deliberate “Create staff record” action for a hired candidate.
- [x] Pre-fill the staff form from candidate and job data.
- [x] On confirmation, create the Kazi user, preserve a link to the source candidate, and create the mapped signature profile where the email domain is configured.
- [x] Add onboarding checklist items: manager, department, start date, first check-in, goals and signature assignment.
- [x] Surface incomplete onboarding in the shared work queue.

### Canonical organisation data

- [x] Make Departments the canonical shared reference for Staff, Jobs, reporting and Signatures.
- [x] Replace new free-text department writes with the canonical department value, while retaining existing values during migration.
- [x] Add department drill-downs for staff, open jobs, hiring pipeline and goals.

### Shared navigation and operating context

- [x] Add contextual links between job details, employee profiles and departments.
- [x] Upgrade the command palette into global entity search for staff, candidates, jobs, goals, reviews and signature profiles.
- [x] Consolidate cross-suite pending work in a shared work queue.
- [x] Keep specialised module navigation: the single generic Staff destination is the employee hub, while Signature staff remains a clearly labelled deployment-specific workspace.

## Delivery order

1. Employee profile and reciprocal links.
2. Hire-to-staff onboarding conversion.
3. Canonical department data and drill-downs.
4. Global search and shared work queue.
