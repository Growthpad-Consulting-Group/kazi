# Kazi — Build Tracker
**Growthpad Consulting Group** · AI-Assisted Recruitment & Performance Suite

> Two modules: **Kazi Hire** (recruitment ATS) and **Kazi Pulse** (performance management).
> Humans make every hiring and performance decision; AI drafts, summarises and suggests.

---

## Phase 0 — Foundation ✅

- [x] Next.js 16 App Router + TypeScript + Tailwind CSS scaffold
- [x] Supabase PostgreSQL with RLS — custom `users` table (no Supabase Auth)
- [x] NextAuth v4 Credentials provider + JWT (role, department)
- [x] RBAC (`src/lib/rbac.ts`) — admin / hr / hiring_manager / interviewer / manager / employee
- [x] Groq SDK wired (`llama-3.3-70b-versatile`) via `src/lib/ai.ts`
- [x] Cloudflare R2 storage via S3-compatible SDK (`src/lib/r2.ts`)
- [x] Resend email client (`src/lib/email.ts`)
- [x] Feature-based folder structure (`src/features/<feature>/components/`)
- [x] Database migration (`supabase/migrations/001_initial_schema.sql`) — run via Management API
- [x] Protected `(app)` route group with session guard
- [x] Sidebar navigation with role-based visibility

---

## Phase 1 — Kazi Hire MVP ✅

### Jobs
- [x] Job list page (`/hire/jobs`)
- [x] Create job form with requirements + scoring rubric
- [x] AI-assisted job description drafting (Groq)
- [x] Job detail / edit page
- [x] Job status (open / closed / draft)

### Candidates
- [x] Candidate list with filters (stage, job, search)
- [x] Public apply page / API (`/api/hire/candidates/apply`) — DPA consent, duplicate check
- [x] Candidate detail page
- [x] CV upload to Cloudflare R2 + Groq CV parsing (structured JSON)
- [x] AI screening — anonymised scoring 0–100 against rubric, auto-shortlist ≥ 65
- [x] Stage advancement (Applied → Screened → Interview → Offer → Hired / Rejected)
- [x] Recruiter notes
- [x] AI screening logs in `ai_logs` table

### Pipeline
- [x] Kanban board (`/hire/pipeline`) with dnd-kit drag-and-drop
- [x] Optimistic stage update on drag, revert on failure

### Interview
- [x] Groq-generated role-specific interview questions (8 per candidate, anonymised)
- [x] Per-question notes + score (1–5) form
- [x] Hire / Maybe / No-hire recommendation
- [x] Scorecard saved to `interview_scorecards` table

### Communications
- [x] AI-drafted emails — acknowledgement / interview invite / rejection (Groq)
- [x] Editable draft before send
- [x] Sent via Resend

### Reporting
- [x] Candidate funnel by stage
- [x] Source-of-applicants breakdown
- [x] AI screening stats (avg score, shortlist rate)
- [x] Pipeline velocity (avg days, open roles)

### Dashboard
- [x] Live stats: open jobs, active candidates, pending AI screening
- [x] Recent candidates list with stage + AI score

---

## Phase 2 — Kazi Pulse MVP (Performance)

### Setup
- [ ] Performance module DB schema migration (check-ins, goals, 1-on-1s, feedback, recognition)
- [ ] Employee directory / people list page
- [ ] Manager ↔ report relationships

### Weekly Check-ins
- [ ] Employee check-in form (wins, priorities, blockers, mood 1–5)
- [ ] Manager review + comment on check-ins
- [ ] AI summary of team check-ins for manager (Groq)
- [ ] Repeated-blocker / dropping-mood flag

### Goals / OKRs
- [ ] Company → team → individual goal hierarchy
- [ ] Progress updates on goals
- [ ] Goal completion percentage roll-up

### 1-on-1s
- [ ] Shared agenda (manager + report)
- [ ] Notes and action items
- [ ] Action items carried over to next 1-on-1

### Feedback & Recognition
- [ ] Peer shout-outs ("high fives" / kudos)
- [ ] Private feedback between individuals

### Pulse Dashboard (manager)
- [ ] Check-in completion rate by team
- [ ] Goal progress overview
- [ ] Mood trend chart
- [ ] AI-suggested 1-on-1 talking points

---

## Phase 3 — Performance Phase 2 (Reviews & Surveys)

- [ ] Self / manager / peer performance reviews (configurable cycle)
- [ ] AI review draft from quarter's check-ins, goals and feedback
- [ ] Competency ratings
- [ ] Pulse / engagement surveys (anonymous, no results for groups < 5)
- [ ] Flight-risk signals
- [ ] Individual Development Plans (IDPs)
- [ ] Performance Improvement Plans (PIPs)
- [ ] Leadership analytics dashboard

---

## Phase 4 — Polish & Integrations

- [ ] Slack / Teams notifications (check-in reminders, new candidates, stage changes)
- [ ] Google / Outlook calendar sync for interviews
- [ ] Bulk CV screening queue (Redis/Valkey background job)
- [ ] HRIS export (CSV / API)
- [ ] Candidate data retention / deletion workflow (ODPC compliance)
- [ ] Vercel CI/CD with preview deploys + GitHub Actions
- [ ] End-to-end tests (Playwright)
- [ ] Penetration / security review

---

## Ongoing Decisions

| Decision | Status |
|---|---|
| Build vs. buy | ✅ Build in-house |
| First module | ✅ Kazi Hire |
| Business owner | HR lead (confirm name) |
| Developer resource | Internal (2 devs) |
| Phase 1 budget approved | Pending confirmation |
| ODPC registration covers this processing | Pending legal review |
| Retention policy for unsuccessful candidates | Pending HR sign-off (suggested: 6–12 months) |
| Pilot group for Phase 1 | Pending HR confirmation |

---

## Key Technical Choices

| Concern | Choice |
|---|---|
| AI provider | Groq — `llama-3.3-70b-versatile` |
| CV / file storage | Cloudflare R2 (no egress fees) |
| Auth | NextAuth v4 Credentials + custom `users` table |
| Email | Resend (`hire@growthpad.co.ke`) |
| Database | Supabase PostgreSQL + RLS |
| Deployment | Vercel |

---

## Risks

| Risk | Mitigation |
|---|---|
| Biased AI scoring | Anonymise CV (strip name/photo/gender) before Groq call; human makes every decision |
| Data breach | RLS on all tables; service role key server-side only; AI logs for auditability |
| Low check-in adoption | Short forms; manager buy-in; Slack reminders (Phase 4) |
| Scope creep | Phases gate features; add only after pilot feedback |
| Maintenance burden | Assign clear owner post-launch |

---

## Success Metrics

- **Hire:** time-to-shortlist reduced 50%+, hiring manager satisfaction score
- **Pulse:** 80%+ weekly check-in completion, goals with live progress, review cycle on time
