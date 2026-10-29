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
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ─── helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
function weeksAgo(n: number) {
  return daysAgo(n * 7);
}
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
    "ai_logs",
    "interview_scorecards",
    "candidate_notes",
    "pips",
    "idps",
    "survey_responses",
    "surveys",
    "performance_reviews",
    "review_cycles",
    "feedback",
    "one_on_ones",
    "goals",
    "checkins",
    "candidates",
    "jobs",
    "sessions",
    "users",
    "departments",
  ];
  for (const t of tables) {
    const { error } = await supabase
      .from(t)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
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
  const { data: existingDepts } = await supabase
    .from("departments")
    .select("name");
  const have = new Set(
    (existingDepts ?? []).map((d: { name: string }) => d.name.toLowerCase()),
  );
  const missing = deptNames.filter((n) => !have.has(n.toLowerCase()));
  if (missing.length) {
    const { error: dErr } = await supabase
      .from("departments")
      .insert(missing.map((name) => ({ name })));
    if (dErr) console.warn(`  departments: ${dErr.message}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 1. USERS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("👤  Seeding users…");

  const { data: users, error: uErr } = await supabase
    .from("users")
    .insert([
      // HR / Admin
      {
        email: "analytics.growthpad@gmail.com",
        name: "Amina Wanjiku",
        password_hash: adminHash,
        role: "admin",
        department: "Operations",
        job_title: "CEO",
        is_active: true,
        start_date: dateOnly(730),
        location: "Nairobi",
      },
      {
        email: "hr@growthpad.africa",
        name: "David Kariuki",
        password_hash: hash,
        role: "hr",
        department: "People & Culture",
        job_title: "People & Culture Manager",
        is_active: true,
        start_date: dateOnly(600),
        location: "Nairobi",
      },
      // Managers
      {
        email: "eng.mgr@growthpad.africa",
        name: "Mercy Njeri",
        password_hash: hash,
        role: "manager",
        department: "Digital Products & Technology",
        job_title: "Digital Products Lead",
        is_active: true,
        start_date: dateOnly(500),
        location: "Nairobi",
      },
      {
        email: "mkt.mgr@growthpad.africa",
        name: "Brian Mwangi",
        password_hash: hash,
        role: "hiring_manager",
        department: "Strategic Communications",
        job_title: "Strategic Communications Lead",
        is_active: true,
        start_date: dateOnly(480),
        location: "Nairobi",
      },
      // Interviewers / employees
      {
        email: "dev1@growthpad.africa",
        name: "Kevin Mwangi",
        password_hash: hash,
        role: "employee",
        department: "Digital Products & Technology",
        job_title: "Senior Developer",
        is_active: true,
        start_date: dateOnly(400),
        location: "Nairobi",
      },
      {
        email: "dev2@growthpad.africa",
        name: "Sheila Achieng",
        password_hash: hash,
        role: "employee",
        department: "Digital Products & Technology",
        job_title: "Backend Developer",
        is_active: true,
        start_date: dateOnly(300),
        location: "Kisumu",
      },
      {
        email: "des1@growthpad.africa",
        name: "Wanjiku Njoroge",
        password_hash: hash,
        role: "employee",
        department: "Creative & Content",
        job_title: "UI/UX Designer",
        is_active: true,
        start_date: dateOnly(250),
        location: "Nairobi",
      },
      {
        email: "mkt1@growthpad.africa",
        name: "Dennis Kiptoo",
        password_hash: hash,
        role: "employee",
        department: "Media & Performance Marketing",
        job_title: "Digital Marketer",
        is_active: true,
        start_date: dateOnly(200),
        location: "Eldoret",
      },
      {
        email: "ops1@growthpad.africa",
        name: "Faith Wambui",
        password_hash: hash,
        role: "employee",
        department: "Client Delivery",
        job_title: "Operations Analyst",
        is_active: true,
        start_date: dateOnly(180),
        location: "Nairobi",
      },
      {
        email: "fin1@growthpad.africa",
        name: "Peter Mutua",
        password_hash: hash,
        role: "employee",
        department: "Finance",
        job_title: "Finance Officer",
        is_active: true,
        start_date: dateOnly(160),
        location: "Mombasa",
      },
      {
        email: "interviewer@growthpad.africa",
        name: "Mark Kiprono",
        password_hash: hash,
        role: "interviewer",
        department: "Digital Products & Technology",
        job_title: "Tech Lead",
        is_active: true,
        start_date: dateOnly(350),
        location: "Nairobi",
      },
    ])
    .select();
  if (uErr) throw uErr;

  const byEmail = Object.fromEntries(
    users!.map((u: { email: string; id: string }) => [u.email, u.id]),
  );
  const adminId = byEmail["analytics.growthpad@gmail.com"];
  const hrId = byEmail["hr@growthpad.africa"];
  const engMgrId = byEmail["eng.mgr@growthpad.africa"];
  const mktMgrId = byEmail["mkt.mgr@growthpad.africa"];
  const dev1Id = byEmail["dev1@growthpad.africa"];
  const dev2Id = byEmail["dev2@growthpad.africa"];
  const des1Id = byEmail["des1@growthpad.africa"];
  const mkt1Id = byEmail["mkt1@growthpad.africa"];
  const ops1Id = byEmail["ops1@growthpad.africa"];
  const fin1Id = byEmail["fin1@growthpad.africa"];
  const interId = byEmail["interviewer@growthpad.africa"];

  // Assign manager relationships
  await supabase
    .from("users")
    .update({ manager_id: engMgrId })
    .in("id", [dev1Id, dev2Id, des1Id, interId]);
  await supabase
    .from("users")
    .update({ manager_id: mktMgrId })
    .in("id", [mkt1Id]);
  await supabase
    .from("users")
    .update({ manager_id: adminId })
    .in("id", [engMgrId, mktMgrId, ops1Id, fin1Id]);
  await supabase.from("users").update({ manager_id: hrId }).in("id", [hrId]); // HR self-reference to avoid null issues — skip

  // ══════════════════════════════════════════════════════════════════════════
  // 2. JOBS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("💼  Seeding jobs…");

  const { data: jobs, error: jErr } = await supabase
    .from("jobs")
    .insert([
      {
        title: "Senior Full-Stack Developer",
        department: "Technology & Engineering",
        location: "Nairobi, Kenya (Hybrid)",
        description:
          "Build and improve reliable web applications across the full stack, working closely with product, design and engineering colleagues.",
        requirements: {
          must_haves: [
            "5+ years full-stack development",
            "TypeScript",
            "React",
            "Node.js",
            "SQL databases",
          ],
          nice_to_haves: ["Next.js", "Cloud platforms", "CI/CD"],
        },
        scoring_rubric: [
          { criterion: "Technical depth", weight: 45 },
          { criterion: "Problem solving", weight: 30 },
          { criterion: "Collaboration", weight: 25 },
        ],
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
        description:
          "Design intuitive, accessible digital products by turning user needs and business goals into clear user journeys and polished interfaces.",
        requirements: {
          must_haves: [
            "3+ years product design",
            "Figma",
            "User research",
            "Prototyping",
            "Design systems",
          ],
          nice_to_haves: [
            "Usability testing",
            "Mobile design",
            "Front-end basics",
          ],
        },
        scoring_rubric: [
          { criterion: "Portfolio quality", weight: 45 },
          { criterion: "User-centred thinking", weight: 30 },
          { criterion: "Collaboration", weight: 25 },
        ],
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
        description:
          "Plan and run measurable digital campaigns that grow awareness, generate qualified leads and improve customer engagement.",
        requirements: {
          must_haves: [
            "4+ years digital marketing",
            "Campaign strategy",
            "Google Ads or Meta Ads",
            "Analytics",
            "Content planning",
          ],
          nice_to_haves: [
            "SEO",
            "CRM or marketing automation",
            "B2B marketing",
          ],
        },
        scoring_rubric: [
          { criterion: "Campaign results", weight: 40 },
          { criterion: "Strategic thinking", weight: 35 },
          { criterion: "Analytics", weight: 25 },
        ],
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
        description:
          "Plan, coordinate and deliver projects on time, within scope and budget, keeping teams and stakeholders aligned throughout delivery.",
        requirements: {
          must_haves: [
            "3+ years project management",
            "Project planning",
            "Stakeholder management",
            "Budget tracking",
            "Risk management",
          ],
          nice_to_haves: [
            "Agile certification",
            "Digital project experience",
            "Vendor management",
          ],
        },
        scoring_rubric: [
          { criterion: "Delivery experience", weight: 40 },
          { criterion: "Planning and organisation", weight: 35 },
          { criterion: "Stakeholder management", weight: 25 },
        ],
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
        description:
          "Identify new opportunities, build lasting client relationships and help convert qualified leads into sustainable revenue.",
        requirements: {
          must_haves: [
            "B2B sales or business development",
            "Prospecting",
            "Proposal writing",
            "CRM discipline",
            "Negotiation",
          ],
          nice_to_haves: [
            "Account management",
            "Tender or RFP experience",
            "Consultative selling",
          ],
        },
        scoring_rubric: [
          { criterion: "Business development", weight: 40 },
          { criterion: "Commercial communication", weight: 35 },
          { criterion: "Relationship building", weight: 25 },
        ],
        status: "closed",
        created_by: adminId,
        created_at: daysAgo(90),
      },
    ])
    .select();
  if (jErr) throw jErr;

  const jobIds = Object.fromEntries(
    jobs!.map((j: { title: string; id: string }) => [j.title, j.id]),
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 3. CANDIDATES
  // ══════════════════════════════════════════════════════════════════════════
  console.log("🧑‍💼  Seeding candidates…");

  const developerJobId = jobIds["Senior Full-Stack Developer"];
  const designerJobId = jobIds["Product Designer (UI/UX)"];
  const marketingJobId = jobIds["Digital Marketing Manager"];
  const projectJobId = jobIds["Project Manager"];
  const salesJobId = jobIds["Business Development Executive"];

  const { data: candidates, error: cErr } = await supabase
    .from("candidates")
    .insert([
      // Full-stack developer candidates
      {
        job_id: developerJobId,
        full_name: "Kevin Mwangi",
        email: "kofi.a@email.com",
        phone: "+254701234567",
        location: "Nairobi",
        stage: "interview",
        ai_score: 87.5,
        ai_justification:
          "Strong TypeScript, React and Node.js experience with a track record of shipping production web applications.",
        shortlisted: true,
        source: "linkedin",
        applied_at: daysAgo(40),
        consented_at: daysAgo(40),
        cv_text: `Kevin Mwangi — Senior Full-Stack Developer\nNairobi, Kenya | kevin.mwangi@email.com | +254701234567\n\nSUMMARY\nFull-stack developer with 6 years of experience building scalable web applications using TypeScript, React and Node.js. Comfortable across the entire stack from database design to UI delivery.\n\nEXPERIENCE\nSenior Developer — Andela (2022–Present)\n- Led migration of monolithic Rails app to Next.js/TypeScript microservices, reducing page load times by 60%\n- Built real-time collaboration features using Supabase Realtime and WebSockets\n- Mentored 3 junior developers; introduced code review standards and CI/CD pipelines\n\nFull-Stack Developer — Safaricom Digital (2019–2022)\n- Delivered customer-facing portal handling 200k+ daily sessions\n- Integrated M-Pesa API and Flutterwave payment gateways\n- Reduced API response times by 40% through Redis caching strategy\n\nSKILLS\nTypeScript, React, Next.js, Node.js, PostgreSQL, Supabase, Redis, Docker, AWS, GraphQL\n\nEDUCATION\nBSc Computer Science — University of Nairobi (2015–2019)`,
      },
      {
        job_id: developerJobId,
        full_name: "Wanjiku Njoroge",
        email: "priya.s@email.com",
        phone: "+254722801234",
        location: "Nairobi",
        stage: "offer",
        ai_score: 91.0,
        ai_justification:
          "Excellent full-stack profile with strong system design, API development and technical communication.",
        shortlisted: true,
        source: "referral",
        applied_at: daysAgo(35),
        consented_at: daysAgo(35),
        cv_text: `Wanjiku Njoroge — Full-Stack Engineer\nNairobi, Kenya | wanjiku.n@email.com | +254722801234\n\nSUMMARY\nSenior full-stack engineer with 7+ years building high-performance web platforms. Expert in React, Next.js and Node.js. Strong background in API design, system architecture and cross-functional team collaboration.\n\nEXPERIENCE\nStaff Engineer — Twiga Foods (2021–Present)\n- Architected and delivered logistics platform used by 15,000+ vendors across Kenya\n- Designed RESTful API layer with OpenAPI documentation; onboarded 5 third-party integrations\n- Drove performance optimisation: 50% reduction in Time to Interactive via bundle splitting and React virtualisation\n\nFull-Stack Developer — Craft Silicon (2017–2021)\n- Built banking and fintech products serving 500k+ customers across Africa\n- Introduced typed API contracts using Zod; eliminated 90% of runtime type errors\n- Delivered real-time notifications system using WebSockets\n\nSKILLS\nTypeScript, React, Next.js, Node.js, PostgreSQL, Redis, Kubernetes, GCP, REST, GraphQL\n\nEDUCATION\nBSc Software Engineering — Strathmore University (2013–2017)`,
      },
      {
        job_id: developerJobId,
        full_name: "Brian Otieno",
        email: "sam.n@email.com",
        phone: "+254723271234",
        location: "Kisumu",
        stage: "screened",
        ai_score: 72.0,
        ai_justification:
          "Good React and JavaScript foundations; needs deeper experience with backend architecture and relational data modelling.",
        shortlisted: false,
        source: "direct",
        applied_at: daysAgo(30),
        consented_at: daysAgo(30),
        cv_text: `Brian Otieno — Web Developer\nKisumu, Kenya | brian.otieno@email.com | +254723271234\n\nSUMMARY\n3 years of frontend and light backend development experience. Proficient in React and JavaScript with growing exposure to Node.js.\n\nEXPERIENCE\nFrontend Developer — Kisumu Digital Hub (2022–Present)\n- Built 8 client websites using React and Gatsby\n- Developed internal CRM dashboard with REST API integration\n- Introduced ESLint and Prettier standards to the team\n\nJunior Developer — Lake Tech Solutions (2021–2022)\n- Maintained WordPress and PHP-based client sites\n- Built a booking management module in vanilla JavaScript\n\nSKILLS\nJavaScript, React, HTML/CSS, Node.js (basic), MySQL, REST APIs, Git\n\nEDUCATION\nDiploma in Information Technology — Kenya Institute of Management (2019–2021)`,
      },
      {
        job_id: developerJobId,
        full_name: "Faith Wambui",
        email: "amara.d@email.com",
        phone: "+254724771234",
        location: "Nairobi",
        stage: "screened",
        ai_score: 68.0,
        ai_justification:
          "Strong backend project experience but limited evidence of the React and TypeScript depth required for this role.",
        shortlisted: false,
        source: "linkedin",
        applied_at: daysAgo(28),
        consented_at: daysAgo(28),
        cv_text: `Faith Wambui — Backend Developer\nNairobi, Kenya | faith.wambui@email.com | +254724771234\n\nSUMMARY\nBackend-focused developer with 4 years building APIs, microservices and data pipelines. Strong in Python and Django; currently expanding React knowledge.\n\nEXPERIENCE\nBackend Developer — Cellulant (2021–Present)\n- Built payment processing microservices handling KES 2B+ in transactions annually\n- Designed PostgreSQL schemas and optimised slow queries (70% improvement)\n- Developed internal analytics API consumed by 4 frontend teams\n\nSoftware Developer — WeFarm (2020–2021)\n- Built SMS-based data collection API using Python and Twilio\n- Integrated with farmer database used across Uganda and Kenya\n\nSKILLS\nPython, Django, PostgreSQL, REST APIs, Docker, Redis, Git, React (learning)\n\nEDUCATION\nBSc Information Systems — USIU-Africa (2016–2020)`,
      },
      {
        job_id: developerJobId,
        full_name: "Dennis Kiptoo",
        email: "tunde.b@email.com",
        phone: "+254725701234",
        location: "Eldoret",
        stage: "applied",
        ai_score: 55.0,
        ai_justification:
          "Relevant experience, but the application does not yet demonstrate the required full-stack delivery depth.",
        shortlisted: false,
        source: "direct",
        applied_at: daysAgo(5),
        consented_at: daysAgo(5),
        cv_text: `Dennis Kiptoo — Junior Developer\nEldoret, Kenya | dennis.kiptoo@email.com | +254725701234\n\nSUMMARY\nSelf-taught developer with 2 years of freelance project experience. Building skills in full-stack development with JavaScript.\n\nEXPERIENCE\nFreelance Developer (2022–Present)\n- Built 5 small business websites using HTML, CSS and vanilla JavaScript\n- Developed a simple stock tracking tool for a local shop using Google Sheets API\n- Currently building a personal project: a task management app in React\n\nSKILLS\nJavaScript, HTML/CSS, React (learning), Node.js (basic), MySQL\n\nEDUCATION\nBSc Computer Science — Moi University (2018–2022, ongoing)`,
      },
      {
        job_id: developerJobId,
        full_name: "Njeri Karanja",
        email: "fatima.o@email.com",
        phone: "+254726712345",
        location: "Nakuru",
        stage: "rejected",
        ai_score: 41.0,
        ai_justification:
          "Experience is primarily in CMS implementation, with limited modern JavaScript and application-development exposure.",
        shortlisted: false,
        source: "direct",
        applied_at: daysAgo(42),
        consented_at: daysAgo(42),
        cv_text: `Njeri Karanja — Web Content Developer\nNakuru, Kenya | njeri.karanja@email.com | +254726712345\n\nSUMMARY\n2 years experience in web content management and WordPress site development.\n\nEXPERIENCE\nWeb Developer — Nakuru County Communications (2022–Present)\n- Manages county government website using WordPress\n- Creates and schedules digital content across platforms\n- Basic HTML/CSS edits for site updates\n\nSKILLS\nWordPress, HTML, CSS, Google Analytics, Canva\n\nEDUCATION\nDiploma in Mass Communication — Nakuru Polytechnic (2019–2021)`,
      },
      {
        job_id: developerJobId,
        full_name: "Mark Kiprono",
        email: "bright.m@email.com",
        phone: "+254727551234",
        location: "Nairobi",
        stage: "hired",
        ai_score: 88.0,
        ai_justification:
          "Excellent full-stack delivery history, high code quality and strong collaboration across product and design.",
        shortlisted: true,
        source: "linkedin",
        applied_at: daysAgo(60),
        consented_at: daysAgo(60),
        cv_text: `Mark Kiprono — Principal Engineer\nNairobi, Kenya | mark.kiprono@email.com | +254727551234\n\nSUMMARY\n8 years building complex web applications with a focus on engineering leadership, code quality and developer experience. Strong in TypeScript, React and distributed systems.\n\nEXPERIENCE\nPrincipal Engineer — Equity Bank Digital (2020–Present)\n- Technical lead for mobile banking web platform (2M+ active users)\n- Designed event-driven microservices architecture processing 500k+ daily transactions\n- Established engineering best practices: testing, code review, CI/CD standards\n\nSenior Developer — Ushahidi (2016–2020)\n- Built open-source crisis-mapping tools used globally\n- Led full migration from AngularJS to React; improved test coverage from 30% to 85%\n\nSKILLS\nTypeScript, React, Next.js, Node.js, PostgreSQL, Kafka, AWS, Docker, Kubernetes\n\nEDUCATION\nBEng Computer Engineering — Jomo Kenyatta University (2012–2016)`,
      },
      {
        job_id: developerJobId,
        full_name: "Sheila Achieng",
        email: "nia.o@email.com",
        phone: "+254728112233",
        location: "Nairobi",
        stage: "applied",
        ai_score: null,
        shortlisted: false,
        source: "direct",
        applied_at: daysAgo(2),
        consented_at: daysAgo(2),
        cv_text: `Sheila Achieng — Software Developer\nNairobi, Kenya | sheila.achieng@email.com | +254728112233\n\nSUMMARY\nDeveloper with 3 years of experience in React frontends and Python backends. Comfortable with REST API development and database design.\n\nEXPERIENCE\nSoftware Developer — Sendy (2021–Present)\n- Developed driver-facing mobile web app used by 8,000+ couriers\n- Built logistics reporting dashboard consumed by operations team daily\n- Maintained PostgreSQL database schema for order management system\n\nJunior Developer — Jumia Kenya (2020–2021)\n- Contributed to internal tooling for inventory management\n- Fixed bugs and added features to seller portal\n\nSKILLS\nReact, Python, Django, PostgreSQL, REST APIs, Git, TypeScript (learning)\n\nEDUCATION\nBSc Computer Science — Kenyatta University (2016–2020)`,
      },
      {
        job_id: developerJobId,
        full_name: "Peter Mutua",
        email: "peter.m@example.com",
        phone: "+254729223344",
        location: "Mombasa",
        stage: "applied",
        ai_score: null,
        shortlisted: false,
        source: "referral",
        applied_at: daysAgo(0),
        consented_at: daysAgo(0),
        cv_text: `Peter Mutua — Full-Stack Developer\nMombasa, Kenya | peter.mutua@email.com | +254729223344\n\nSUMMARY\n4 years of full-stack development experience with strong React and Node.js skills. Based in Mombasa, open to hybrid and remote opportunities.\n\nEXPERIENCE\nFull-Stack Developer — Port of Mombasa Digital Unit (2021–Present)\n- Built cargo tracking web application used by shipping agents\n- Developed REST API backend in Node.js and Express\n- Maintained MySQL database for vessel schedule management\n\nFrontend Developer — Coast Digital Agency (2019–2021)\n- Delivered 12 client sites in React and Gatsby\n- Built e-commerce integrations with WooCommerce and Shopify\n\nSKILLS\nReact, Node.js, Express, TypeScript, MySQL, PostgreSQL, REST APIs, Git\n\nEDUCATION\nBSc Information Technology — Technical University of Mombasa (2015–2019)`,
      },
      // Product design candidates
      {
        job_id: designerJobId,
        full_name: "Pauline Wairimu",
        email: "pauline.w@email.com",
        phone: "+254711234567",
        location: "Nairobi",
        stage: "interview",
        ai_score: 84.0,
        ai_justification:
          "Strong Figma portfolio with evidence of user research, prototyping and design-system work.",
        shortlisted: true,
        source: "linkedin",
        applied_at: daysAgo(25),
        consented_at: daysAgo(25),
        cv_text: `Pauline Wairimu — Product Designer\nNairobi, Kenya | pauline.wairimu@email.com | +254711234567\n\nSUMMARY\n5 years of product design experience across fintech, health and logistics. Expert in Figma, user research and design systems. Passionate about accessible, inclusive design.\n\nEXPERIENCE\nSenior Product Designer — Pula Insurance (2022–Present)\n- Led design for farmer insurance product serving 2M+ smallholder farmers\n- Conducted 40+ user interviews across Kenya, Nigeria and Ghana\n- Built and maintained Figma design system used by 6 product squads\n\nProduct Designer — Flutterwave (2019–2022)\n- Redesigned onboarding flow; reduced drop-off by 35%\n- Ran usability tests for payment checkout; increased conversion by 22%\n\nSKILLS\nFigma, Prototyping, User Research, Usability Testing, Design Systems, Accessibility\n\nEDUCATION\nBA Design — Kenyatta University (2014–2018)`,
      },
      {
        job_id: designerJobId,
        full_name: "Esther Chebet",
        email: "esther.c@email.com",
        phone: "+254724123456",
        location: "Nakuru",
        stage: "screened",
        ai_score: 76.5,
        ai_justification:
          "Solid interface design skills; needs stronger evidence of structured user-research practice.",
        shortlisted: false,
        source: "direct",
        applied_at: daysAgo(22),
        consented_at: daysAgo(22),
        cv_text: `Esther Chebet — UI/UX Designer\nNakuru, Kenya | esther.chebet@email.com | +254724123456\n\nSUMMARY\nUI/UX designer with 3 years of experience creating clean, functional interfaces for mobile and web applications.\n\nEXPERIENCE\nUI/UX Designer — Nakuru County Health (2022–Present)\n- Designed patient registration and appointment booking interfaces\n- Created UI components library in Figma for the digital health team\n- Ran 5 informal usability sessions with clinic staff\n\nDesign Intern — Pixel Creative (2021–2022)\n- Designed marketing landing pages and social media assets\n- Contributed to client app redesigns\n\nSKILLS\nFigma, Adobe XD, Prototyping, Wireframing, UI Design, Basic HTML/CSS\n\nEDUCATION\nBSc Information Technology — Egerton University (2017–2021)`,
      },
      {
        job_id: designerJobId,
        full_name: "Collins Odhiambo",
        email: "collins.o@email.com",
        phone: "+254726123456",
        location: "Kisumu",
        stage: "applied",
        ai_score: null,
        shortlisted: false,
        source: "linkedin",
        applied_at: daysAgo(3),
        consented_at: daysAgo(3),
        cv_text: `Collins Odhiambo — Graphic & UI Designer\nKisumu, Kenya | collins.odhiambo@email.com | +254726123456\n\nSUMMARY\nCreative designer transitioning from graphic design into product design. Strong visual design skills with growing interest in UX methodology.\n\nEXPERIENCE\nGraphic & UI Designer — Lake Basin Media (2021–Present)\n- Designed print and digital marketing collateral for 20+ clients\n- Created UI mockups for 3 mobile app projects using Figma\n- Developed brand identity systems for regional NGOs\n\nFreelance Designer (2020–2021)\n- Delivered social media design packages for SMEs in Kisumu\n\nSKILLS\nFigma, Adobe Illustrator, Photoshop, UI Design, Brand Identity\n\nEDUCATION\nDiploma in Graphic Design — Maseno University (2018–2020)`,
      },
      // Digital marketing candidates
      {
        job_id: marketingJobId,
        full_name: "Lydia Wanjiru",
        email: "lydia.w@email.com",
        phone: "+254712123456",
        location: "Nairobi",
        stage: "offer",
        ai_score: 89.0,
        ai_justification:
          "Strong campaign strategy and paid-media record with clear evidence of measurable growth results.",
        shortlisted: true,
        source: "referral",
        applied_at: daysAgo(18),
        consented_at: daysAgo(18),
        cv_text: `Lydia Wanjiru — Digital Marketing Manager\nNairobi, Kenya | lydia.wanjiru@email.com | +254712123456\n\nSUMMARY\n6 years of digital marketing experience specialising in paid acquisition, SEO and marketing analytics. Proven track record of scaling growth for B2B and B2C brands across Africa.\n\nEXPERIENCE\nDigital Marketing Manager — Wasoko (2021–Present)\n- Managed $400k annual paid media budget across Google, Meta and TikTok\n- Grew organic traffic by 180% through content-led SEO strategy\n- Built marketing attribution model; improved ROAS tracking accuracy by 45%\n\nGrowth Marketer — Jumia (2018–2021)\n- Led email marketing for 2M+ subscribers; improved open rate from 12% to 22%\n- Ran A/B tests on landing pages that improved conversion by 31%\n\nSKILLS\nGoogle Ads, Meta Ads, SEO, Email Marketing, HubSpot, Google Analytics 4, Data Studio\n\nEDUCATION\nBA Marketing — United States International University (2014–2018)`,
      },
      {
        job_id: marketingJobId,
        full_name: "Caleb Kibet",
        email: "caleb.k@email.com",
        phone: "+254713123456",
        location: "Eldoret",
        stage: "screened",
        ai_score: 65.0,
        ai_justification:
          "Good content and social-media experience, but paid-media and analytics depth are limited.",
        shortlisted: false,
        source: "direct",
        applied_at: daysAgo(15),
        consented_at: daysAgo(15),
        cv_text: `Caleb Kibet — Social Media & Content Marketer\nEldoret, Kenya | caleb.kibet@email.com | +254713123456\n\nSUMMARY\n3 years of social media and content marketing experience. Strong in community management and organic growth; growing skills in paid media.\n\nEXPERIENCE\nSocial Media Manager — Rift Valley FM (2021–Present)\n- Grew Instagram following from 12k to 85k organically over 18 months\n- Produced daily video content; top post reached 2M views\n- Ran Facebook Ads for station events; managed modest budgets under KES 200k\n\nContent Creator — Freelance (2020–2021)\n- Produced branded content for 8 SME clients\n- Managed LinkedIn company pages for 3 professional services firms\n\nSKILLS\nInstagram, Facebook, TikTok, Facebook Ads (basic), Canva, Hootsuite, Copywriting\n\nEDUCATION\nBA Mass Communication — Moi University (2016–2020)`,
      },
      {
        job_id: marketingJobId,
        full_name: "Sharon Atieno",
        email: "sharon.a@email.com",
        phone: "+254714123456",
        location: "Mombasa",
        stage: "applied",
        ai_score: null,
        shortlisted: false,
        source: "direct",
        applied_at: daysAgo(4),
        consented_at: daysAgo(4),
        cv_text: `Sharon Atieno — Digital Marketing Specialist\nMombasa, Kenya | sharon.atieno@email.com | +254714123456\n\nSUMMARY\n4 years of digital marketing experience with focus on e-commerce and tourism clients. Hands-on with Google Ads, Meta Ads and analytics.\n\nEXPERIENCE\nDigital Marketing Specialist — Mombasa Tourism Board (2021–Present)\n- Managed KES 1.5M annual digital advertising budget across Google and Meta\n- Developed content calendar and managed 4 social media channels\n- Built Google Analytics 4 dashboard for board executive reporting\n\nMarketing Executive — Serena Hotels Kenya (2019–2021)\n- Ran email campaigns for hotel promotions; 28% average open rate\n- Supported OTA partnerships with Booking.com and Expedia\n\nSKILLS\nGoogle Ads, Meta Ads, GA4, Email Marketing (Mailchimp), SEO basics, Content Strategy\n\nEDUCATION\nBBA Marketing — Mombasa Polytechnic University (2015–2019)`,
      },
      // Project management candidates
      {
        job_id: projectJobId,
        full_name: "Hassan Abdalla",
        email: "hassan.a@email.com",
        phone: "+254715123456",
        location: "Mombasa",
        stage: "screened",
        ai_score: 79.5,
        ai_justification:
          "Strong project planning and reporting background with evidence of managing stakeholders, risks and delivery timelines.",
        shortlisted: true,
        source: "linkedin",
        applied_at: daysAgo(8),
        consented_at: daysAgo(8),
        cv_text: `Hassan Abdalla — Project Manager\nMombasa, Kenya | hassan.abdalla@email.com | +254715123456\n\nSUMMARY\nPMP-certified project manager with 5 years delivering digital and infrastructure projects across the public and private sectors. Strong in stakeholder management, risk planning and reporting.\n\nEXPERIENCE\nProject Manager — Kenya Ports Authority (2021–Present)\n- Led KES 120M port logistics digitalisation project; delivered on time and 8% under budget\n- Managed 14-person cross-functional team across IT, operations and finance\n- Developed risk register and change management process for the digital transformation programme\n\nAssociate PM — Kenya Red Cross (2019–2021)\n- Coordinated 6 concurrent humanitarian aid projects across 3 counties\n- Prepared donor reports and maintained project dashboards in Asana and MS Project\n\nCERTIFICATIONS: PMP, PRINCE2 Foundation\n\nSKILLS\nProject Planning, Stakeholder Management, Risk Management, Asana, MS Project, Budget Tracking, Agile/Scrum\n\nEDUCATION\nBSc Project Management — Technical University of Mombasa (2014–2018)`,
      },
      {
        job_id: projectJobId,
        full_name: "Naomi Wambui",
        email: "naomi.w@email.com",
        phone: "+254716123456",
        location: "Nairobi",
        stage: "applied",
        ai_score: null,
        shortlisted: false,
        source: "direct",
        applied_at: daysAgo(6),
        consented_at: daysAgo(6),
        cv_text: `Naomi Wambui — Programme Coordinator\nNairobi, Kenya | naomi.wambui@email.com | +254716123456\n\nSUMMARY\n3 years of programme coordination and project support experience in the NGO and development sector.\n\nEXPERIENCE\nProgramme Coordinator — GIZ Kenya (2021–Present)\n- Coordinated logistics and reporting for 4 development programmes\n- Maintained project trackers and prepared monthly donor updates\n- Organised stakeholder workshops with government counterparts\n\nProject Assistant — Plan International (2020–2021)\n- Supported field teams on community development projects\n- Tracked budgets and processed supplier payments\n\nSKILLS\nProject Coordination, Reporting, Stakeholder Liaison, MS Project (basic), Excel, Google Workspace\n\nEDUCATION\nBA Development Studies — University of Nairobi (2016–2020)`,
      },
      {
        job_id: projectJobId,
        full_name: "Eric Kamau",
        email: "eric.k@email.com",
        phone: "+254717123456",
        location: "Thika",
        stage: "applied",
        ai_score: null,
        shortlisted: false,
        source: "linkedin",
        applied_at: daysAgo(0),
        consented_at: daysAgo(0),
        cv_text: `Eric Kamau — IT Project Manager\nThika, Kenya | eric.kamau@email.com | +254717123456\n\nSUMMARY\n4 years of IT project management and business analysis experience. Background in ERP implementations and systems integration projects.\n\nEXPERIENCE\nIT Project Manager — Bidco Africa (2021–Present)\n- Led SAP S/4HANA implementation across 3 manufacturing plants; KES 80M budget\n- Managed vendor relationships with Deloitte implementation partner\n- Delivered project 2 months ahead of schedule through rigorous scope management\n\nBusiness Analyst — Safaricom (2019–2021)\n- Gathered and documented requirements for CRM integration project\n- Facilitated 30+ workshops with business and IT stakeholders\n\nSKILLS\nProject Management, Business Analysis, SAP, Jira, Agile, Requirements Gathering, Vendor Management\n\nEDUCATION\nBSc Business Information Technology — Dedan Kimathi University (2015–2019)`,
      },
      // Business development candidates (closed job)
      {
        job_id: salesJobId,
        full_name: "Beatrice Muthoni",
        email: "beatrice.m@email.com",
        phone: "+254718123456",
        location: "Nairobi",
        stage: "hired",
        ai_score: 92.0,
        ai_justification:
          "Excellent consultative selling record with strong proposal development and regional account growth experience.",
        shortlisted: true,
        source: "referral",
        applied_at: daysAgo(85),
        consented_at: daysAgo(85),
        cv_text: `Beatrice Muthoni — Business Development Director\nNairobi, Kenya | beatrice.muthoni@email.com | +254718123456\n\nSUMMARY\n8 years of B2B business development and consultative sales experience in professional services and technology. Consistent record of exceeding targets and growing accounts across East Africa.\n\nEXPERIENCE\nBusiness Development Manager — Ernst & Young Kenya (2019–Present)\n- Grew advisory services pipeline by KES 350M over 3 years\n- Led tender responses for 12 government digital transformation contracts; won 8\n- Built relationships with C-suite stakeholders across banking, telco and FMCG\n\nSenior BD Executive — PwC Kenya (2016–2019)\n- Exceeded annual revenue target by 40% in second year\n- Developed proposal templates adopted firm-wide; reduced proposal turnaround by 30%\n\nSKILLS\nConsultative Selling, Proposal Writing, Stakeholder Management, CRM (Salesforce), Negotiation, Pipeline Management\n\nEDUCATION\nMBA — Strathmore Business School (2016)\nBCom — University of Nairobi (2011–2015)`,
      },
      {
        job_id: salesJobId,
        full_name: "Joseph Kiprotich",
        email: "joseph.k@email.com",
        phone: "+254719123456",
        location: "Eldoret",
        stage: "rejected",
        ai_score: 58.0,
        ai_justification:
          "Good business-development foundations but proposal and enterprise-sales evidence was below threshold.",
        shortlisted: false,
        source: "direct",
        applied_at: daysAgo(87),
        consented_at: daysAgo(87),
        cv_text: `Joseph Kiprotich — Sales Executive\nEldoret, Kenya | joseph.kiprotich@email.com | +254719123456\n\nSUMMARY\n3 years of sales experience in financial services and FMCG. Strong prospecting and relationship-building skills; limited enterprise or B2B professional services exposure.\n\nEXPERIENCE\nSales Executive — Equity Bank (2021–Present)\n- Acquired 450+ new retail and SME banking customers in Rift Valley region\n- Achieved 115% of annual deposit mobilisation target in 2022\n\nField Sales Representative — EABL (2020–2021)\n- Managed 80+ outlet accounts across Eldoret and Kitale\n- Grew territory revenue by 18% in first year\n\nSKILLS\nProspecting, Relationship Management, Negotiation, CRM (Salesforce basic), Financial Products\n\nEDUCATION\nBCom Marketing — Moi University (2015–2019)`,
      },
    ])
    .select();
  if (cErr) throw cErr;

  const candByName = Object.fromEntries(
    candidates!.map((c: { full_name: string; id: string }) => [
      c.full_name,
      c.id,
    ]),
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 4. CANDIDATE NOTES & INTERVIEW SCORECARDS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("📝  Seeding notes & scorecards…");

  await supabase.from("candidate_notes").insert([
    {
      candidate_id: candByName["Wanjiku Njoroge"],
      user_id: engMgrId,
      note: "Excellent technical call. Strong Next.js architecture discussion. Moving to offer.",
      created_at: daysAgo(10),
    },
    {
      candidate_id: candByName["Kevin Mwangi"],
      user_id: interId,
      note: "Live coding went well. Confident with TypeScript generics. Schedule final round.",
      created_at: daysAgo(15),
    },
    {
      candidate_id: candByName["Lydia Wanjiru"],
      user_id: mktMgrId,
      note: "Impressive campaign case study. Negotiating salary band now.",
      created_at: daysAgo(3),
    },
  ]);

  await supabase.from("interview_scorecards").insert([
    {
      candidate_id: candByName["Kevin Mwangi"],
      interviewer_id: interId,
      questions: [
        {
          question: "Design a URL shortener system",
          answer: "Described Redis caching, hash generation, analytics layer",
          score: 4,
        },
        {
          question: "Explain Next.js ISR vs SSR",
          answer: "Accurate explanation with real-world tradeoffs",
          score: 5,
        },
        {
          question: "How do you handle database migrations?",
          answer: "Mentioned versioned migrations, rollback strategies",
          score: 4,
        },
      ],
      overall_score: 4.3,
      recommendation: "hire",
      ai_summary:
        "Strong candidate with solid system design thinking. Minor gaps in distributed systems but compensates with strong product sense.",
      submitted_at: daysAgo(14),
    },
    {
      candidate_id: candByName["Wanjiku Njoroge"],
      interviewer_id: engMgrId,
      questions: [
        {
          question:
            "Walk through a complex performance optimization you've done",
          answer:
            "Detailed explanation of React virtualization and bundle splitting",
          score: 5,
        },
        {
          question: "How do you approach API design?",
          answer: "RESTful with OpenAPI specs, versioning strategy discussed",
          score: 5,
        },
        {
          question: "Describe your experience with real-time features",
          answer: "WebSockets and Supabase realtime used in previous role",
          score: 4,
        },
      ],
      overall_score: 4.7,
      recommendation: "hire",
      ai_summary:
        "Top candidate. Exceptional technical depth and communication. Strong fit for senior role. Recommend fast-tracking offer.",
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
      const mood =
        w === 2 ? 2 : w === 3 ? 2 : Math.floor(Math.random() * 2) + 3; // dip at weeks 2–3
      checkinsData.push({
        user_id: uid,
        week_start: monday(w),
        wins: [
          "Shipped the new API endpoint",
          "Fixed critical bug in production",
          "Completed design review with stakeholder",
          "Onboarded new integration partner",
          "Delivered sprint demo",
          "Closed 2 new leads",
        ][w % 6],
        priorities: [
          "Complete Q3 OKR milestone",
          "Code review backlog clearance",
          "Prepare presentation for board",
          "Customer discovery calls",
          "Sprint planning",
          "Budget review",
        ][w % 6],
        blockers:
          w === 2
            ? "Waiting on design sign-off from external team — blocking feature release"
            : w === 3
              ? "Still blocked on API credentials from third-party vendor"
              : null,
        mood,
        status: w === 0 ? "submitted" : "reviewed",
        manager_comment:
          w > 0
            ? "Great progress! Let's discuss the blocker in our 1-on-1 this week."
            : null,
        reviewed_by:
          uid === dev1Id || uid === dev2Id || uid === des1Id || uid === interId
            ? engMgrId
            : uid === mkt1Id
              ? mktMgrId
              : adminId,
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

  const { data: companyGoals } = await supabase
    .from("goals")
    .insert([
      {
        title: "Grow ARR to $500k by Q4",
        level: "company",
        owner_id: null,
        status: "in_progress",
        progress: 62,
        due_date: dateOnly(-90),
        created_by: adminId,
        created_at: daysAgo(120),
      },
      {
        title: "Launch Kazi HR platform publicly",
        level: "company",
        owner_id: null,
        status: "in_progress",
        progress: 78,
        due_date: dateOnly(-30),
        created_by: adminId,
        created_at: daysAgo(90),
      },
      {
        title: "Achieve 95% employee satisfaction score",
        level: "company",
        owner_id: null,
        status: "not_started",
        progress: 0,
        due_date: dateOnly(-180),
        created_by: hrId,
        created_at: daysAgo(60),
      },
    ])
    .select();

  const cgIds = companyGoals!.map((g: { id: string }) => g.id);

  await supabase.from("goals").insert([
    // Team goals
    {
      title: "Ship 3 major product features this quarter",
      level: "team",
      owner_id: engMgrId,
      parent_id: cgIds[1],
      status: "in_progress",
      progress: 67,
      due_date: dateOnly(-60),
      created_by: engMgrId,
      created_at: daysAgo(90),
    },
    {
      title: "Reduce bug backlog by 50%",
      level: "team",
      owner_id: engMgrId,
      status: "in_progress",
      progress: 45,
      due_date: dateOnly(-45),
      created_by: engMgrId,
      created_at: daysAgo(80),
    },
    {
      title: "Launch 2 paid acquisition campaigns",
      level: "team",
      owner_id: mktMgrId,
      parent_id: cgIds[0],
      status: "in_progress",
      progress: 50,
      due_date: dateOnly(-60),
      created_by: mktMgrId,
      created_at: daysAgo(75),
    },
    // Individual goals
    {
      title: "Complete Next.js 15 migration for main app",
      level: "individual",
      owner_id: dev1Id,
      status: "in_progress",
      progress: 80,
      due_date: dateOnly(-20),
      created_by: dev1Id,
      created_at: daysAgo(60),
    },
    {
      title: "Build Kazi design system v2",
      level: "individual",
      owner_id: des1Id,
      status: "in_progress",
      progress: 55,
      due_date: dateOnly(-30),
      created_by: des1Id,
      created_at: daysAgo(50),
    },
    {
      title: "Pass Google Ads certification",
      level: "individual",
      owner_id: mkt1Id,
      status: "completed",
      progress: 100,
      due_date: dateOnly(10),
      created_by: mkt1Id,
      created_at: daysAgo(70),
    },
    {
      title: "Automate monthly financial reporting",
      level: "individual",
      owner_id: fin1Id,
      status: "not_started",
      progress: 0,
      due_date: dateOnly(-90),
      created_by: fin1Id,
      created_at: daysAgo(30),
    },
    {
      title: "Contribute to 2 open-source projects",
      level: "individual",
      owner_id: dev2Id,
      status: "at_risk",
      progress: 20,
      due_date: dateOnly(-15),
      created_by: dev2Id,
      created_at: daysAgo(45),
    },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // 7. 1-ON-1s
  // ══════════════════════════════════════════════════════════════════════════
  console.log("🤝  Seeding 1-on-1s…");

  await supabase.from("one_on_ones").insert([
    {
      manager_id: engMgrId,
      report_id: dev1Id,
      scheduled_at: daysAgo(-1),
      agenda:
        "Q3 progress review, design system status, career growth discussion",
      notes:
        "Kevin is on track for promotion. Discussed a stretch assignment as tech lead for the upcoming product sprint.",
      action_items: [
        { text: "Share tech lead JD draft", done: true },
        { text: "Set up pairing session with Sheila", done: false },
      ],
      ai_talking_points:
        "1. Kevin's goal progress is strong (80%) — discuss timeline confidence. 2. Team morale dip in recent check-ins — explore root cause. 3. Career growth: is he interested in a lead role?",
      created_at: daysAgo(14),
    },
    {
      manager_id: engMgrId,
      report_id: dev2Id,
      scheduled_at: daysAgo(-3),
      agenda: "Open-source goal review, blockers, performance feedback",
      notes:
        "Sheila mentioned feeling stretched thin across three concurrent projects. Agreed to deprioritise internal tooling work.",
      action_items: [
        { text: "Remove internal tooling from Sheila's sprint", done: true },
        {
          text: "Book deep-work day for open-source contributions",
          done: false,
        },
      ],
      ai_talking_points:
        "1. Open-source goal at risk (20% progress, deadline in 15 days). 2. Morale trend — blockers showing in check-ins. 3. Workload recalibration needed.",
      created_at: daysAgo(12),
    },
    {
      manager_id: mktMgrId,
      report_id: mkt1Id,
      scheduled_at: daysAgo(-7),
      agenda: "Google Ads cert celebration, Q4 campaign planning",
      notes:
        "Dennis just passed the certification. Planning to give him the lead on the next acquisition campaign.",
      action_items: [
        { text: "Draft campaign brief", done: false },
        { text: "Add Dennis to the media budget spreadsheet", done: true },
      ],
      ai_talking_points:
        "1. Celebrate Google Ads cert completion. 2. Q4 campaign readiness — timeline and budget. 3. Career discussion: Marketing Manager track?",
      created_at: daysAgo(8),
    },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // 8. FEEDBACK / KUDOS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("🌟  Seeding feedback & kudos…");

  await supabase.from("feedback").insert([
    {
      from_user_id: engMgrId,
      to_user_id: dev1Id,
      message:
        "Kevin, the way you handled the production incident last week was exemplary. Calm under pressure and kept the team informed the whole time. 🔥",
      visibility: "public",
      emoji: "🔥",
      created_at: daysAgo(5),
    },
    {
      from_user_id: dev1Id,
      to_user_id: dev2Id,
      message:
        "Sheila, thanks for the detailed code review on my PR. Your feedback on the pagination logic saved us a headache later.",
      visibility: "public",
      emoji: "💪",
      created_at: daysAgo(8),
    },
    {
      from_user_id: mktMgrId,
      to_user_id: mkt1Id,
      message:
        "Dennis passed the Google Ads certification! This is a huge win for the team and shows real initiative. Well done! ⭐",
      visibility: "public",
      emoji: "⭐",
      created_at: daysAgo(10),
    },
    {
      from_user_id: hrId,
      to_user_id: des1Id,
      message:
        "Wanjiku's design system work has noticeably improved consistency across all our products. The team really appreciates it.",
      visibility: "public",
      emoji: "✨",
      created_at: daysAgo(12),
    },
    {
      from_user_id: adminId,
      to_user_id: engMgrId,
      message:
        "Mercy, the engineering team velocity this quarter has been outstanding. The culture of accountability you've built shows in the results.",
      visibility: "public",
      emoji: "🚀",
      created_at: daysAgo(14),
    },
    {
      from_user_id: engMgrId,
      to_user_id: dev2Id,
      message:
        "Sheila, I'd like us to discuss how we can better protect your focus time. The at-risk goal concerns me — let's fix the workload.",
      visibility: "private",
      emoji: null,
      created_at: daysAgo(4),
    },
    {
      from_user_id: adminId,
      to_user_id: ops1Id,
      message:
        "Faith handled the vendor onboarding with minimal supervision this month. Really impressed with her ownership.",
      visibility: "public",
      emoji: "💡",
      created_at: daysAgo(6),
    },
    {
      from_user_id: fin1Id,
      to_user_id: hrId,
      message:
        "David, the onboarding experience was really smooth for the new hires. The checklists you put together were detailed and helpful.",
      visibility: "public",
      emoji: "👏",
      created_at: daysAgo(18),
    },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // 9. PERFORMANCE REVIEW CYCLE
  // ══════════════════════════════════════════════════════════════════════════
  console.log("⭐  Seeding review cycles…");

  const { data: cycles } = await supabase
    .from("review_cycles")
    .insert([
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
    ])
    .select();

  const cycleQ3 = cycles![0].id;
  const cycleQ2 = cycles![1].id;

  const competencyTemplate = (scores: number[]) => [
    { criterion: "Quality of Work", rating: scores[0], comment: "" },
    { criterion: "Collaboration", rating: scores[1], comment: "" },
    { criterion: "Communication", rating: scores[2], comment: "" },
    { criterion: "Initiative", rating: scores[3], comment: "" },
    { criterion: "Technical/Functional", rating: scores[4], comment: "" },
  ];

  await supabase.from("performance_reviews").insert([
    // Q3 — self reviews
    {
      cycle_id: cycleQ3,
      reviewee_id: dev1Id,
      reviewer_id: dev1Id,
      review_type: "self",
      competency_ratings: competencyTemplate([4, 4, 4, 5, 5]),
      overall_rating: 4.4,
      strengths: "Deep technical expertise and mentoring teammates.",
      development_areas:
        "Could delegate more effectively to grow leadership skills.",
      submitted_at: daysAgo(20),
    },
    {
      cycle_id: cycleQ3,
      reviewee_id: dev2Id,
      reviewer_id: dev2Id,
      review_type: "self",
      competency_ratings: competencyTemplate([3, 4, 3, 3, 4]),
      overall_rating: 3.4,
      strengths: "Strong code quality and attention to detail.",
      development_areas:
        "Time management and prioritization under concurrent workloads.",
      submitted_at: daysAgo(18),
    },
    {
      cycle_id: cycleQ3,
      reviewee_id: des1Id,
      reviewer_id: des1Id,
      review_type: "self",
      competency_ratings: competencyTemplate([5, 4, 4, 4, 5]),
      overall_rating: 4.4,
      strengths: "Exceptional design quality and user empathy.",
      development_areas: "Building confidence to push back on scope creep.",
      submitted_at: daysAgo(17),
    },
    {
      cycle_id: cycleQ3,
      reviewee_id: mkt1Id,
      reviewer_id: mkt1Id,
      review_type: "self",
      competency_ratings: competencyTemplate([4, 3, 4, 5, 4]),
      overall_rating: 4.0,
      strengths:
        "High initiative — proactively pursued and passed Google Ads cert.",
      development_areas:
        "Cross-functional collaboration and sharing wins with the team.",
      submitted_at: daysAgo(16),
    },
    // Q3 — manager reviews
    {
      cycle_id: cycleQ3,
      reviewee_id: dev1Id,
      reviewer_id: engMgrId,
      review_type: "manager",
      competency_ratings: competencyTemplate([5, 4, 4, 5, 5]),
      overall_rating: 4.6,
      strengths:
        "Kevin is our most reliable senior IC. Production incident handling was outstanding.",
      development_areas: "Leadership path — ready for a tech lead stretch.",
      submitted_at: daysAgo(5),
    },
    {
      cycle_id: cycleQ3,
      reviewee_id: dev2Id,
      reviewer_id: engMgrId,
      review_type: "manager",
      competency_ratings: competencyTemplate([4, 4, 3, 3, 4]),
      overall_rating: 3.6,
      strengths: "Solid technical skills and quality code.",
      development_areas:
        "Goal attainment needs attention — open-source goal at serious risk.",
      submitted_at: daysAgo(3),
    },
    // Q2 — completed reviews
    {
      cycle_id: cycleQ2,
      reviewee_id: dev1Id,
      reviewer_id: engMgrId,
      review_type: "manager",
      competency_ratings: competencyTemplate([4, 4, 5, 4, 5]),
      overall_rating: 4.4,
      strengths: "Consistently strong performer.",
      development_areas: "Continue developing documentation habits.",
      submitted_at: daysAgo(120),
    },
    {
      cycle_id: cycleQ2,
      reviewee_id: mkt1Id,
      reviewer_id: mktMgrId,
      review_type: "manager",
      competency_ratings: competencyTemplate([3, 3, 4, 4, 3]),
      overall_rating: 3.4,
      strengths: "Growing quickly in paid media skills.",
      development_areas: "Needs to improve campaign reporting rigor.",
      submitted_at: daysAgo(118),
    },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // 10. SURVEYS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("📊  Seeding surveys…");

  const { data: surveys } = await supabase
    .from("surveys")
    .insert([
      {
        title: "Q3 Employee Engagement Pulse",
        description: "A quick check on how the team is feeling this quarter.",
        questions: [
          {
            id: "q1",
            text: "How satisfied are you with your current role?",
            type: "scale",
          },
          {
            id: "q2",
            text: "Do you feel your manager supports your growth?",
            type: "scale",
          },
          {
            id: "q3",
            text: "How likely are you to recommend Growthpad as a great place to work?",
            type: "scale",
          },
          {
            id: "q4",
            text: "What's one thing we could improve about how we work together?",
            type: "text",
          },
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
        description:
          "Share your thoughts on our current hybrid working arrangements.",
        questions: [
          {
            id: "q1",
            text: "The current hybrid policy meets my needs",
            type: "scale",
          },
          {
            id: "q2",
            text: "I have the tools I need to work effectively from home",
            type: "scale",
          },
          {
            id: "q3",
            text: "What would make remote work better for you?",
            type: "text",
          },
        ],
        status: "active",
        anonymous: false,
        created_by: hrId,
        opens_at: daysAgo(5),
        closes_at: daysAgo(-14),
        created_at: daysAgo(7),
      },
    ])
    .select();

  // Survey responses for Q3 Engagement Pulse
  const surveyQ3Id = surveys![0].id;
  const surveyResponses = [
    {
      respondent: null,
      q1: 4,
      q2: 4,
      q3: 4,
      q4: "Better async communication norms would help the remote folks.",
    },
    {
      respondent: null,
      q1: 3,
      q2: 4,
      q3: 4,
      q4: "More structured career growth conversations with managers.",
    },
    {
      respondent: null,
      q1: 5,
      q2: 5,
      q3: 5,
      q4: "Nothing — keep doing what you're doing!",
    },
    {
      respondent: null,
      q1: 3,
      q2: 3,
      q3: 3,
      q4: "The tooling for knowledge sharing could be better.",
    },
    {
      respondent: null,
      q1: 4,
      q2: 5,
      q3: 4,
      q4: "Team off-sites would be great for relationship building.",
    },
    {
      respondent: null,
      q1: 4,
      q2: 4,
      q3: 5,
      q4: "Clearer OKR cascading from company to individuals.",
    },
  ];
  await supabase.from("survey_responses").insert(
    surveyResponses.map((r) => ({
      survey_id: surveyQ3Id,
      respondent_id: null,
      answers: { q1: r.q1, q2: r.q2, q3: r.q3, q4: r.q4 },
      submitted_at: daysAgo(Math.floor(Math.random() * 23) + 7),
    })),
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 11. IDPs
  // ══════════════════════════════════════════════════════════════════════════
  console.log("📈  Seeding IDPs…");

  await supabase.from("idps").insert([
    {
      user_id: dev1Id,
      manager_id: engMgrId,
      title: "Kevin — Engineering Lead Readiness",
      goals:
        "Develop leadership and project management skills to step into a Tech Lead role by Q1 next year. Focus on system design, stakeholder communication, and mentoring junior engineers.",
      actions: [
        {
          text: "Complete system design course (Educative.io)",
          due_date: dateOnly(-30),
          done: true,
        },
        {
          text: "Lead 1 major feature end-to-end (as tech lead)",
          due_date: dateOnly(-15),
          done: true,
        },
        {
          text: "Mentor dev2 on TypeScript best practices (monthly sessions)",
          due_date: dateOnly(-60),
          done: false,
        },
        {
          text: "Present architecture review to engineering team",
          due_date: dateOnly(-45),
          done: false,
        },
      ],
      status: "active",
      due_date: dateOnly(-90),
      created_at: daysAgo(60),
    },
    {
      user_id: des1Id,
      manager_id: engMgrId,
      title: "Wanjiku — Senior Designer Transition",
      goals:
        "Transition from mid to senior IC by deepening product strategy involvement and building cross-functional influence.",
      actions: [
        {
          text: "Run a full discovery sprint independently",
          due_date: dateOnly(-20),
          done: false,
        },
        {
          text: "Complete Interaction Design Foundation UX Research course",
          due_date: dateOnly(-10),
          done: true,
        },
        {
          text: "Present design principles to the whole company (all-hands)",
          due_date: dateOnly(-40),
          done: false,
        },
      ],
      status: "active",
      due_date: dateOnly(-60),
      created_at: daysAgo(45),
    },
    {
      user_id: mkt1Id,
      manager_id: mktMgrId,
      title: "Dennis — Marketing Manager Track",
      goals:
        "Build skills to move from Digital Marketer to Marketing Manager. Focus on strategy, budget ownership, and team collaboration.",
      actions: [
        {
          text: "Pass Google Ads certification",
          due_date: dateOnly(10),
          done: true,
        },
        {
          text: "Own Q4 campaign budget and reporting",
          due_date: dateOnly(-60),
          done: false,
        },
        {
          text: "Shadow Brian on 3 client strategy sessions",
          due_date: dateOnly(-30),
          done: true,
        },
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
      user_id: dev2Id,
      manager_id: engMgrId,
      hr_id: hrId,
      concern:
        "Sheila has missed two consecutive personal goals (open-source contributions and code quality target). Check-in mood scores have trended downward over four weeks, and there have been two incidents of blocked delivery due to incomplete work handover.",
      expected_outcomes:
        "1. Complete the open-source contributions goal (2 contributions) by end of month. 2. Consistent on-time handover of sprint tasks. 3. Mood score average of 3+ over the next 4 check-ins. 4. Regular blockers raised proactively — not discovered by manager.",
      support_provided:
        "Workload has been adjusted (internal tooling removed from sprint). 1-on-1 frequency increased to weekly. Manager available for pair debugging sessions on Tuesdays.",
      check_in_frequency: "weekly",
      actions: [
        {
          text: "First open-source PR merged",
          due_date: dateOnly(-14),
          done: false,
        },
        {
          text: "Complete sprint handover documentation for current sprint",
          due_date: dateOnly(-7),
          done: true,
        },
        {
          text: "Share weekly progress update with manager every Friday",
          due_date: dateOnly(-28),
          done: false,
        },
        {
          text: "Second open-source PR merged",
          due_date: dateOnly(-28),
          done: false,
        },
      ],
      start_date: dateOnly(14),
      review_date: dateOnly(-28),
      created_at: daysAgo(14),
    },
  ]);

  console.log("\n✅  Seed complete!\n");
  console.log("Demo login credentials:");
  console.log(
    "  analytics.growthpad@gmail.com → Admin (password: testpassword)",
  );
  console.log("  All other accounts → password: Demo1234!");
  console.log("  hr@growthpad.africa       → HR Manager");
  console.log("  eng.mgr@growthpad.africa  → Engineering Manager");
  console.log("  mkt.mgr@growthpad.africa  → Marketing / Hiring Manager");
  console.log("  dev1@growthpad.africa     → Senior Developer (Kevin Mwangi)");
  console.log(
    "  dev2@growthpad.africa     → Backend Developer (Sheila Achieng)",
  );
  console.log("  des1@growthpad.africa     → UI/UX Designer (Wanjiku Njoroge)");
  console.log("  mkt1@growthpad.africa     → Digital Marketer (Dennis Kiptoo)");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
