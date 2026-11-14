# Multi-company Kazi Hire — Implementation Roadmap

> **Outcome:** Growthpad remains the parent group while CCSA and PAAN use the same Kazi login and Hire product. A recruiter with access to several companies can switch context without a second
> account; company data stays isolated everywhere it matters.

## Product decisions locked in

- **One Kazi product, not separate tenants or logins.** Companies are first-class workspaces within the Growthpad group.
- **Initial scope is Hire.** Pulse, Signatures, Rewards and other modules remain Growthpad-wide until a company explicitly needs them.
- **Kazi is the hiring system of record.** Company websites stay the public, branded careers surface.
- **CCSA owns its public URLs and SEO.** CCSA job pages remain canonical on `callcentersolutionsafrica.com`; Kazi stores and processes the hiring data behind them.
- **Company access is server-enforced.** A visual filter alone is never sufficient for jobs, applicants, attachments, exports, notifications or AI data.

## Success criteria

- [ ] Asenath signs in once and can switch between Growthpad and CCSA Hire.
- [ ] A CCSA-only recruiter cannot read Growthpad jobs, candidates, CVs, scorecards, exports or notifications by changing a URL or API payload.
- [ ] A CCSA candidate applies from the CCSA careers site once; their CV, application, acknowledgement and AI screening live under CCSA in Kazi.
- [ ] Existing Growthpad Hire behaviour and public careers URLs continue without interruption.
- [ ] PAAN can be enabled later by configuration and membership assignment, not a new platform build.

---

## P0 — Data model, access and safe backfill

**Status:** Complete. The company/membership schema, Growthpad backfill, initial CCSA recruiter membership, company-aware cache queries, candidate/job server access boundary, company-scoped Hire audit table, company-scoped recruiter notifications, regression tests, and department decision are all done. Migration rollback documented below.

### 1. Create company workspaces

- [x] Add a `companies` table with: `id`, `slug`, `legal_name`, `display_name`, `website_url`, `careers_url`, `logo_url`, `brand_config`, `reply_to_email`, `application_from_name`, `privacy_url`, `terms_url`, `is_active`, timestamps.
- [x] Seed `growthpad`, `ccsa` and `paan` records.
- [x] Replace the single-purpose `company_settings` assumption only where Hire needs per-company settings; do not disrupt existing general app settings. **Decision:** Hire uses the `companies` table directly (`reply_to_email`, `application_from_name`, `privacy_url`, `terms_url`, `brand_config`). The existing `company_settings` table serves Pulse/Signatures only and is untouched.
- [x] Add generated database types and focused repository helpers.

**Acceptance:** each company has a stable ID/slug and independent public-brand configuration.

### 2. Add staff company memberships

- [x] Create `company_memberships` with `company_id`, `user_id`, `hire_role`, `is_active`, `created_by`, timestamps and uniqueness on `(company_id, user_id)`.
- [x] Support at least `company_admin`, `recruiter`, `hiring_manager` and `viewer` roles for Hire.
- [x] Seed Growthpad memberships for current users from the existing role model.
- [x] Add CCSA membership for the designated recruiter(s), including Asenath.
- [x] Leave employee identity, password, Google account and manager relationships shared across Kazi.

**Acceptance:** one person can have different Hire access in multiple companies without duplicate `users` rows.

### 3. Scope Hire records by company

- [x] Add non-null `company_id` to `jobs`; backfill every current job to `growthpad` before enforcing the foreign key.
- [x] Make candidates inherit a company through their job and add a direct, indexed `company_id` only if needed for secure/fast filtering.
- [x] Scope hiring-related records: interviews, scorecards, screening queue/results, candidate communication, notes, exports, job analytics and recruiter notifications. **Status:** Interviews and scorecards are access-guarded via `assertHireCandidateAccess` on every route. Notes, stage changes, assignment, shortlisting and bulk operations are enforced in server actions. Recruiter notifications from AI screening now use `notifyHireCompanyRecruiters` and scope Slack recipients to company membership holders rather than all system recruiters. Exports are not yet implemented (P1+).
- [x] Decide and document department ownership: departments must be company-scoped or have an explicit company assignment; avoid using one global department list as an accidental data bridge. **Decision:** `jobs.department` is a free-text string column, not a foreign key to the `departments` table. The `departments` table is a staff-org concept used only by HR/Pulse features. There is no cross-company department data bridge risk in Hire. Each company's jobs carry their own department label independently.

**Acceptance:** all existing Growthpad job and candidate rows retain their current behaviour after backfill.

### 4. Enforce access at the server boundary

