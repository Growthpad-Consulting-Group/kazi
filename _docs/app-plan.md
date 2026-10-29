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

## Phase 2 — Kazi Pulse MVP (Performance) ✅

### Setup

- [x] Performance module DB schema migration (`002_pulse_schema.sql`)
- [x] Employee directory / people list page (`/people`)
- [x] Manager ↔ report relationships (`manager_id` on users table)

### Weekly Check-ins

- [x] Employee check-in form (wins, priorities, blockers, mood 1–5)
- [x] Manager review + comment on check-ins
- [x] AI summary of team check-ins for manager (Groq) — "AI Summary" button in team view
- [x] Repeated-blocker / dropping-mood flag — "Low mood" / "Blocker ×2" badges in team view

### Goals / OKRs

- [x] Company → team → individual goal hierarchy
- [x] Progress updates on goals (slider + status picker)
- [x] Goal completion percentage roll-up to parent (auto on child update)

### 1-on-1s

- [x] Shared agenda (manager + report)
- [x] Notes and action items with done/undone toggle
- [x] AI-suggested talking points from check-ins (Groq)
- [x] Action items carried forward from previous session (↩ carried over badge)

### Feedback & Recognition

- [x] Peer shout-outs (kudos with emoji, public wall)
- [x] Private feedback between individuals

### Pulse Dashboard

- [x] My check-in status + mood for the week
- [x] Team check-in completion count + avg mood (managers)
- [x] Quick links with alert indicator for missing check-in

---

## Phase 3 — Performance Phase 2 (Reviews, Surveys, IDPs, PIPs) ✅

### Review Cycles

- [x] Self / manager / peer performance reviews (configurable cycle — quarterly / biannual / annual)
- [x] Competency ratings (1–5) per criterion with comments
- [x] Overall rating auto-calculated from competency scores
- [x] AI review draft from quarter's check-ins + goals (Groq, JSON mode)
- [x] Strengths and development areas fields
- [x] Save draft / submit flow with status tracking

### Engagement Surveys

- [x] Survey builder (scale 1–5 and open-text question types)
- [x] Anonymous mode with results hidden until ≥ 5 responses
- [x] Survey status flow: draft → active → closed
- [x] Response collection with duplicate prevention
- [x] Results view: bar chart for scale, quoted text for open questions

### Individual Development Plans (IDPs)

- [x] IDP creation with goals text and due date
- [x] Action step checklist with due dates and done toggle
- [x] Status management: active / completed / cancelled

### Performance Improvement Plans (PIPs)

- [x] Manager-created PIPs for direct reports
- [x] Concern, expected outcomes, support provided, check-in frequency
- [x] Action step checklist (manager adds, employee checks off)
- [x] Manager-only "Mark Resolved" action

### Leadership Analytics Dashboard

- [x] KPI cards: check-in completion rate, avg mood, goal progress, flight risk count
- [x] Weekly check-in completion trend bar chart (last 4 weeks)
- [x] Goal status distribution (not started / in progress / at risk / completed)
- [x] Flight-risk signals: employees with 2+ low-mood or blockers in 3+ of last 4 weeks
- [x] Department breakdown table for HR (headcount, completion %, avg mood, at-risk)

---

## Phase 4 — Polish & Integrations

- [ ] Slack / Teams notifications (check-in reminders, new candidates, stage changes)
- [ ] Google / Outlook calendar sync for interviews
- [x] Bulk CV screening queue — Upstash Redis (Valkey) FIFO queue, Vercel Cron worker every 2 min, batch size 5
- [x] HRIS export (CSV) — candidates, employees, review summaries (`/api/export/*`)
- [x] Candidate data retention / deletion workflow (ODPC / Kenya Data Protection Act compliance)
- [x] GitHub Actions CI — type check + lint + build on push/PR to main
- [ ] Vercel preview deploys (configure in Vercel dashboard; CI workflow in place)
- [ ] End-to-end tests (Playwright)
- [ ] Penetration / security review

---

## Ongoing Decisions

| Decision                                     | Status                                       |
| -------------------------------------------- | -------------------------------------------- |
| Build vs. buy                                | ✅ Build in-house                            |
| First module                                 | ✅ Kazi Hire                                 |
| Business owner                               | HR lead (confirm name)                       |
| Developer resource                           | Internal (2 devs)                            |
| Phase 1 budget approved                      | Pending confirmation                         |
| ODPC registration covers this processing     | Pending legal review                         |
| Retention policy for unsuccessful candidates | Pending HR sign-off (suggested: 6–12 months) |
| Pilot group for Phase 1                      | Pending HR confirmation                      |

---

## Key Technical Choices

| Concern           | Choice                                         |
| ----------------- | ---------------------------------------------- |
| AI provider       | Groq — `llama-3.3-70b-versatile`               |
| CV / file storage | Cloudflare R2 (no egress fees)                 |
| Auth              | NextAuth v4 Credentials + custom `users` table |
| Email             | Resend (`hire@growthpad.co.ke`)                |
| Database          | Supabase PostgreSQL + RLS                      |
| Deployment        | Vercel                                         |

---

## Risks

| Risk                  | Mitigation                                                                          |
| --------------------- | ----------------------------------------------------------------------------------- |
| Biased AI scoring     | Anonymise CV (strip name/photo/gender) before Groq call; human makes every decision |
| Data breach           | RLS on all tables; service role key server-side only; AI logs for auditability      |
| Low check-in adoption | Short forms; manager buy-in; Slack reminders (Phase 4)                              |
| Scope creep           | Phases gate features; add only after pilot feedback                                 |
| Maintenance burden    | Assign clear owner post-launch                                                      |

---

## Success Metrics

- **Hire:** time-to-shortlist reduced 50%+, hiring manager satisfaction score
- **Pulse:** 80%+ weekly check-in completion, goals with live progress, review cycle on time
