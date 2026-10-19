Kazi: Growthpad Consulting Group: Plan for AI-Assisted Recruitment & Performance Tools
Summary
Growthpad is a Nairobi-based communication, technology and digital services firm with a team of roughly 20–50 people across Kenya. As we grow, hiring and managing performance across two countries needs a consistent system. We propose that our own development team build two internal tools, in phases, using AI both to speed up development and to power key features:
The suite is named Kazi (Swahili for "work"), with two modules: Kazi Hire for recruitment and Kazi Pulse for performance management.
Recruitment & Candidate Screening Tool - a lightweight applicant tracking system (ATS) with AI-assisted CV screening, ranking and interview support.
Team Performance Management Tool - a simpler, internal version of platforms like 15Five: weekly check-ins, goals/OKRs, 1-on-1s, feedback, recognition and reviews.
Recommended approach: start with a 6–8 week MVP of the recruitment tool (fastest payoff, smallest scope), then build the performance tool in two phases. Humans make every hiring and performance decision; AI drafts, summarises and suggests.
Tool 1: Recruitment & Candidate Screening
What it does
Job setup: create a role with requirements, must-haves, nice-to-haves and a scoring rubric. AI can draft the job description from a short brief.
Application intake: public apply page or form; CVs uploaded (PDF/Word) and parsed into structured fields (experience, skills, education, location).
AI screening: each candidate scored against the rubric with a short written justification citing evidence from the CV. Shortlist suggested, never auto-rejected.
Pipeline board: stages (Applied → Screened → Interview → Offer → Hired/Rejected), notes, owner per candidate.
Interview support: AI-generated role-specific interview questions and a structured scorecard for interviewers; AI summary of interviewer feedback.
Communication: templated emails (acknowledgement, invite, rejection) drafted by AI, sent after human review.
Reporting: time-to-hire, candidates per stage, source of applicants.
Key safeguards
Human in the loop: AI ranks and explains; a recruiter makes every reject/advance decision.
Bias control: hide name, photo, age, gender, tribe/ethnicity and similar fields from the AI scoring; score only against job-related criteria; periodically review outcomes across groups.
Data protection (Kenya ): candidate and employee data is personal data under Kenya's Data Protection Act, 2019 's Data Protection Act, 2012 (Act 843). We need a consent and privacy notice on the apply form, a retention period (e.g. delete unsuccessful candidates after 6–12 months), access limited to the hiring team, and confirmation that Growthpad's registration with Kenya's Office of the Data Protection Commissioner (ODPC) 's Data Protection Commission covers this processing. Kenya's Act also gives people rights around decisions made solely by automated processing, which is another reason humans make the final call.
Transparency: tell candidates AI assists screening.
Tool 2: Team Performance Management (15Five-style)
What 15Five offers (for reference)
15Five bundles performance reviews, 1-on-1s, check-ins, OKRs, engagement surveys, manager coaching, compensation insights and an HR analytics dashboard, with AI features for drafting reviews and surfacing insights. Published pricing is roughly $4–$16 per user per month depending on modules, billed annually. We don't need all of this; the plan below picks the core that delivers most of the value.
Phase 1 - Core (MVP)
Weekly check-ins: short form each employee fills (wins, priorities, blockers, mood score 1–5). Manager reviews and comments.
Goals / OKRs: company → team → individual goals with progress tracking.
1-on-1s: shared agenda between manager and report, notes, action items carried over.
Feedback & recognition: peer shout-outs (“high fives”) and private feedback.
AI assist: summarise a team's check-ins for the manager each week; flag repeated blockers or dropping mood; suggest 1-on-1 talking points.
Phase 2 - Reviews & insights
Performance reviews: self, manager and optional peer reviews on a configurable cycle (quarterly/biannual) with competency ratings.
AI review drafting: draft review text from the quarter's check-ins, goals and feedback - the manager edits and owns the final version.
Pulse / engagement surveys: short anonymous surveys with trend charts.
Leadership dashboard: check-in completion, goal progress, engagement trends, flight-risk signals by team.
Development plans: individual development plans (IDPs) and performance improvement plans (PIPs).
Key safeguards
Employees can see what's recorded about them; private feedback rules are explicit.
AI suggestions are advisory and never the sole basis for ratings, pay or dismissal.
Survey anonymity enforced (e.g. no results shown for groups under 5 people).
Build vs. Buy
Worth deciding up front:
Option
Pros
Cons
Build internally (with AI)
Tailored to our process; no per-user fees; our data stays ours; builds in-house capability
Build + maintenance effort; security and reliability are on us
Buy (e.g. 15Five, Lattice, Workable)
Ready in weeks; mature features
Recurring per-user cost in USD; less customisation; data on vendor servers
Hybrid
Buy one, build the other
Two systems to manage
Open-source (e.g. Frappe HR, OrangeHRM, OpenCATS)
No licence fees; self-hosted so data stays with us; ready-made recruitment and appraisal modules
No AI screening built in; dated interfaces; built in PHP or Python/Frappe rather than our stack, so adding AI means learning an unfamiliar codebase; still need hosting and maintenance. Useful as a reference for feature design.

