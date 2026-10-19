/**
 * Kazi Demo Seed Script
 * Run: npx tsx scripts/seed.ts
 *
 * Seeds: users, jobs, candidates (with AI scores), check-ins, goals,
 * 1-on-1s, feedback/kudos, review cycle + reviews, surveys + responses, IDPs, PIPs
 */

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
function weeksAgo(n: number) { return daysAgo(n * 7); }
function dateOnly(daysBack: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().split("T")[0];
}
function monday(weeksBack: number) {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7) - weeksBack * 7);
  return d.toISOString().split("T")[0];
}

async function wipe() {
  // Delete in FK-safe order
  const tables = [
    "ai_logs","interview_scorecards","candidate_notes",
    "pips","idps","survey_responses","surveys",
    "performance_reviews","review_cycles",
    "feedback","one_on_ones","goals","checkins",
    "candidates","jobs","sessions","users",
  ];
  for (const t of tables) {
    const { error } = await supabase.from(t).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) console.warn(`  wipe ${t}: ${error.message}`);
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱  Wiping existing demo data…");
  await wipe();

  const hash = await bcrypt.hash("Demo1234!", 10);

  // ══════════════════════════════════════════════════════════════════════════
  // 1. USERS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("👤  Seeding users…");

  const { data: users, error: uErr } = await supabase.from("users").insert([
    // HR / Admin
    { email: "admin@growthpad.africa",   name: "Ama Owusu",       password_hash: hash, role: "admin",          department: "Operations",  job_title: "CEO",                   is_active: true, start_date: dateOnly(730) },
    { email: "hr@growthpad.africa",      name: "Kofi Mensah",     password_hash: hash, role: "hr",             department: "HR",          job_title: "HR Manager",            is_active: true, start_date: dateOnly(600) },
    // Managers
    { email: "eng.mgr@growthpad.africa", name: "Abena Asante",    password_hash: hash, role: "manager",        department: "Engineering", job_title: "Engineering Manager",   is_active: true, start_date: dateOnly(500), location: "Accra" },
    { email: "mkt.mgr@growthpad.africa", name: "Kwame Darko",     password_hash: hash, role: "hiring_manager", department: "Marketing",   job_title: "Marketing Lead",        is_active: true, start_date: dateOnly(480), location: "Accra" },
    // Interviewers / employees
    { email: "dev1@growthpad.africa",    name: "Efua Boateng",    password_hash: hash, role: "employee",       department: "Engineering", job_title: "Senior Developer",      is_active: true, start_date: dateOnly(400), location: "Kumasi" },
    { email: "dev2@growthpad.africa",    name: "Yaw Acheampong",  password_hash: hash, role: "employee",       department: "Engineering", job_title: "Backend Developer",     is_active: true, start_date: dateOnly(300), location: "Accra" },
    { email: "des1@growthpad.africa",    name: "Akosua Adjei",    password_hash: hash, role: "employee",       department: "Design",      job_title: "UI/UX Designer",        is_active: true, start_date: dateOnly(250), location: "Accra" },
    { email: "mkt1@growthpad.africa",    name: "Nana Frimpong",   password_hash: hash, role: "employee",       department: "Marketing",   job_title: "Digital Marketer",      is_active: true, start_date: dateOnly(200), location: "Tema" },
    { email: "ops1@growthpad.africa",    name: "Adjoa Amponsah",  password_hash: hash, role: "employee",       department: "Operations",  job_title: "Operations Analyst",    is_active: true, start_date: dateOnly(180), location: "Accra" },
    { email: "fin1@growthpad.africa",    name: "Kweku Antwi",     password_hash: hash, role: "employee",       department: "Finance",     job_title: "Finance Officer",       is_active: true, start_date: dateOnly(160), location: "Accra" },
    { email: "interviewer@growthpad.africa", name: "Serwaa Bonsu", password_hash: hash, role: "interviewer",  department: "Engineering", job_title: "Tech Lead",             is_active: true, start_date: dateOnly(350), location: "Accra" },
  ]).select();
  if (uErr) throw uErr;

  const byEmail = Object.fromEntries(users!.map((u: { email: string; id: string }) => [u.email, u.id]));
  const adminId    = byEmail["admin@growthpad.africa"];
  const hrId       = byEmail["hr@growthpad.africa"];
  const engMgrId   = byEmail["eng.mgr@growthpad.africa"];
  const mktMgrId   = byEmail["mkt.mgr@growthpad.africa"];
  const dev1Id     = byEmail["dev1@growthpad.africa"];
  const dev2Id     = byEmail["dev2@growthpad.africa"];
  const des1Id     = byEmail["des1@growthpad.africa"];
  const mkt1Id     = byEmail["mkt1@growthpad.africa"];
  const ops1Id     = byEmail["ops1@growthpad.africa"];
  const fin1Id     = byEmail["fin1@growthpad.africa"];
  const interId    = byEmail["interviewer@growthpad.africa"];

  // Assign manager relationships
  await supabase.from("users").update({ manager_id: engMgrId }).in("id", [dev1Id, dev2Id, des1Id, interId]);
  await supabase.from("users").update({ manager_id: mktMgrId }).in("id", [mkt1Id]);
  await supabase.from("users").update({ manager_id: adminId  }).in("id", [engMgrId, mktMgrId, ops1Id, fin1Id]);
  await supabase.from("users").update({ manager_id: hrId     }).in("id", [hrId]); // HR self-reference to avoid null issues — skip

  // ══════════════════════════════════════════════════════════════════════════
  // 2. JOBS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("💼  Seeding jobs…");

  const { data: jobs, error: jErr } = await supabase.from("jobs").insert([
    {
      title: "Senior Full-Stack Developer",
      department: "Engineering",
      location: "Accra, Ghana (Hybrid)",
      description: "We are looking for a Senior Full-Stack Developer to lead product development on our SaaS platform.",
      requirements: { must_haves: ["5+ years React", "Node.js", "PostgreSQL", "TypeScript"], nice_to_haves: ["Next.js", "Supabase", "AWS"] },
      scoring_rubric: [{ criterion: "Technical depth", weight: 40 }, { criterion: "Communication", weight: 30 }, { criterion: "Culture fit", weight: 30 }],
      status: "open",
      created_by: engMgrId,
      created_at: daysAgo(45),
    },
    {
      title: "Product Designer (UI/UX)",
      department: "Design",
      location: "Remote – Africa",
      description: "Join our design team to craft delightful, accessible experiences across web and mobile.",
      requirements: { must_haves: ["Figma expert", "3+ years product design", "Design systems"], nice_to_haves: ["Motion design", "React basics", "User research"] },
      scoring_rubric: [{ criterion: "Portfolio quality", weight: 50 }, { criterion: "Systems thinking", weight: 30 }, { criterion: "Collaboration", weight: 20 }],
      status: "open",
      created_by: engMgrId,
      created_at: daysAgo(30),
    },
    {
      title: "Digital Marketing Manager",
      department: "Marketing",
      location: "Accra, Ghana",
      description: "Drive our digital growth strategy across SEO, paid media, and content marketing.",
      requirements: { must_haves: ["4+ years digital marketing", "Google Ads", "Meta Ads", "Analytics"], nice_to_haves: ["B2B SaaS experience", "HubSpot", "SEO tools"] },
      scoring_rubric: [{ criterion: "Campaign results", weight: 45 }, { criterion: "Strategy", weight: 35 }, { criterion: "Tools proficiency", weight: 20 }],
      status: "open",
      created_by: mktMgrId,
      created_at: daysAgo(20),
    },
    {
      title: "DevOps Engineer",
      department: "Engineering",
      location: "Accra or Remote",
      description: "Build and maintain our cloud infrastructure, CI/CD pipelines, and monitoring systems.",
      requirements: { must_haves: ["Kubernetes", "Terraform", "AWS/GCP", "Docker"], nice_to_haves: ["Cloudflare Workers", "GitHub Actions", "Prometheus"] },
      scoring_rubric: [{ criterion: "Infrastructure experience", weight: 50 }, { criterion: "Security mindset", weight: 30 }, { criterion: "Problem solving", weight: 20 }],
      status: "open",
      created_by: engMgrId,
      created_at: daysAgo(10),
    },
    {
      title: "Finance Analyst",
      department: "Finance",
      location: "Accra, Ghana",
      description: "Support financial planning, analysis, and reporting for the Growthpad group.",
      requirements: { must_haves: ["ACCA/CPA", "Excel advanced", "Financial modeling"], nice_to_haves: ["Power BI", "ERP systems", "FP&A experience"] },
      scoring_rubric: [{ criterion: "Analytical skills", weight: 40 }, { criterion: "Accuracy", weight: 40 }, { criterion: "Communication", weight: 20 }],
      status: "closed",
      created_by: adminId,
      created_at: daysAgo(90),
    },
  ]).select();
  if (jErr) throw jErr;

  const jobIds = Object.fromEntries(jobs!.map((j: { title: string; id: string }) => [j.title, j.id]));

  // ══════════════════════════════════════════════════════════════════════════
  // 3. CANDIDATES
  // ══════════════════════════════════════════════════════════════════════════
  console.log("🧑‍💼  Seeding candidates…");

  const devJobId  = jobIds["Senior Full-Stack Developer"];
  const desJobId  = jobIds["Product Designer (UI/UX)"];
  const mktJobId  = jobIds["Digital Marketing Manager"];
  const devopsId  = jobIds["DevOps Engineer"];
  const finJobId  = jobIds["Finance Analyst"];

  const { data: candidates, error: cErr } = await supabase.from("candidates").insert([
    // Full-Stack candidates
    { job_id: devJobId,  full_name: "Kofi Asamoah",      email: "kofi.a@email.com",    phone: "+233201234567", location: "Accra",   stage: "interview", ai_score: 87.5, ai_justification: "Strong TypeScript and React experience with 6 years. Led 3 major product launches. Minor gap in DevOps.", shortlisted: true, source: "linkedin",   applied_at: daysAgo(40), consented_at: daysAgo(40) },
    { job_id: devJobId,  full_name: "Priya Sharma",       email: "priya.s@email.com",   phone: "+234801234567", location: "Lagos",   stage: "offer",     ai_score: 91.0, ai_justification: "Exceptional full-stack profile. Next.js + Supabase experience highly relevant. Excellent communication.",  shortlisted: true, source: "referral",   applied_at: daysAgo(35), consented_at: daysAgo(35) },
    { job_id: devJobId,  full_name: "Samuel Ntiamoah",   email: "sam.n@email.com",     phone: "+233271234567", location: "Kumasi",  stage: "screened",  ai_score: 72.0, ai_justification: "Good React fundamentals but limited PostgreSQL depth. Worth a technical screen.",  shortlisted: false, source: "direct",  applied_at: daysAgo(30), consented_at: daysAgo(30) },
    { job_id: devJobId,  full_name: "Amara Diallo",       email: "amara.d@email.com",   phone: "+221771234567", location: "Dakar",   stage: "screened",  ai_score: 68.0, ai_justification: "Strong backend (Node/Express) but frontend skills below the bar for a senior role.",  shortlisted: false, source: "linkedin", applied_at: daysAgo(28), consented_at: daysAgo(28) },
    { job_id: devJobId,  full_name: "Tunde Bello",        email: "tunde.b@email.com",   phone: "+234701234567", location: "Abuja",   stage: "applied",   ai_score: 55.0, ai_justification: "CV lacks depth on required skills. Experience appears overstated.", shortlisted: false, source: "direct",   applied_at: daysAgo(5),  consented_at: daysAgo(5) },
    { job_id: devJobId,  full_name: "Fatima Ouedraogo",   email: "fatima.o@email.com",  phone: "+22671234567",  location: "Ouaga",   stage: "rejected",  ai_score: 41.0, ai_justification: "No TypeScript or modern React. Background primarily in PHP/WordPress.", shortlisted: false, source: "direct",   applied_at: daysAgo(42), consented_at: daysAgo(42) },
    { job_id: devJobId,  full_name: "Bright Mensah",      email: "bright.m@email.com",  phone: "+233551234567", location: "Accra",   stage: "hired",     ai_score: 88.0, ai_justification: "Excellent match. 7 years experience, open-source contributions, great cultural fit.", shortlisted: true, source: "linkedin", applied_at: daysAgo(60), consented_at: daysAgo(60) },
    { job_id: devJobId,  full_name: "Nia Oppong",         email: "nia.o@email.com",     phone: "+233201112233", location: "Accra",   stage: "applied",   ai_score: null, shortlisted: false, source: "direct",   applied_at: daysAgo(2), consented_at: daysAgo(2) },
    { job_id: devJobId,  full_name: "Isaac Forson",       email: "isaac.f@email.com",   phone: "+233201223344", location: "Tema",    stage: "applied",   ai_score: null, shortlisted: false, source: "referral", applied_at: daysAgo(1), consented_at: daysAgo(1) },
    // Designer candidates
    { job_id: desJobId,  full_name: "Chidera Okonkwo",    email: "chi.o@email.com",     phone: "+234811234567", location: "Lagos",   stage: "interview", ai_score: 84.0, ai_justification: "Strong Figma portfolio with proven design system work. Mobile-first thinking evident throughout.", shortlisted: true, source: "linkedin", applied_at: daysAgo(25), consented_at: daysAgo(25) },
    { job_id: desJobId,  full_name: "Grace Asiedu",       email: "grace.a@email.com",   phone: "+233241234567", location: "Accra",   stage: "screened",  ai_score: 76.5, ai_justification: "Solid UI skills. Weaker on user research methodology but trainable.", shortlisted: false, source: "direct",  applied_at: daysAgo(22), consented_at: daysAgo(22) },
    { job_id: desJobId,  full_name: "Moussa Traoré",      email: "moussa.t@email.com",  phone: "+22361234567",  location: "Bamako",  stage: "applied",   ai_score: null, shortlisted: false, source: "linkedin", applied_at: daysAgo(3), consented_at: daysAgo(3) },
    // Marketing candidates
    { job_id: mktJobId,  full_name: "Abena Kyei",         email: "abena.k@email.com",   phone: "+233261234567", location: "Accra",   stage: "offer",     ai_score: 89.0, ai_justification: "7 years B2B digital marketing. Proven ROI track record with Google and Meta campaigns.", shortlisted: true, source: "referral", applied_at: daysAgo(18), consented_at: daysAgo(18) },
    { job_id: mktJobId,  full_name: "Seun Adeyemi",       email: "seun.a@email.com",    phone: "+234811234568", location: "Lagos",   stage: "screened",  ai_score: 65.0, ai_justification: "Good social media skills but limited paid media experience. B2C background may not translate.", shortlisted: false, source: "direct", applied_at: daysAgo(15), consented_at: daysAgo(15) },
    { job_id: mktJobId,  full_name: "Kemi Osei",          email: "kemi.o@email.com",    phone: "+233551122334", location: "Accra",   stage: "applied",   ai_score: null, shortlisted: false, source: "direct",   applied_at: daysAgo(4), consented_at: daysAgo(4) },
    // DevOps candidates
    { job_id: devopsId,  full_name: "Ali Hassan",         email: "ali.h@email.com",     phone: "+254701234567", location: "Nairobi", stage: "screened",  ai_score: 79.5, ai_justification: "Strong Kubernetes/Terraform background. AWS certified. Limited Cloudflare Workers experience.", shortlisted: true, source: "linkedin", applied_at: daysAgo(8), consented_at: daysAgo(8) },
    { job_id: devopsId,  full_name: "Taiwo Adebisi",      email: "taiwo.a@email.com",   phone: "+234901234567", location: "Lagos",   stage: "applied",   ai_score: null, shortlisted: false, source: "direct",   applied_at: daysAgo(6), consented_at: daysAgo(6) },
    { job_id: devopsId,  full_name: "Njoku Chinedu",      email: "njoku.c@email.com",   phone: "+234821234567", location: "Enugu",   stage: "applied",   ai_score: null, shortlisted: false, source: "linkedin", applied_at: daysAgo(3), consented_at: daysAgo(3) },
    // Finance candidates (closed job — all resolved)
    { job_id: finJobId,  full_name: "Maame Serwaa",       email: "maame.s@email.com",   phone: "+233201234578", location: "Accra",   stage: "hired",     ai_score: 92.0, ai_justification: "ACCA finalist with 5 years FP&A. Excellent financial modeling test score.", shortlisted: true, source: "referral", applied_at: daysAgo(85), consented_at: daysAgo(85) },
    { job_id: finJobId,  full_name: "Kwabena Duah",       email: "kwabena.d@email.com", phone: "+233271234578", location: "Accra",   stage: "rejected",  ai_score: 58.0, ai_justification: "Good foundational knowledge but modeling test results below threshold.", shortlisted: false, source: "direct", applied_at: daysAgo(87), consented_at: daysAgo(87) },
  ]).select();
  if (cErr) throw cErr;

  const candByName = Object.fromEntries(candidates!.map((c: { full_name: string; id: string }) => [c.full_name, c.id]));

  // ══════════════════════════════════════════════════════════════════════════
  // 4. CANDIDATE NOTES & INTERVIEW SCORECARDS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("📝  Seeding notes & scorecards…");

  await supabase.from("candidate_notes").insert([
    { candidate_id: candByName["Priya Sharma"],    user_id: engMgrId,  note: "Excellent technical call. Strong Next.js architecture discussion. Moving to offer.", created_at: daysAgo(10) },
    { candidate_id: candByName["Kofi Asamoah"],    user_id: interId,   note: "Live coding went well. Confident with TypeScript generics. Schedule final round.", created_at: daysAgo(15) },
    { candidate_id: candByName["Abena Kyei"],      user_id: mktMgrId,  note: "Impressive campaign case study. Negotiating salary band now.", created_at: daysAgo(3) },
  ]);

  await supabase.from("interview_scorecards").insert([
    {
      candidate_id: candByName["Kofi Asamoah"], interviewer_id: interId,
      questions: [
        { question: "Design a URL shortener system", answer: "Described Redis caching, hash generation, analytics layer", score: 4 },
        { question: "Explain Next.js ISR vs SSR", answer: "Accurate explanation with real-world tradeoffs", score: 5 },
        { question: "How do you handle database migrations?", answer: "Mentioned versioned migrations, rollback strategies", score: 4 },
      ],
      overall_score: 4.3,
      recommendation: "hire",
      ai_summary: "Strong candidate with solid system design thinking. Minor gaps in distributed systems but compensates with strong product sense.",
      submitted_at: daysAgo(14),
    },
    {
      candidate_id: candByName["Priya Sharma"], interviewer_id: engMgrId,
      questions: [
        { question: "Walk through a complex performance optimization you've done", answer: "Detailed explanation of React virtualization and bundle splitting", score: 5 },
        { question: "How do you approach API design?", answer: "RESTful with OpenAPI specs, versioning strategy discussed", score: 5 },
        { question: "Describe your experience with real-time features", answer: "WebSockets and Supabase realtime used in previous role", score: 4 },
      ],
      overall_score: 4.7,
      recommendation: "hire",
      ai_summary: "Top candidate. Exceptional technical depth and communication. Strong fit for senior role. Recommend fast-tracking offer.",
      submitted_at: daysAgo(9),
    },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // 5. WEEKLY CHECK-INS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("📋  Seeding check-ins…");

  const employeeIds = [dev1Id, dev2Id, des1Id, mkt1Id, ops1Id, fin1Id];
  const checkinsData = [];

  for (const uid of employeeIds) {
    for (let w = 0; w < 6; w++) {
      const mood = w === 2 ? 2 : w === 3 ? 2 : Math.floor(Math.random() * 2) + 3; // dip at weeks 2–3
      checkinsData.push({
        user_id: uid,
        week_start: monday(w),
        wins: ["Shipped the new API endpoint", "Fixed critical bug in production", "Completed design review with stakeholder", "Onboarded new integration partner", "Delivered sprint demo", "Closed 2 new leads"][w % 6],
        priorities: ["Complete Q3 OKR milestone", "Code review backlog clearance", "Prepare presentation for board", "Customer discovery calls", "Sprint planning", "Budget review"][w % 6],
        blockers: w === 2 ? "Waiting on design sign-off from external team — blocking feature release" : w === 3 ? "Still blocked on API credentials from third-party vendor" : null,
        mood,
        status: w === 0 ? "submitted" : "reviewed",
        manager_comment: w > 0 ? "Great progress! Let's discuss the blocker in our 1-on-1 this week." : null,
        reviewed_by: uid === dev1Id || uid === dev2Id || uid === des1Id || uid === interId ? engMgrId : uid === mkt1Id ? mktMgrId : adminId,
        reviewed_at: w > 0 ? daysAgo(w * 7 - 1) : null,
        created_at: daysAgo(w * 7),
      });
    }
  }
  await supabase.from("checkins").insert(checkinsData);

  // ══════════════════════════════════════════════════════════════════════════
  // 6. GOALS / OKRs
  // ══════════════════════════════════════════════════════════════════════════
  console.log("🎯  Seeding goals…");

  const { data: companyGoals } = await supabase.from("goals").insert([
    { title: "Grow ARR to $500k by Q4", level: "company", owner_id: null, status: "in_progress", progress: 62, due_date: dateOnly(-90), created_by: adminId, created_at: daysAgo(120) },
    { title: "Launch Kazi HR platform publicly", level: "company", owner_id: null, status: "in_progress", progress: 78, due_date: dateOnly(-30), created_by: adminId, created_at: daysAgo(90) },
    { title: "Achieve 95% employee satisfaction score", level: "company", owner_id: null, status: "not_started", progress: 0, due_date: dateOnly(-180), created_by: hrId, created_at: daysAgo(60) },
  ]).select();

  const cgIds = companyGoals!.map((g: { id: string }) => g.id);

  await supabase.from("goals").insert([
    // Team goals
    { title: "Ship 3 major product features this quarter", level: "team", owner_id: engMgrId, parent_id: cgIds[1], status: "in_progress", progress: 67, due_date: dateOnly(-60), created_by: engMgrId, created_at: daysAgo(90) },
    { title: "Reduce bug backlog by 50%", level: "team", owner_id: engMgrId, status: "in_progress", progress: 45, due_date: dateOnly(-45), created_by: engMgrId, created_at: daysAgo(80) },
    { title: "Launch 2 paid acquisition campaigns", level: "team", owner_id: mktMgrId, parent_id: cgIds[0], status: "in_progress", progress: 50, due_date: dateOnly(-60), created_by: mktMgrId, created_at: daysAgo(75) },
    // Individual goals
    { title: "Complete Next.js 15 migration for main app", level: "individual", owner_id: dev1Id, status: "in_progress", progress: 80, due_date: dateOnly(-20), created_by: dev1Id, created_at: daysAgo(60) },
    { title: "Build Kazi design system v2", level: "individual", owner_id: des1Id, status: "in_progress", progress: 55, due_date: dateOnly(-30), created_by: des1Id, created_at: daysAgo(50) },
    { title: "Pass Google Ads certification", level: "individual", owner_id: mkt1Id, status: "completed", progress: 100, due_date: dateOnly(10), created_by: mkt1Id, created_at: daysAgo(70) },
    { title: "Automate monthly financial reporting", level: "individual", owner_id: fin1Id, status: "not_started", progress: 0, due_date: dateOnly(-90), created_by: fin1Id, created_at: daysAgo(30) },
    { title: "Contribute to 2 open-source projects", level: "individual", owner_id: dev2Id, status: "at_risk", progress: 20, due_date: dateOnly(-15), created_by: dev2Id, created_at: daysAgo(45) },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // 7. 1-ON-1s
  // ══════════════════════════════════════════════════════════════════════════
  console.log("🤝  Seeding 1-on-1s…");

  await supabase.from("one_on_ones").insert([
    {
      manager_id: engMgrId, report_id: dev1Id,
      scheduled_at: daysAgo(7),
      agenda: "Q3 progress review, design system status, career growth discussion",
      notes: "Efua is on track for promotion. Discussed stretch assignment as tech lead for the upcoming mobile app sprint.",
      action_items: [{ text: "Share tech lead JD draft", done: true }, { text: "Set up pairing session with Yaw", done: false }],
      ai_talking_points: "1. Efua's goal progress is strong (80%) — discuss timeline confidence. 2. Team morale dip in weeks 2–3 check-ins — explore root cause. 3. Career growth: is she interested in a lead role?",
      created_at: daysAgo(14),
    },
    {
      manager_id: engMgrId, report_id: dev2Id,
      scheduled_at: daysAgo(5),
      agenda: "Open-source goal review, blockers, performance feedback",
      notes: "Yaw mentioned feeling stretched thin across 3 concurrent projects. Agreed to deprioritize internal tooling work.",
      action_items: [{ text: "Remove internal tooling from Yaw's sprint", done: true }, { text: "Book deep-work day for open-source contributions", done: false }],
      ai_talking_points: "1. Open-source goal at risk (20% progress, deadline in 15 days). 2. Morale trend — blockers showing in check-ins. 3. Workload recalibration needed.",
      created_at: daysAgo(12),
    },
    {
      manager_id: mktMgrId, report_id: mkt1Id,
      scheduled_at: daysAgo(3),
      agenda: "Google Ads cert celebration, Q4 campaign planning",
      notes: "Nana just passed the cert! Planning to give her the lead on the Q4 Black Friday campaign.",
      action_items: [{ text: "Draft Q4 campaign brief", done: false }, { text: "Add Nana to the media budget spreadsheet", done: true }],
      ai_talking_points: "1. Celebrate Google Ads cert completion. 2. Q4 campaign readiness — timeline and budget. 3. Career discussion: Marketing Manager track?",
      created_at: daysAgo(8),
    },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // 8. FEEDBACK / KUDOS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("🌟  Seeding feedback & kudos…");

  await supabase.from("feedback").insert([
    { from_user_id: engMgrId, to_user_id: dev1Id,  message: "Efua, the way you handled the production incident last week was exemplary. Calm under pressure and kept the team informed the whole time. 🔥", visibility: "public",  emoji: "🔥", created_at: daysAgo(5) },
    { from_user_id: dev1Id,   to_user_id: dev2Id,  message: "Yaw, thanks for the detailed code review on my PR. Your feedback on the pagination logic saved us a headache later.", visibility: "public",  emoji: "💪", created_at: daysAgo(8) },
    { from_user_id: mktMgrId, to_user_id: mkt1Id,  message: "Nana passed the Google Ads certification! This is a huge win for the team and shows real initiative. Well done! ⭐", visibility: "public",  emoji: "⭐", created_at: daysAgo(10) },
    { from_user_id: hrId,     to_user_id: des1Id,  message: "Akosua's design system work has noticeably improved consistency across all our products. The team really appreciates it.", visibility: "public",  emoji: "✨", created_at: daysAgo(12) },
    { from_user_id: adminId,  to_user_id: engMgrId,message: "Abena, the engineering team velocity this quarter has been outstanding. The culture of accountability you've built shows in the results.", visibility: "public",  emoji: "🚀", created_at: daysAgo(14) },
    { from_user_id: engMgrId, to_user_id: dev2Id,  message: "Yaw, I'd like us to discuss how we can better protect your focus time. The at-risk goal concerns me — let's fix the workload.", visibility: "private", emoji: null, created_at: daysAgo(4) },
    { from_user_id: adminId,  to_user_id: ops1Id,  message: "Adjoa handled the vendor onboarding with minimal supervision this month. Really impressed with her ownership.", visibility: "public",  emoji: "💡", created_at: daysAgo(6) },
    { from_user_id: fin1Id,   to_user_id: hrId,    message: "Kofi, the onboarding experience was really smooth for the new hires. The checklists you put together were detailed and helpful.", visibility: "public",  emoji: "👏", created_at: daysAgo(18) },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // 9. PERFORMANCE REVIEW CYCLE
  // ══════════════════════════════════════════════════════════════════════════
  console.log("⭐  Seeding review cycles…");

  const { data: cycles } = await supabase.from("review_cycles").insert([
    {
      title: "Q3 2025 Quarterly Review",
      cycle: "quarterly",
      start_date: dateOnly(60),
      end_date: dateOnly(30),
      status: "manager_review",
      created_by: hrId,
      created_at: daysAgo(75),
    },
    {
      title: "Q2 2025 Quarterly Review",
      cycle: "quarterly",
      start_date: dateOnly(150),
      end_date: dateOnly(120),
      status: "completed",
      created_by: hrId,
      created_at: daysAgo(165),
    },
  ]).select();

  const cycleQ3 = cycles![0].id;
  const cycleQ2 = cycles![1].id;

  const competencyTemplate = (scores: number[]) => [
    { criterion: "Quality of Work",     rating: scores[0], comment: "" },
    { criterion: "Collaboration",       rating: scores[1], comment: "" },
    { criterion: "Communication",       rating: scores[2], comment: "" },
    { criterion: "Initiative",          rating: scores[3], comment: "" },
    { criterion: "Technical/Functional", rating: scores[4], comment: "" },
  ];

  await supabase.from("performance_reviews").insert([
    // Q3 — self reviews
    { cycle_id: cycleQ3, reviewee_id: dev1Id,  reviewer_id: dev1Id,  review_type: "self",    competency_ratings: competencyTemplate([4,4,4,5,5]), overall_rating: 4.4, strengths: "Deep technical expertise and mentoring teammates.", development_areas: "Could delegate more effectively to grow leadership skills.", submitted_at: daysAgo(20) },
    { cycle_id: cycleQ3, reviewee_id: dev2Id,  reviewer_id: dev2Id,  review_type: "self",    competency_ratings: competencyTemplate([3,4,3,3,4]), overall_rating: 3.4, strengths: "Strong code quality and attention to detail.", development_areas: "Time management and prioritization under concurrent workloads.", submitted_at: daysAgo(18) },
    { cycle_id: cycleQ3, reviewee_id: des1Id,  reviewer_id: des1Id,  review_type: "self",    competency_ratings: competencyTemplate([5,4,4,4,5]), overall_rating: 4.4, strengths: "Exceptional design quality and user empathy.", development_areas: "Building confidence to push back on scope creep.", submitted_at: daysAgo(17) },
    { cycle_id: cycleQ3, reviewee_id: mkt1Id,  reviewer_id: mkt1Id,  review_type: "self",    competency_ratings: competencyTemplate([4,3,4,5,4]), overall_rating: 4.0, strengths: "High initiative — proactively pursued and passed Google Ads cert.", development_areas: "Cross-functional collaboration and sharing wins with the team.", submitted_at: daysAgo(16) },
    // Q3 — manager reviews
    { cycle_id: cycleQ3, reviewee_id: dev1Id,  reviewer_id: engMgrId, review_type: "manager", competency_ratings: competencyTemplate([5,4,4,5,5]), overall_rating: 4.6, strengths: "Efua is our most reliable senior IC. Production incident handling was outstanding.", development_areas: "Leadership path — ready for a tech lead stretch.", submitted_at: daysAgo(5) },
    { cycle_id: cycleQ3, reviewee_id: dev2Id,  reviewer_id: engMgrId, review_type: "manager", competency_ratings: competencyTemplate([4,4,3,3,4]), overall_rating: 3.6, strengths: "Solid technical skills and quality code.", development_areas: "Goal attainment needs attention — open-source goal at serious risk.", submitted_at: daysAgo(3) },
    // Q2 — completed reviews
    { cycle_id: cycleQ2, reviewee_id: dev1Id,  reviewer_id: engMgrId, review_type: "manager", competency_ratings: competencyTemplate([4,4,5,4,5]), overall_rating: 4.4, strengths: "Consistently strong performer.", development_areas: "Continue developing documentation habits.", submitted_at: daysAgo(120) },
    { cycle_id: cycleQ2, reviewee_id: mkt1Id,  reviewer_id: mktMgrId, review_type: "manager", competency_ratings: competencyTemplate([3,3,4,4,3]), overall_rating: 3.4, strengths: "Growing quickly in paid media skills.", development_areas: "Needs to improve campaign reporting rigor.", submitted_at: daysAgo(118) },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // 10. SURVEYS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("📊  Seeding surveys…");

  const { data: surveys } = await supabase.from("surveys").insert([
    {
      title: "Q3 Employee Engagement Pulse",
      description: "A quick check on how the team is feeling this quarter.",
      questions: [
        { id: "q1", text: "How satisfied are you with your current role?", type: "scale" },
        { id: "q2", text: "Do you feel your manager supports your growth?", type: "scale" },
        { id: "q3", text: "How likely are you to recommend Growthpad as a great place to work?", type: "scale" },
        { id: "q4", text: "What's one thing we could improve about how we work together?", type: "text" },
      ],
      status: "closed",
      anonymous: true,
      created_by: hrId,
      opens_at: daysAgo(30),
      closes_at: daysAgo(7),
      created_at: daysAgo(35),
    },
    {
      title: "Remote Work Policy Feedback",
      description: "Share your thoughts on our current hybrid working arrangements.",
      questions: [
        { id: "q1", text: "The current hybrid policy meets my needs", type: "scale" },
        { id: "q2", text: "I have the tools I need to work effectively from home", type: "scale" },
        { id: "q3", text: "What would make remote work better for you?", type: "text" },
      ],
      status: "active",
      anonymous: false,
      created_by: hrId,
      opens_at: daysAgo(5),
      closes_at: daysAgo(-14),
      created_at: daysAgo(7),
    },
  ]).select();

  // Survey responses for Q3 Engagement Pulse
  const surveyQ3Id = surveys![0].id;
  const surveyResponses = [
    { respondent: null, q1: 4, q2: 4, q3: 4, q4: "Better async communication norms would help the remote folks." },
    { respondent: null, q1: 3, q2: 4, q3: 4, q4: "More structured career growth conversations with managers." },
    { respondent: null, q1: 5, q2: 5, q3: 5, q4: "Nothing — keep doing what you're doing!" },
    { respondent: null, q1: 3, q2: 3, q3: 3, q4: "The tooling for knowledge sharing could be better." },
    { respondent: null, q1: 4, q2: 5, q3: 4, q4: "Team off-sites would be great for relationship building." },
    { respondent: null, q1: 4, q2: 4, q3: 5, q4: "Clearer OKR cascading from company to individuals." },
  ];
  await supabase.from("survey_responses").insert(
    surveyResponses.map((r) => ({
      survey_id: surveyQ3Id,
      respondent_id: null,
      answers: { q1: r.q1, q2: r.q2, q3: r.q3, q4: r.q4 },
      submitted_at: daysAgo(Math.floor(Math.random() * 23) + 7),
    }))
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 11. IDPs
  // ══════════════════════════════════════════════════════════════════════════
  console.log("📈  Seeding IDPs…");

  await supabase.from("idps").insert([
    {
      user_id: dev1Id, manager_id: engMgrId,
      title: "Efua — Engineering Lead Readiness",
      goals: "Develop leadership and project management skills to step into a Tech Lead role by Q1 next year. Focus on system design, stakeholder communication, and mentoring junior engineers.",
      actions: [
        { text: "Complete system design course (Educative.io)", due_date: dateOnly(-30), done: true },
        { text: "Lead 1 major feature end-to-end (as tech lead)", due_date: dateOnly(-15), done: true },
        { text: "Mentor dev2 on TypeScript best practices (monthly sessions)", due_date: dateOnly(-60), done: false },
        { text: "Present architecture review to engineering team", due_date: dateOnly(-45), done: false },
      ],
      status: "active",
      due_date: dateOnly(-90),
      created_at: daysAgo(60),
    },
    {
      user_id: des1Id, manager_id: engMgrId,
      title: "Akosua — Senior Designer Transition",
      goals: "Transition from mid to senior IC by deepening product strategy involvement and building cross-functional influence.",
      actions: [
        { text: "Run a full discovery sprint independently", due_date: dateOnly(-20), done: false },
        { text: "Complete Interaction Design Foundation UX Research course", due_date: dateOnly(-10), done: true },
        { text: "Present design principles to the whole company (all-hands)", due_date: dateOnly(-40), done: false },
      ],
      status: "active",
      due_date: dateOnly(-60),
      created_at: daysAgo(45),
    },
    {
      user_id: mkt1Id, manager_id: mktMgrId,
      title: "Nana — Marketing Manager Track",
      goals: "Build skills to move from Digital Marketer to Marketing Manager. Focus on strategy, budget ownership, and team collaboration.",
      actions: [
        { text: "Pass Google Ads certification", due_date: dateOnly(10), done: true },
        { text: "Own Q4 campaign budget and reporting", due_date: dateOnly(-60), done: false },
        { text: "Shadow Kwame on 3 client strategy sessions", due_date: dateOnly(-30), done: true },
      ],
      status: "active",
      due_date: dateOnly(-90),
      created_at: daysAgo(70),
    },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // 12. PIPs
  // ══════════════════════════════════════════════════════════════════════════
  console.log("⚠️   Seeding PIPs…");

  await supabase.from("pips").insert([
    {
      user_id: dev2Id, manager_id: engMgrId, hr_id: hrId,
      concern: "Yaw has missed two consecutive personal goals (open-source contributions and Q3 code quality target). Check-in mood scores have trended downward over 4 weeks, and there have been two incidents of blocked delivery due to incomplete work handover.",
      expected_outcomes: "1. Complete the open-source contributions goal (2 contributions) by end of month. 2. Consistent on-time handover of sprint tasks. 3. Mood score average of 3+ over the next 4 check-ins. 4. Regular blockers raised proactively — not discovered by manager.",
      support_provided: "Workload has been adjusted (internal tooling removed from sprint). 1-on-1 frequency increased to weekly. Manager available for pair debugging sessions on Tuesdays.",
      check_in_frequency: "weekly",
      actions: [
        { text: "First open-source PR merged", due_date: dateOnly(-14), done: false },
        { text: "Complete sprint handover documentation for current sprint", due_date: dateOnly(-7), done: true },
        { text: "Share weekly progress update with manager every Friday", due_date: dateOnly(-28), done: false },
        { text: "Second open-source PR merged", due_date: dateOnly(-28), done: false },
      ],
      start_date: dateOnly(14),
      review_date: dateOnly(-28),
      created_at: daysAgo(14),
    },
  ]);

  console.log("\n✅  Seed complete!\n");
  console.log("Demo login credentials (password: Demo1234! for all):");
  console.log("  admin@growthpad.africa    → Admin (full access)");
  console.log("  hr@growthpad.africa       → HR Manager");
  console.log("  eng.mgr@growthpad.africa  → Engineering Manager");
  console.log("  mkt.mgr@growthpad.africa  → Marketing / Hiring Manager");
  console.log("  dev1@growthpad.africa     → Senior Developer (Efua Boateng)");
  console.log("  dev2@growthpad.africa     → Backend Developer (Yaw Acheampong)");
  console.log("  des1@growthpad.africa     → UI/UX Designer (Akosua Adjei)");
  console.log("  mkt1@growthpad.africa     → Digital Marketer (Nana Frimpong)");
}

seed().catch((e) => { console.error(e); process.exit(1); });
