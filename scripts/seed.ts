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
    "candidates","jobs","sessions","users","departments",
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
  const adminHash = await bcrypt.hash("testpassword", 10);

  // Departments lookup list (not wiped; insert only the missing ones)
  console.log("🏢  Seeding departments…");
  const deptNames = [
    "Executive & Leadership",
    "Administration",
    "Client Delivery",
    "Project Management",
    "Strategy & Advisory",
    "Strategic Communications",
    "Marketing & Growth",
    "Creative & Content",
    "Media & Performance Marketing",
    "Design & UX",
    "Product & Innovation",
    "Digital Products & Technology",
    "Technology & Engineering",
    "IT & Infrastructure",
    "Web Development",
    "Data, Analytics & AI",
    "Research & Market Intelligence",
    "Learning & Evidence Systems",
    "Business Development & Partnerships",
    "Sales",
    "Customer Success & Support",
    "Events & Experiences",
    "Operations",
    "Finance",
    "People & Culture",
    "Legal & Compliance",
    "Procurement & Supply Chain",
  ];
  const { data: existingDepts } = await supabase.from("departments").select("name");
  const have = new Set((existingDepts ?? []).map((d: { name: string }) => d.name.toLowerCase()));
  const missing = deptNames.filter((n) => !have.has(n.toLowerCase()));
  if (missing.length) {
    const { error: dErr } = await supabase.from("departments").insert(missing.map((name) => ({ name })));
    if (dErr) console.warn(`  departments: ${dErr.message}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 1. USERS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("👤  Seeding users…");

  const { data: users, error: uErr } = await supabase.from("users").insert([
    // HR / Admin
    { email: "analytics.growthpad@gmail.com", name: "Amina Wanjiku", password_hash: adminHash, role: "admin", department: "Operations", job_title: "CEO", is_active: true, start_date: dateOnly(730), location: "Nairobi" },
    { email: "hr@growthpad.africa",      name: "David Kariuki",    password_hash: hash, role: "hr",             department: "People & Culture", job_title: "People & Culture Manager", is_active: true, start_date: dateOnly(600), location: "Nairobi" },
    // Managers
    { email: "eng.mgr@growthpad.africa", name: "Mercy Njeri",     password_hash: hash, role: "manager",        department: "Digital Products & Technology", job_title: "Digital Products Lead", is_active: true, start_date: dateOnly(500), location: "Nairobi" },
    { email: "mkt.mgr@growthpad.africa", name: "Brian Mwangi",    password_hash: hash, role: "hiring_manager", department: "Strategic Communications", job_title: "Strategic Communications Lead", is_active: true, start_date: dateOnly(480), location: "Nairobi" },
    // Interviewers / employees
    { email: "dev1@growthpad.africa",    name: "Kevin Mwangi",    password_hash: hash, role: "employee",       department: "Digital Products & Technology", job_title: "Senior Developer", is_active: true, start_date: dateOnly(400), location: "Nairobi" },
    { email: "dev2@growthpad.africa",    name: "Sheila Achieng",  password_hash: hash, role: "employee",       department: "Digital Products & Technology", job_title: "Backend Developer", is_active: true, start_date: dateOnly(300), location: "Kisumu" },
    { email: "des1@growthpad.africa",    name: "Wanjiku Njoroge", password_hash: hash, role: "employee",       department: "Creative & Content", job_title: "UI/UX Designer", is_active: true, start_date: dateOnly(250), location: "Nairobi" },
    { email: "mkt1@growthpad.africa",    name: "Dennis Kiptoo",   password_hash: hash, role: "employee",       department: "Media & Performance Marketing", job_title: "Digital Marketer", is_active: true, start_date: dateOnly(200), location: "Eldoret" },
    { email: "ops1@growthpad.africa",    name: "Faith Wambui",    password_hash: hash, role: "employee",       department: "Client Delivery", job_title: "Operations Analyst", is_active: true, start_date: dateOnly(180), location: "Nairobi" },
    { email: "fin1@growthpad.africa",    name: "Peter Mutua",     password_hash: hash, role: "employee",       department: "Finance",     job_title: "Finance Officer",       is_active: true, start_date: dateOnly(160), location: "Mombasa" },
    { email: "interviewer@growthpad.africa", name: "Mark Kiprono", password_hash: hash, role: "interviewer", department: "Digital Products & Technology", job_title: "Tech Lead", is_active: true, start_date: dateOnly(350), location: "Nairobi" },
  ]).select();
  if (uErr) throw uErr;

  const byEmail = Object.fromEntries(users!.map((u: { email: string; id: string }) => [u.email, u.id]));
  const adminId    = byEmail["analytics.growthpad@gmail.com"];
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
      department: "Technology & Engineering",
      location: "Nairobi, Kenya (Hybrid)",
      description: "Build and improve reliable web applications across the full stack, working closely with product, design and engineering colleagues.",
      requirements: { must_haves: ["5+ years full-stack development", "TypeScript", "React", "Node.js", "SQL databases"], nice_to_haves: ["Next.js", "Cloud platforms", "CI/CD"] },
      scoring_rubric: [{ criterion: "Technical depth", weight: 45 }, { criterion: "Problem solving", weight: 30 }, { criterion: "Collaboration", weight: 25 }],
      status: "open",
      created_by: adminId,
      created_at: daysAgo(45),
      published_at: daysAgo(2),
      closes_at: daysAgo(-14),
    },
    {
      title: "Product Designer (UI/UX)",
      department: "Design & UX",
      location: "Nairobi, Kenya",
      description: "Design intuitive, accessible digital products by turning user needs and business goals into clear user journeys and polished interfaces.",
      requirements: { must_haves: ["3+ years product design", "Figma", "User research", "Prototyping", "Design systems"], nice_to_haves: ["Usability testing", "Mobile design", "Front-end basics"] },
      scoring_rubric: [{ criterion: "Portfolio quality", weight: 45 }, { criterion: "User-centred thinking", weight: 30 }, { criterion: "Collaboration", weight: 25 }],
      status: "open",
      created_by: mktMgrId,
      created_at: daysAgo(30),
      published_at: daysAgo(3),
      closes_at: daysAgo(-7),
    },
    {
      title: "Digital Marketing Manager",
      department: "Marketing & Growth",
      location: "Nairobi, Kenya (Hybrid)",
      description: "Plan and run measurable digital campaigns that grow awareness, generate qualified leads and improve customer engagement.",
      requirements: { must_haves: ["4+ years digital marketing", "Campaign strategy", "Google Ads or Meta Ads", "Analytics", "Content planning"], nice_to_haves: ["SEO", "CRM or marketing automation", "B2B marketing"] },
      scoring_rubric: [{ criterion: "Campaign results", weight: 40 }, { criterion: "Strategic thinking", weight: 35 }, { criterion: "Analytics", weight: 25 }],
      status: "open",
      created_by: engMgrId,
      created_at: daysAgo(20),
      published_at: daysAgo(-2),
      closes_at: daysAgo(-30),
    },
    {
      title: "Project Manager",
      department: "Project Management",
      location: "Nairobi, Kenya or Remote (Africa)",
      description: "Plan, coordinate and deliver projects on time, within scope and budget, keeping teams and stakeholders aligned throughout delivery.",
      requirements: { must_haves: ["3+ years project management", "Project planning", "Stakeholder management", "Budget tracking", "Risk management"], nice_to_haves: ["Agile certification", "Digital project experience", "Vendor management"] },
      scoring_rubric: [{ criterion: "Delivery experience", weight: 40 }, { criterion: "Planning and organisation", weight: 35 }, { criterion: "Stakeholder management", weight: 25 }],
      status: "open",
      created_by: adminId,
      created_at: daysAgo(10),
      published_at: daysAgo(1),
      closes_at: daysAgo(-5),
    },
    {
      title: "Business Development Executive",
      department: "Sales",
      location: "Nairobi, Kenya",
      description: "Identify new opportunities, build lasting client relationships and help convert qualified leads into sustainable revenue.",
      requirements: { must_haves: ["B2B sales or business development", "Prospecting", "Proposal writing", "CRM discipline", "Negotiation"], nice_to_haves: ["Account management", "Tender or RFP experience", "Consultative selling"] },
      scoring_rubric: [{ criterion: "Business development", weight: 40 }, { criterion: "Commercial communication", weight: 35 }, { criterion: "Relationship building", weight: 25 }],
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

  const developerJobId = jobIds["Senior Full-Stack Developer"];
  const designerJobId  = jobIds["Product Designer (UI/UX)"];
  const marketingJobId = jobIds["Digital Marketing Manager"];
  const projectJobId   = jobIds["Project Manager"];
  const salesJobId     = jobIds["Business Development Executive"];

  const { data: candidates, error: cErr } = await supabase.from("candidates").insert([
    // Full-stack developer candidates
    { job_id: developerJobId, full_name: "Kevin Mwangi", email: "kofi.a@email.com", phone: "+254701234567", location: "Nairobi", stage: "interview", ai_score: 87.5, ai_justification: "Strong TypeScript, React and Node.js experience with a track record of shipping production web applications.", shortlisted: true, source: "linkedin", applied_at: daysAgo(40), consented_at: daysAgo(40) },
    { job_id: developerJobId, full_name: "Wanjiku Njoroge", email: "priya.s@email.com", phone: "+254722801234", location: "Nairobi", stage: "offer", ai_score: 91.0, ai_justification: "Excellent full-stack profile with strong system design, API development and technical communication.", shortlisted: true, source: "referral", applied_at: daysAgo(35), consented_at: daysAgo(35) },
    { job_id: developerJobId, full_name: "Brian Otieno", email: "sam.n@email.com", phone: "+254723271234", location: "Kisumu", stage: "screened", ai_score: 72.0, ai_justification: "Good React and JavaScript foundations; needs deeper experience with backend architecture and relational data modelling.", shortlisted: false, source: "direct", applied_at: daysAgo(30), consented_at: daysAgo(30) },
    { job_id: developerJobId, full_name: "Faith Wambui", email: "amara.d@email.com", phone: "+254724771234", location: "Nairobi", stage: "screened", ai_score: 68.0, ai_justification: "Strong backend project experience but limited evidence of the React and TypeScript depth required for this role.", shortlisted: false, source: "linkedin", applied_at: daysAgo(28), consented_at: daysAgo(28) },
    { job_id: developerJobId, full_name: "Dennis Kiptoo", email: "tunde.b@email.com", phone: "+254725701234", location: "Eldoret", stage: "applied", ai_score: 55.0, ai_justification: "Relevant experience, but the application does not yet demonstrate the required full-stack delivery depth.", shortlisted: false, source: "direct", applied_at: daysAgo(5), consented_at: daysAgo(5) },
    { job_id: developerJobId, full_name: "Njeri Karanja", email: "fatima.o@email.com", phone: "+254726712345", location: "Nakuru", stage: "rejected", ai_score: 41.0, ai_justification: "Experience is primarily in CMS implementation, with limited modern JavaScript and application-development exposure.", shortlisted: false, source: "direct", applied_at: daysAgo(42), consented_at: daysAgo(42) },
    { job_id: developerJobId, full_name: "Mark Kiprono", email: "bright.m@email.com", phone: "+254727551234", location: "Nairobi", stage: "hired", ai_score: 88.0, ai_justification: "Excellent full-stack delivery history, high code quality and strong collaboration across product and design.", shortlisted: true, source: "linkedin", applied_at: daysAgo(60), consented_at: daysAgo(60) },
    { job_id: developerJobId, full_name: "Sheila Achieng", email: "nia.o@email.com", phone: "+254728112233", location: "Nairobi", stage: "applied", ai_score: null, shortlisted: false, source: "direct", applied_at: daysAgo(2), consented_at: daysAgo(2) },
    { job_id: developerJobId, full_name: "Peter Mutua", email: "peter.m@example.com", phone: "+254729223344", location: "Mombasa", stage: "applied", ai_score: null, shortlisted: false, source: "referral", applied_at: daysAgo(0), consented_at: daysAgo(0) },
    // Product design candidates
    { job_id: designerJobId, full_name: "Pauline Wairimu", email: "pauline.w@email.com", phone: "+254711234567", location: "Nairobi", stage: "interview", ai_score: 84.0, ai_justification: "Strong Figma portfolio with evidence of user research, prototyping and design-system work.", shortlisted: true, source: "linkedin", applied_at: daysAgo(25), consented_at: daysAgo(25) },
    { job_id: designerJobId, full_name: "Esther Chebet", email: "esther.c@email.com", phone: "+254724123456", location: "Nakuru", stage: "screened", ai_score: 76.5, ai_justification: "Solid interface design skills; needs stronger evidence of structured user-research practice.", shortlisted: false, source: "direct", applied_at: daysAgo(22), consented_at: daysAgo(22) },
    { job_id: designerJobId, full_name: "Collins Odhiambo", email: "collins.o@email.com", phone: "+254726123456", location: "Kisumu", stage: "applied", ai_score: null, shortlisted: false, source: "linkedin", applied_at: daysAgo(3), consented_at: daysAgo(3) },
    // Digital marketing candidates
    { job_id: marketingJobId, full_name: "Lydia Wanjiru", email: "lydia.w@email.com", phone: "+254712123456", location: "Nairobi", stage: "offer", ai_score: 89.0, ai_justification: "Strong campaign strategy and paid-media record with clear evidence of measurable growth results.", shortlisted: true, source: "referral", applied_at: daysAgo(18), consented_at: daysAgo(18) },
    { job_id: marketingJobId, full_name: "Caleb Kibet", email: "caleb.k@email.com", phone: "+254713123456", location: "Eldoret", stage: "screened", ai_score: 65.0, ai_justification: "Good content and social-media experience, but paid-media and analytics depth are limited.", shortlisted: false, source: "direct", applied_at: daysAgo(15), consented_at: daysAgo(15) },
    { job_id: marketingJobId, full_name: "Sharon Atieno", email: "sharon.a@email.com", phone: "+254714123456", location: "Mombasa", stage: "applied", ai_score: null, shortlisted: false, source: "direct", applied_at: daysAgo(4), consented_at: daysAgo(4) },
    // Project management candidates
    { job_id: projectJobId, full_name: "Hassan Abdalla", email: "hassan.a@email.com", phone: "+254715123456", location: "Mombasa", stage: "screened", ai_score: 79.5, ai_justification: "Strong project planning and reporting background with evidence of managing stakeholders, risks and delivery timelines.", shortlisted: true, source: "linkedin", applied_at: daysAgo(8), consented_at: daysAgo(8) },
    { job_id: projectJobId, full_name: "Naomi Wambui", email: "naomi.w@email.com", phone: "+254716123456", location: "Nairobi", stage: "applied", ai_score: null, shortlisted: false, source: "direct", applied_at: daysAgo(6), consented_at: daysAgo(6) },
    { job_id: projectJobId, full_name: "Eric Kamau", email: "eric.k@email.com", phone: "+254717123456", location: "Thika", stage: "applied", ai_score: null, shortlisted: false, source: "linkedin", applied_at: daysAgo(0), consented_at: daysAgo(0) },
    // Business development candidates (closed job — all resolved)
    { job_id: salesJobId, full_name: "Beatrice Muthoni", email: "beatrice.m@email.com", phone: "+254718123456", location: "Nairobi", stage: "hired", ai_score: 92.0, ai_justification: "Excellent consultative selling record with strong proposal development and regional account growth experience.", shortlisted: true, source: "referral", applied_at: daysAgo(85), consented_at: daysAgo(85) },
    { job_id: salesJobId, full_name: "Joseph Kiprotich", email: "joseph.k@email.com", phone: "+254719123456", location: "Eldoret", stage: "rejected", ai_score: 58.0, ai_justification: "Good business-development foundations but proposal and enterprise-sales evidence was below threshold.", shortlisted: false, source: "direct", applied_at: daysAgo(87), consented_at: daysAgo(87) },
  ]).select();
  if (cErr) throw cErr;

  const candByName = Object.fromEntries(candidates!.map((c: { full_name: string; id: string }) => [c.full_name, c.id]));

  // ══════════════════════════════════════════════════════════════════════════
  // 4. CANDIDATE NOTES & INTERVIEW SCORECARDS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("📝  Seeding notes & scorecards…");

  await supabase.from("candidate_notes").insert([
    { candidate_id: candByName["Wanjiku Njoroge"], user_id: engMgrId,  note: "Excellent technical call. Strong Next.js architecture discussion. Moving to offer.", created_at: daysAgo(10) },
    { candidate_id: candByName["Kevin Mwangi"],    user_id: interId,   note: "Live coding went well. Confident with TypeScript generics. Schedule final round.", created_at: daysAgo(15) },
    { candidate_id: candByName["Lydia Wanjiru"],   user_id: mktMgrId,  note: "Impressive campaign case study. Negotiating salary band now.", created_at: daysAgo(3) },
  ]);

  await supabase.from("interview_scorecards").insert([
    {
      candidate_id: candByName["Kevin Mwangi"], interviewer_id: interId,
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
      candidate_id: candByName["Wanjiku Njoroge"], interviewer_id: engMgrId,
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
      scheduled_at: daysAgo(-1),
      agenda: "Q3 progress review, design system status, career growth discussion",
      notes: "Kevin is on track for promotion. Discussed a stretch assignment as tech lead for the upcoming product sprint.",
      action_items: [{ text: "Share tech lead JD draft", done: true }, { text: "Set up pairing session with Sheila", done: false }],
      ai_talking_points: "1. Kevin's goal progress is strong (80%) — discuss timeline confidence. 2. Team morale dip in recent check-ins — explore root cause. 3. Career growth: is he interested in a lead role?",
      created_at: daysAgo(14),
    },
    {
      manager_id: engMgrId, report_id: dev2Id,
      scheduled_at: daysAgo(-3),
      agenda: "Open-source goal review, blockers, performance feedback",
      notes: "Sheila mentioned feeling stretched thin across three concurrent projects. Agreed to deprioritise internal tooling work.",
      action_items: [{ text: "Remove internal tooling from Sheila's sprint", done: true }, { text: "Book deep-work day for open-source contributions", done: false }],
      ai_talking_points: "1. Open-source goal at risk (20% progress, deadline in 15 days). 2. Morale trend — blockers showing in check-ins. 3. Workload recalibration needed.",
      created_at: daysAgo(12),
    },
    {
      manager_id: mktMgrId, report_id: mkt1Id,
      scheduled_at: daysAgo(-7),
      agenda: "Google Ads cert celebration, Q4 campaign planning",
      notes: "Dennis just passed the certification. Planning to give him the lead on the next acquisition campaign.",
      action_items: [{ text: "Draft campaign brief", done: false }, { text: "Add Dennis to the media budget spreadsheet", done: true }],
      ai_talking_points: "1. Celebrate Google Ads cert completion. 2. Q4 campaign readiness — timeline and budget. 3. Career discussion: Marketing Manager track?",
      created_at: daysAgo(8),
    },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // 8. FEEDBACK / KUDOS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("🌟  Seeding feedback & kudos…");

  await supabase.from("feedback").insert([
    { from_user_id: engMgrId, to_user_id: dev1Id,  message: "Kevin, the way you handled the production incident last week was exemplary. Calm under pressure and kept the team informed the whole time. 🔥", visibility: "public",  emoji: "🔥", created_at: daysAgo(5) },
    { from_user_id: dev1Id,   to_user_id: dev2Id,  message: "Sheila, thanks for the detailed code review on my PR. Your feedback on the pagination logic saved us a headache later.", visibility: "public",  emoji: "💪", created_at: daysAgo(8) },
    { from_user_id: mktMgrId, to_user_id: mkt1Id,  message: "Dennis passed the Google Ads certification! This is a huge win for the team and shows real initiative. Well done! ⭐", visibility: "public",  emoji: "⭐", created_at: daysAgo(10) },
    { from_user_id: hrId,     to_user_id: des1Id,  message: "Wanjiku's design system work has noticeably improved consistency across all our products. The team really appreciates it.", visibility: "public",  emoji: "✨", created_at: daysAgo(12) },
    { from_user_id: adminId,  to_user_id: engMgrId,message: "Mercy, the engineering team velocity this quarter has been outstanding. The culture of accountability you've built shows in the results.", visibility: "public",  emoji: "🚀", created_at: daysAgo(14) },
    { from_user_id: engMgrId, to_user_id: dev2Id,  message: "Sheila, I'd like us to discuss how we can better protect your focus time. The at-risk goal concerns me — let's fix the workload.", visibility: "private", emoji: null, created_at: daysAgo(4) },
    { from_user_id: adminId,  to_user_id: ops1Id,  message: "Faith handled the vendor onboarding with minimal supervision this month. Really impressed with her ownership.", visibility: "public",  emoji: "💡", created_at: daysAgo(6) },
    { from_user_id: fin1Id,   to_user_id: hrId,    message: "David, the onboarding experience was really smooth for the new hires. The checklists you put together were detailed and helpful.", visibility: "public",  emoji: "👏", created_at: daysAgo(18) },
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
    { cycle_id: cycleQ3, reviewee_id: dev1Id,  reviewer_id: engMgrId, review_type: "manager", competency_ratings: competencyTemplate([5,4,4,5,5]), overall_rating: 4.6, strengths: "Kevin is our most reliable senior IC. Production incident handling was outstanding.", development_areas: "Leadership path — ready for a tech lead stretch.", submitted_at: daysAgo(5) },
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
      title: "Kevin — Engineering Lead Readiness",
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
      title: "Wanjiku — Senior Designer Transition",
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
      title: "Dennis — Marketing Manager Track",
      goals: "Build skills to move from Digital Marketer to Marketing Manager. Focus on strategy, budget ownership, and team collaboration.",
      actions: [
        { text: "Pass Google Ads certification", due_date: dateOnly(10), done: true },
        { text: "Own Q4 campaign budget and reporting", due_date: dateOnly(-60), done: false },
        { text: "Shadow Brian on 3 client strategy sessions", due_date: dateOnly(-30), done: true },
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
      concern: "Sheila has missed two consecutive personal goals (open-source contributions and code quality target). Check-in mood scores have trended downward over four weeks, and there have been two incidents of blocked delivery due to incomplete work handover.",
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
  console.log("Demo login credentials:");
  console.log("  analytics.growthpad@gmail.com → Admin (password: testpassword)");
  console.log("  All other accounts → password: Demo1234!");
  console.log("  hr@growthpad.africa       → HR Manager");
  console.log("  eng.mgr@growthpad.africa  → Engineering Manager");
  console.log("  mkt.mgr@growthpad.africa  → Marketing / Hiring Manager");
  console.log("  dev1@growthpad.africa     → Senior Developer (Kevin Mwangi)");
  console.log("  dev2@growthpad.africa     → Backend Developer (Sheila Achieng)");
  console.log("  des1@growthpad.africa     → UI/UX Designer (Wanjiku Njoroge)");
  console.log("  mkt1@growthpad.africa     → Digital Marketer (Dennis Kiptoo)");
}

seed().catch((e) => { console.error(e); process.exit(1); });