Recommendation: build both in-house. Our team already works daily with every part of the stack these tools need (React/Next.js, Node.js/Python, Supabase/PostgreSQL, NextAuth/OAuth with RBAC, Vercel CI/CD, Redis, Docker). There is no skills gap to close, so the main cost is our time, and we avoid recurring per-user USD subscriptions. Both tools could also later become products we offer to clients.
Why build makes sense for Growthpad specifically:
We already build these kinds of systems. Learning platforms, portals, field data systems and AI tools are part of what we deliver for clients, so this is within our core skill set.
Cost in our currency, not USD. Buying 15Five's full platform alone would be about $16 per user per month (roughly $5,000–$10,000 a year for a team of our size), plus a separate recruitment tool, all billed in dollars and rising with headcount.
Fits how we work across Kenya . We can build in both countries' data protection rules, KES/GHS contexts and our own review cycles rather than adapting to a US-designed product.
A showcase and a possible product. A working AI HR toolkit is a strong case study for clients, and as a founding member of the Pan African Agency Network (200+ agencies in 23+ countries) we have a ready network of similar firms who might license it later, with billing through Paystack, Flutterwave or M-Pesa.
The trade-off is our own developer time and ongoing maintenance, so we should protect the build from being displaced by client work and assign a clear owner after launch.
Proposed Technical Approach
Frontend: Next.js (App Router) + TypeScript + Tailwind CSS, responsive for mobile.
Backend: Next.js route handlers / REST APIs in Node.js; a small Python service for CV parsing and document processing if needed.
Database & storage: Supabase (PostgreSQL) with Row Level Security enforcing who sees which candidate and employee data; Supabase Storage for CVs.
Auth & permissions: NextAuth with Google/Microsoft OAuth for staff; RBAC roles - Admin, HR, Hiring Manager, Interviewer, Manager, Employee.
AI layer: LLM API (e.g. Claude) called server-side for CV extraction, rubric scoring with justifications, check-in summaries and review drafts. Prompts versioned in the repo; every AI output logged with the input it used, for auditability.
Background jobs & caching: Redis/Valkey queue for bulk CV screening, weekly summary jobs and reminder emails.
Infrastructure: Vercel hosting, GitHub Actions CI/CD with preview deploys, Docker for local dev and any Python worker; ImageKit for profile images.
Monorepo: both tools share auth, employee directory, roles, notifications and UI components - built once.
AI-assisted development: use AI coding assistants to speed up scaffolding, tests and boilerplate, with normal code review.
Timeline (indicative)
Phase
Scope
Duration
0. Discovery
Confirm requirements with HR & managers, data protection review, choose stack
1–2 weeks
1. Recruitment MVP
Jobs, intake, CV parsing, AI screening, pipeline, emails
6–8 weeks
2. Performance MVP
Check-ins, goals, 1-on-1s, recognition, AI summaries
6–8 weeks
3. Performance Phase 2
Reviews, surveys, dashboard, IDPs
6–8 weeks
4. Polish & integrations
Calendar/Slack/HRIS, reporting, hardening
Ongoing

Total to a solid version of both: roughly 5–7 months with a small team. Each phase ends with a pilot group before company-wide rollout.
Team & Budget Needs
People: 2 developers from our team (full-stack), HR lead as product owner, 2–3 managers as pilot users. No hiring or contractors needed.
Running costs: Vercel, Supabase, or Google Cloud plans; AI API usage (pay-per-use; low at internal volumes), transactional email service; Redis hosting.
One-off: possible legal review of data protection notices and policies.
Exact figures to be estimated in Discovery once headcount and hiring volume are known.
Risks
Bias or unfair AI scoring → anonymised scoring, human decisions, regular audits.
Data breach of sensitive HR data → access controls, encryption, audit logs, minimal data kept.
Low adoption (people skip check-ins) → keep forms short, manager buy-in, Slack/Teams reminders.
Scope creep toward a full 15Five clone → stick to phased scope; add features based on pilot feedback.
Maintenance burden → assign clear ownership after launch.
Success Measures
Recruitment: time-to-shortlist reduced (target 50%+), time-to-hire, hiring manager satisfaction.
Performance: weekly check-in completion (target 80%+), goals with up-to-date progress, review cycle completed on time, engagement trend.
Decisions Needed
Approve build approach (vs. buy/hybrid).
Which tool goes first (recommended: recruitment).
Who owns each tool on the business side (likely HR).
Developer resource: internal, contract, or mixed.
Budget envelope for Discovery + Phase 1.
Next Steps
30-minute session with HR and 2–3 managers to confirm must-have features.
Confirm data protection obligations and retention policy.
Produce clickable mockups for the recruitment tool.
Kick off Phase 1 build.


DB Credentials:

DBPassword: 2cjGnh9eruBj2aVr
Project ID: vefioteqgbbhdznqttmw
Publishable key: sb_publishable_LbVrRwRKY5uIRwL50OSBNw_lvLrkoHp
Secret keys: sb_secret_UctWqKBU2HeE3uZFFQg6WQ_nQA5Rs2N
Anon: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlZmlvdGVxZ2JiaGR6bnF0dG13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MDkwNzEsImV4cCI6MjEwNzk4NTA3MX0.pjYjh3zWXOAVRuo4NkwdbE7yw2-C0dx1RJJmgLN6UAw
service_role: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlZmlvdGVxZ2JiaGR6bnF0dG13Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjQwOTA3MSwiZXhwIjoyMTA3OTg1MDcxfQ.1Homi6_AfT7_psAf8inUInjRVAjJCNY4t-U-TJTk2cU
Legacy JWT: SqFUo26C7M3Zi5idoPDp34D0WSr7ezZ6cdz0p1BcvtgP2nb3/6jhhSyhtbIwgkk8iJrEuJgIManwV2PDkPZF6w==