- [x] Build one server-only `assertHireCompanyAccess()` helper that checks membership plus the existing global admin/HR permissions.
- [x] Apply it to candidate/job server actions and candidate-specific API routes, including AI screening, CV preview/download, bulk actions, interview APIs, scorecards, onboarding and outbound email.
- [x] Make Hire list cache keys company-aware. Fine-grained per-company invalidation remains a follow-up optimisation.
- [x] Add a company-scoped Hire audit trail for job and candidate mutations, excluding CV, email and AI-rationale content.
- [x] Add regression tests for unauthorised cross-company access. Seven vitest unit tests in `src/lib/hire-company-access.test.ts` cover: membership grants, cross-company denial, below-minimum-role denial, global admin bypass, candidate-level cross-company denial, mixed-company batch denial, and same-company batch allow.

**Acceptance:** changing an ID, query parameter or client-side active-company value never exposes another company’s hiring data.

### 5. Run and verify the migration safely

- [x] Document the backup/export and rollback approach for the applied production migration. **Approach:** Before applying any Hire schema migration in production: (1) create a Supabase manual backup via the dashboard or `supabase db dump`; (2) verify the backup restores to a staging project; (3) apply the migration with `supabase db push` or via the Supabase SQL editor; (4) confirm all existing Growthpad jobs/candidates resolve to the growthpad company (`SELECT count(*) FROM jobs WHERE company_id IS NULL` should return 0). Rollback is a deliberate forward migration that removes the added columns and tables — never a destructive `DROP` without a reviewed migration file. The migrations `20261114000032` and `20261114000033` are idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`) and safe to re-apply.
- [x] Verify all pre-existing jobs/candidates resolve to Growthpad and all current recruiter access still works.
- [x] Record the applied migration result in this tracker. Rollback remains a deliberate, reviewed migration rather than a destructive schema reversal.

**Acceptance:** no live Growthpad Hire record is orphaned or inaccessible.

---

## P1 — One-login Hire workspace

**Status:** Complete. Multi-company staff can use an explicit, authorised aggregate workspace for safe read-only Hire oversight, or switch into one company to create and manage records.

### 6. Add a Hire company switcher

- [x] Add an accessible company switcher to the Hire header, showing only memberships the current user may access.
- [x] Include `All authorised companies` only for users allowed to see more than one company. The aggregate view is explicit, limited to that user's authorised company IDs and read-only for Jobs/Candidates mutations and creation; exports are visibly labelled as aggregate/company-scoped before use.
- [x] Persist the last selected company in a secure Hire-scoped cookie; support shareable, validated `?company=<slug>` context in URLs.
- [x] Clearly label jobs, candidate pages, pipelines and reports with the active company.

**Acceptance:** Asenath can move from `Growthpad Hire` to `CCSA Hire` in one session without mixed results.

### 7. Make all Hire UI company-aware

- [x] Filter jobs, candidates, pipelines and reports by active company. Candidate search, filters, counts and bulk actions remain server-authorised and company-scoped.
- [x] Require an authorised active company when creating a job. Job import inherits the selected workspace when it is added to the new-job flow.
- [x] Scope Hire dashboard/action widgets and their deep links to the active company instead of the current global Hire roll-up. Hire KPIs, pipeline, interview queue, role schedules and candidate action items now follow the authorised active workspace; shared Pulse, staff and performance data remain group-wide.
- [x] Scope job templates, interview email templates, acknowledgement content and AI screening defaults by company, with a deliberate parent default only where safe. Kazi has no shared configurable template catalogue yet; existing acknowledgement, draft, interview calendar and AI-screening context now resolve from the job's company brand and job-specific rubric, with Growthpad as the safe first workspace only for global Hire admins.
- [x] Add/export company-scoped candidate data with an explicit company label and server-side boundary. The existing candidate export now carries an explicit active-company title and company-prefixed export filename; its source rows are already authorised and scoped by `getCandidates()`.

**Acceptance:** every metric and list is unambiguous about which company it represents.

### 8. Company-aware communications and interviews

- [x] Add company brand/from/reply-to values to application acknowledgements, recruiter-sent candidate email and AI-assisted drafts. The shared verified sending address remains unchanged; the visible sender name and reply-to are company-specific.
- [x] Ensure connected calendars and Slack notifications state the company and route only to authorised hiring staff.
- [x] Preserve candidate privacy: Slack application and hiring alerts contain only the company, candidate name, role and an authorised Kazi link — never CV text, cover letters or AI rationale.

**Acceptance:** a CCSA applicant receives CCSA-branded communication, while Growthpad messaging remains unchanged.

---

## P2 — CCSA careers integration

**Status:** Core cutover complete. Kazi now holds the two live CCSA vacancies and the CCSA careers site reads public job content and sends applications to Kazi directly. Deploy both repositories to make the new public contract live.

### 9. Choose the CCSA content ownership boundary

- [x] Keep CCSA’s careers landing-page copy, culture content and general SEO in its website/Sanity project.
- [x] Make Kazi the source of truth for vacancy content/status, applications and candidate processing. The CCSA site consumes Kazi’s public job feed directly; Sanity remains only for broader careers/culture content.
- [x] Retire the CCSA job-posting dependency on Sanity. Existing public slugs are retained as Kazi slugs, so no redirects are required.
- [x] Preserve CCSA-specific public fields on Kazi jobs via `public_details`: openings, languages, hiring timeline, tags and richer editorial sections.

**Acceptance:** a recruiter never has to publish/close a vacancy in both Sanity and Kazi.

### 10. Build the CCSA public jobs feed

- [x] Add public Kazi read endpoints keyed by `company_slug`, returning only published, open jobs and safe public fields.
- [x] Securely support CCSA website server-side fetching/revalidation; rate-limit any public browser endpoint.
- [x] Map CCSA public job pages to a Kazi public slug without exposing internal IDs.
- [x] Retain current CCSA page slugs; no redirects are required.

**Acceptance:** `callcentersolutionsafrica.com/careers` renders CCSA-only Kazi vacancies and closes jobs automatically on schedule.

### 11. Route CCSA applications directly into Kazi

- [x] Retire the CCSA website’s email-only application route. Every CCSA careers submission now relays to Kazi’s company-scoped public application endpoint.
- [x] Send CCSA `company_slug`, job reference, applicant data, CV and optional cover letter to Kazi in one request.
- [x] Retain CCSA’s required CV behaviour and validate file type/size consistently with Kazi (PDF/DOCX, 4 MB).
- [x] Store the cover letter on the candidate record and expose it to authorised CCSA recruiters.
- [x] Configure duplicate-application protection and acknowledgement emails for CCSA through the existing Kazi public application flow.

**Acceptance:** a CCSA application creates exactly one CCSA-scoped candidate, queues AI screening, stores the CV and sends one acknowledgement.

### 12. Make public applying fully branded

- [x] Use CCSA’s existing careers identity and public contact details by retaining the CCSA-native application page and relaying mapped applications to Kazi server-to-server.
- [x] Ensure the candidate-facing CCSA form never reveals Kazi navigation, internal IDs or another company’s branding.
- [ ] Refactor the optional direct Kazi `ApplyPage` for company configuration before exposing direct CCSA apply links. It is not used by the CCSA careers journey.

**Acceptance:** candidates see a CCSA careers experience even though Kazi processes the application.

### 13. Protect CCSA SEO ownership

- [x] Render `JobPosting` structured data on the canonical CCSA page, not on a duplicate Kazi URL.
- [x] Use canonical tags pointing to `callcentersolutionsafrica.com`.
- [ ] Configure indexing notifications per company/domain only where the verified Google ownership supports it.
- [ ] Validate sitemap, robots, closed-job behaviour and structured data after the first mapped role is deployed.

**Acceptance:** CCSA jobs are indexed as CCSA pages without duplicate Growthpad/Kazi search entries.

---

## P3 — Migration, quality and rollout

### 14. Migrate active CCSA recruitment work

- [x] Inventory current CCSA public roles: two open positions were identified; historic closed roles remain outside Kazi.
- [x] Import the two open roles into CCSA Hire with reviewed descriptions, department mappings, closing schedules, preserved public details and 100-point AI rubrics.
- [ ] Decide whether historic applicants should be imported; do not migrate personal data from inboxes without an explicit retention/privacy decision.
- [ ] Mark the old email-only handler as retired after end-to-end validation.

**Acceptance:** active CCSA roles are manageable in Kazi, with no unreviewed candidate-data migration.

### 15. End-to-end security and product QA

- [ ] Test as a Growthpad-only recruiter, CCSA-only recruiter, multi-company recruiter, company admin and unauthenticated candidate.
- [ ] Test job publishing, scheduled closing, CV upload, cover letter, AI screening, candidate communications, interviews, exports and deletion within each company.
- [ ] Test cross-company deep links, caches, notification links and direct API calls for isolation failures.
- [ ] Run typecheck, lint, build and targeted application flow tests in both Kazi and CCSA projects.

**Acceptance:** the complete CCSA candidate journey works end-to-end and negative authorisation tests pass.

### 16. Controlled launch

- [ ] Launch first with one CCSA vacancy and Asenath as the pilot recruiter.
- [ ] Monitor new applications, AI queue processing, email acknowledgement delivery, recruiter access and public page indexing for one week.
- [ ] Add PAAN only after the CCSA pilot meets the success criteria.

**Acceptance:** CCSA is operating reliably from Kazi before another company is enabled.

---

## Implementation choices still needed

- [ ] Confirm CCSA acknowledgement sender and reply-to mailbox. Recommended default: `careers@callcentersolutionsafrica.com`.
- [ ] Confirm who administers CCSA Hire besides Asenath.
- [ ] Confirm whether CCSA departments should be independent from Growthpad departments. Recommended: independent, company-scoped departments.
- [ ] Confirm whether CCSA historic inbox applicants should remain email-only or be migrated with documented consent/retention handling.
- [ ] Confirm whether PAAN is Hire-only initially or needs a planned future Pulse/Signatures rollout.

## Verification commands

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

For any database migration, run the existing production migration workflow only after review, then repeat the relevant company-isolation and public-application tests.
