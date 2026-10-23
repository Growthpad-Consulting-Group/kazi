/**
 * Candidates-only seed script — wipes and re-seeds candidates, notes,
 * and interview scorecards without touching users, jobs or any other data.
 *
 * Run: npx tsx scripts/seed-candidates.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// Job IDs from the live DB
const JOB_IDS = {
  developer: "db754a79-588c-4223-a46d-00a150f3055f",
  designer:  "355be3e6-e141-4a81-a7c6-3cfe9c5221aa",
  marketing: "8f653c15-6d0a-4ecb-9a7f-26ef3c9bba32",
  project:   "fe7fdf26-b1e6-491d-9076-3157566f0b02",
  sales:     "44383ed0-5857-433d-a43a-922184ffd9ae",
};

async function run() {
  // ── Wipe existing candidate-related data ──────────────────────────────────
  console.log("🗑️   Wiping existing candidates, notes and scorecards…");
  for (const table of ["ai_logs", "interview_scorecards", "candidate_notes", "candidates"]) {
    const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) console.warn(`  wipe ${table}: ${error.message}`);
  }

  // ── Seed candidates ────────────────────────────────────────────────────────
  console.log("🧑‍💼  Seeding candidates…");

  const { data: candidates, error: cErr } = await supabase.from("candidates").insert([

    // ── Senior Full-Stack Developer ──────────────────────────────────────────
    {
      job_id: JOB_IDS.developer, full_name: "Kevin Mwangi", email: "kofi.a@email.com",
      phone: "+254701234567", location: "Nairobi", stage: "interview", ai_score: 87.5,
      ai_justification: "Strong TypeScript, React and Node.js experience with a track record of shipping production web applications.",
      shortlisted: true, source: "linkedin", applied_at: daysAgo(40), consented_at: daysAgo(40),
      cv_text: `Kevin Mwangi — Senior Full-Stack Developer
Nairobi, Kenya | kevin.mwangi@email.com | +254701234567

SUMMARY
Full-stack developer with 6 years of experience building scalable web applications using TypeScript, React and Node.js. Comfortable across the entire stack from database design to UI delivery.

EXPERIENCE
Senior Developer — Andela (2022–Present)
- Led migration of monolithic Rails app to Next.js/TypeScript microservices, reducing page load times by 60%
- Built real-time collaboration features using Supabase Realtime and WebSockets
- Mentored 3 junior developers; introduced code review standards and CI/CD pipelines

Full-Stack Developer — Safaricom Digital (2019–2022)
- Delivered customer-facing portal handling 200k+ daily sessions
- Integrated M-Pesa API and Flutterwave payment gateways
- Reduced API response times by 40% through Redis caching strategy

SKILLS
TypeScript, React, Next.js, Node.js, PostgreSQL, Supabase, Redis, Docker, AWS, GraphQL

EDUCATION
BSc Computer Science — University of Nairobi (2015–2019)`,
    },
    {
      job_id: JOB_IDS.developer, full_name: "Wanjiku Njoroge", email: "priya.s@email.com",
      phone: "+254722801234", location: "Nairobi", stage: "offer", ai_score: 91.0,
      ai_justification: "Excellent full-stack profile with strong system design, API development and technical communication.",
      shortlisted: true, source: "referral", applied_at: daysAgo(35), consented_at: daysAgo(35),
      cv_text: `Wanjiku Njoroge — Full-Stack Engineer
Nairobi, Kenya | wanjiku.n@email.com | +254722801234

SUMMARY
Senior full-stack engineer with 7+ years building high-performance web platforms. Expert in React, Next.js and Node.js. Strong background in API design, system architecture and cross-functional team collaboration.

EXPERIENCE
Staff Engineer — Twiga Foods (2021–Present)
- Architected and delivered logistics platform used by 15,000+ vendors across Kenya
- Designed RESTful API layer with OpenAPI documentation; onboarded 5 third-party integrations
- Drove performance optimisation: 50% reduction in Time to Interactive via bundle splitting and React virtualisation

Full-Stack Developer — Craft Silicon (2017–2021)
- Built banking and fintech products serving 500k+ customers across Africa
- Introduced typed API contracts using Zod; eliminated 90% of runtime type errors
- Delivered real-time notifications system using WebSockets

SKILLS
TypeScript, React, Next.js, Node.js, PostgreSQL, Redis, Kubernetes, GCP, REST, GraphQL

EDUCATION
BSc Software Engineering — Strathmore University (2013–2017)`,
    },
    {
      job_id: JOB_IDS.developer, full_name: "Brian Otieno", email: "sam.n@email.com",
      phone: "+254723271234", location: "Kisumu", stage: "screened", ai_score: 72.0,
      ai_justification: "Good React and JavaScript foundations; needs deeper experience with backend architecture and relational data modelling.",
      shortlisted: false, source: "direct", applied_at: daysAgo(30), consented_at: daysAgo(30),
      cv_text: `Brian Otieno — Web Developer
Kisumu, Kenya | brian.otieno@email.com | +254723271234

SUMMARY
3 years of frontend and light backend development experience. Proficient in React and JavaScript with growing exposure to Node.js.

EXPERIENCE
Frontend Developer — Kisumu Digital Hub (2022–Present)
- Built 8 client websites using React and Gatsby
- Developed internal CRM dashboard with REST API integration
- Introduced ESLint and Prettier standards to the team

Junior Developer — Lake Tech Solutions (2021–2022)
- Maintained WordPress and PHP-based client sites
- Built a booking management module in vanilla JavaScript

SKILLS
JavaScript, React, HTML/CSS, Node.js (basic), MySQL, REST APIs, Git

EDUCATION
Diploma in Information Technology — Kenya Institute of Management (2019–2021)`,
    },
    {
      job_id: JOB_IDS.developer, full_name: "Faith Wambui", email: "amara.d@email.com",
      phone: "+254724771234", location: "Nairobi", stage: "screened", ai_score: 68.0,
      ai_justification: "Strong backend project experience but limited evidence of the React and TypeScript depth required for this role.",
      shortlisted: false, source: "linkedin", applied_at: daysAgo(28), consented_at: daysAgo(28),
      cv_text: `Faith Wambui — Backend Developer
Nairobi, Kenya | faith.wambui@email.com | +254724771234

SUMMARY
Backend-focused developer with 4 years building APIs, microservices and data pipelines. Strong in Python and Django; currently expanding React knowledge.

EXPERIENCE
Backend Developer — Cellulant (2021–Present)
- Built payment processing microservices handling KES 2B+ in transactions annually
- Designed PostgreSQL schemas and optimised slow queries (70% improvement)
- Developed internal analytics API consumed by 4 frontend teams

Software Developer — WeFarm (2020–2021)
- Built SMS-based data collection API using Python and Twilio
- Integrated with farmer database used across Uganda and Kenya

SKILLS
Python, Django, PostgreSQL, REST APIs, Docker, Redis, Git, React (learning)

EDUCATION
BSc Information Systems — USIU-Africa (2016–2020)`,
    },
    {
      job_id: JOB_IDS.developer, full_name: "Dennis Kiptoo", email: "tunde.b@email.com",
      phone: "+254725701234", location: "Eldoret", stage: "applied", ai_score: 55.0,
      ai_justification: "Relevant experience, but the application does not yet demonstrate the required full-stack delivery depth.",
      shortlisted: false, source: "direct", applied_at: daysAgo(5), consented_at: daysAgo(5),
      cv_text: `Dennis Kiptoo — Junior Developer
Eldoret, Kenya | dennis.kiptoo@email.com | +254725701234

SUMMARY
Self-taught developer with 2 years of freelance project experience. Building skills in full-stack development with JavaScript.

EXPERIENCE
Freelance Developer (2022–Present)
- Built 5 small business websites using HTML, CSS and vanilla JavaScript
- Developed a simple stock tracking tool for a local shop using Google Sheets API
- Currently building a personal project: a task management app in React

SKILLS
JavaScript, HTML/CSS, React (learning), Node.js (basic), MySQL

EDUCATION
BSc Computer Science — Moi University (2018–2022, ongoing)`,
    },
    {
      job_id: JOB_IDS.developer, full_name: "Njeri Karanja", email: "fatima.o@email.com",
      phone: "+254726712345", location: "Nakuru", stage: "rejected", ai_score: 41.0,
      ai_justification: "Experience is primarily in CMS implementation, with limited modern JavaScript and application-development exposure.",
      shortlisted: false, source: "direct", applied_at: daysAgo(42), consented_at: daysAgo(42),
      cv_text: `Njeri Karanja — Web Content Developer
Nakuru, Kenya | njeri.karanja@email.com | +254726712345

SUMMARY
2 years experience in web content management and WordPress site development.

EXPERIENCE
Web Developer — Nakuru County Communications (2022–Present)
- Manages county government website using WordPress
- Creates and schedules digital content across platforms
- Basic HTML/CSS edits for site updates

SKILLS
WordPress, HTML, CSS, Google Analytics, Canva

EDUCATION
Diploma in Mass Communication — Nakuru Polytechnic (2019–2021)`,
    },
    {
      job_id: JOB_IDS.developer, full_name: "Mark Kiprono", email: "bright.m@email.com",
      phone: "+254727551234", location: "Nairobi", stage: "hired", ai_score: 88.0,
      ai_justification: "Excellent full-stack delivery history, high code quality and strong collaboration across product and design.",
      shortlisted: true, source: "linkedin", applied_at: daysAgo(60), consented_at: daysAgo(60),
      cv_text: `Mark Kiprono — Principal Engineer
Nairobi, Kenya | mark.kiprono@email.com | +254727551234

SUMMARY
8 years building complex web applications with a focus on engineering leadership, code quality and developer experience. Strong in TypeScript, React and distributed systems.

EXPERIENCE
Principal Engineer — Equity Bank Digital (2020–Present)
- Technical lead for mobile banking web platform (2M+ active users)
- Designed event-driven microservices architecture processing 500k+ daily transactions
- Established engineering best practices: testing, code review, CI/CD standards

Senior Developer — Ushahidi (2016–2020)
- Built open-source crisis-mapping tools used globally
- Led full migration from AngularJS to React; improved test coverage from 30% to 85%

SKILLS
TypeScript, React, Next.js, Node.js, PostgreSQL, Kafka, AWS, Docker, Kubernetes

EDUCATION
BEng Computer Engineering — Jomo Kenyatta University (2012–2016)`,
    },
    {
      job_id: JOB_IDS.developer, full_name: "Sheila Achieng", email: "nia.o@email.com",
      phone: "+254728112233", location: "Nairobi", stage: "applied", ai_score: null,
      shortlisted: false, source: "direct", applied_at: daysAgo(2), consented_at: daysAgo(2),
      cv_text: `Sheila Achieng — Software Developer
Nairobi, Kenya | sheila.achieng@email.com | +254728112233

SUMMARY
Developer with 3 years of experience in React frontends and Python backends. Comfortable with REST API development and database design.

EXPERIENCE
Software Developer — Sendy (2021–Present)
- Developed driver-facing mobile web app used by 8,000+ couriers
- Built logistics reporting dashboard consumed by operations team daily
- Maintained PostgreSQL database schema for order management system

Junior Developer — Jumia Kenya (2020–2021)
- Contributed to internal tooling for inventory management
- Fixed bugs and added features to seller portal

SKILLS
React, Python, Django, PostgreSQL, REST APIs, Git, TypeScript (learning)

EDUCATION
BSc Computer Science — Kenyatta University (2016–2020)`,
    },
    {
      job_id: JOB_IDS.developer, full_name: "Peter Mutua", email: "peter.m@example.com",
      phone: "+254729223344", location: "Mombasa", stage: "applied", ai_score: null,
      shortlisted: false, source: "referral", applied_at: daysAgo(0), consented_at: daysAgo(0),
      cv_text: `Peter Mutua — Full-Stack Developer
Mombasa, Kenya | peter.mutua@email.com | +254729223344

SUMMARY
4 years of full-stack development experience with strong React and Node.js skills. Based in Mombasa, open to hybrid and remote opportunities.

EXPERIENCE
Full-Stack Developer — Port of Mombasa Digital Unit (2021–Present)
- Built cargo tracking web application used by shipping agents
- Developed REST API backend in Node.js and Express
- Maintained MySQL database for vessel schedule management

Frontend Developer — Coast Digital Agency (2019–2021)
- Delivered 12 client sites in React and Gatsby
- Built e-commerce integrations with WooCommerce and Shopify

SKILLS
React, Node.js, Express, TypeScript, MySQL, PostgreSQL, REST APIs, Git

EDUCATION
BSc Information Technology — Technical University of Mombasa (2015–2019)`,
    },

    // ── Product Designer (UI/UX) ─────────────────────────────────────────────
    {
      job_id: JOB_IDS.designer, full_name: "Pauline Wairimu", email: "pauline.w@email.com",
      phone: "+254711234567", location: "Nairobi", stage: "interview", ai_score: 84.0,
      ai_justification: "Strong Figma portfolio with evidence of user research, prototyping and design-system work.",
      shortlisted: true, source: "linkedin", applied_at: daysAgo(25), consented_at: daysAgo(25),
      cv_text: `Pauline Wairimu — Product Designer
Nairobi, Kenya | pauline.wairimu@email.com | +254711234567

SUMMARY
5 years of product design experience across fintech, health and logistics. Expert in Figma, user research and design systems. Passionate about accessible, inclusive design.

EXPERIENCE
Senior Product Designer — Pula Insurance (2022–Present)
- Led design for farmer insurance product serving 2M+ smallholder farmers
- Conducted 40+ user interviews across Kenya, Nigeria and Ghana
- Built and maintained Figma design system used by 6 product squads

Product Designer — Flutterwave (2019–2022)
- Redesigned onboarding flow; reduced drop-off by 35%
- Ran usability tests for payment checkout; increased conversion by 22%

SKILLS
Figma, Prototyping, User Research, Usability Testing, Design Systems, Accessibility

EDUCATION
BA Design — Kenyatta University (2014–2018)`,
    },
    {
      job_id: JOB_IDS.designer, full_name: "Esther Chebet", email: "esther.c@email.com",
      phone: "+254724123456", location: "Nakuru", stage: "screened", ai_score: 76.5,
      ai_justification: "Solid interface design skills; needs stronger evidence of structured user-research practice.",
      shortlisted: false, source: "direct", applied_at: daysAgo(22), consented_at: daysAgo(22),
      cv_text: `Esther Chebet — UI/UX Designer
Nakuru, Kenya | esther.chebet@email.com | +254724123456

SUMMARY
UI/UX designer with 3 years of experience creating clean, functional interfaces for mobile and web applications.

EXPERIENCE
UI/UX Designer — Nakuru County Health (2022–Present)
- Designed patient registration and appointment booking interfaces
- Created UI components library in Figma for the digital health team
- Ran 5 informal usability sessions with clinic staff

Design Intern — Pixel Creative (2021–2022)
- Designed marketing landing pages and social media assets
- Contributed to client app redesigns

SKILLS
Figma, Adobe XD, Prototyping, Wireframing, UI Design, Basic HTML/CSS

EDUCATION
BSc Information Technology — Egerton University (2017–2021)`,
    },
    {
      job_id: JOB_IDS.designer, full_name: "Collins Odhiambo", email: "collins.o@email.com",
      phone: "+254726123456", location: "Kisumu", stage: "applied", ai_score: null,
      shortlisted: false, source: "linkedin", applied_at: daysAgo(3), consented_at: daysAgo(3),
      cv_text: `Collins Odhiambo — Graphic & UI Designer
Kisumu, Kenya | collins.odhiambo@email.com | +254726123456

SUMMARY
Creative designer transitioning from graphic design into product design. Strong visual design skills with growing interest in UX methodology.

EXPERIENCE
Graphic & UI Designer — Lake Basin Media (2021–Present)
- Designed print and digital marketing collateral for 20+ clients
- Created UI mockups for 3 mobile app projects using Figma
- Developed brand identity systems for regional NGOs

Freelance Designer (2020–2021)
- Delivered social media design packages for SMEs in Kisumu

SKILLS
Figma, Adobe Illustrator, Photoshop, UI Design, Brand Identity

EDUCATION
Diploma in Graphic Design — Maseno University (2018–2020)`,
    },

    // ── Digital Marketing Manager ────────────────────────────────────────────
    {
      job_id: JOB_IDS.marketing, full_name: "Lydia Wanjiru", email: "lydia.w@email.com",
      phone: "+254712123456", location: "Nairobi", stage: "offer", ai_score: 89.0,
      ai_justification: "Strong campaign strategy and paid-media record with clear evidence of measurable growth results.",
      shortlisted: true, source: "referral", applied_at: daysAgo(18), consented_at: daysAgo(18),
      cv_text: `Lydia Wanjiru — Digital Marketing Manager
Nairobi, Kenya | lydia.wanjiru@email.com | +254712123456

SUMMARY
6 years of digital marketing experience specialising in paid acquisition, SEO and marketing analytics. Proven track record of scaling growth for B2B and B2C brands across Africa.

EXPERIENCE
Digital Marketing Manager — Wasoko (2021–Present)
- Managed $400k annual paid media budget across Google, Meta and TikTok
- Grew organic traffic by 180% through content-led SEO strategy
- Built marketing attribution model; improved ROAS tracking accuracy by 45%

Growth Marketer — Jumia (2018–2021)
- Led email marketing for 2M+ subscribers; improved open rate from 12% to 22%
- Ran A/B tests on landing pages that improved conversion by 31%

SKILLS
Google Ads, Meta Ads, SEO, Email Marketing, HubSpot, Google Analytics 4, Data Studio

EDUCATION
BA Marketing — United States International University (2014–2018)`,
    },
    {
      job_id: JOB_IDS.marketing, full_name: "Caleb Kibet", email: "caleb.k@email.com",
      phone: "+254713123456", location: "Eldoret", stage: "screened", ai_score: 65.0,
      ai_justification: "Good content and social-media experience, but paid-media and analytics depth are limited.",
      shortlisted: false, source: "direct", applied_at: daysAgo(15), consented_at: daysAgo(15),
      cv_text: `Caleb Kibet — Social Media & Content Marketer
Eldoret, Kenya | caleb.kibet@email.com | +254713123456

SUMMARY
3 years of social media and content marketing experience. Strong in community management and organic growth; growing skills in paid media.

EXPERIENCE
Social Media Manager — Rift Valley FM (2021–Present)
- Grew Instagram following from 12k to 85k organically over 18 months
- Produced daily video content; top post reached 2M views
- Ran Facebook Ads for station events; managed modest budgets under KES 200k

Content Creator — Freelance (2020–2021)
- Produced branded content for 8 SME clients
- Managed LinkedIn company pages for 3 professional services firms

SKILLS
Instagram, Facebook, TikTok, Facebook Ads (basic), Canva, Hootsuite, Copywriting

EDUCATION
BA Mass Communication — Moi University (2016–2020)`,
    },
    {
      job_id: JOB_IDS.marketing, full_name: "Sharon Atieno", email: "sharon.a@email.com",
      phone: "+254714123456", location: "Mombasa", stage: "applied", ai_score: null,
      shortlisted: false, source: "direct", applied_at: daysAgo(4), consented_at: daysAgo(4),
      cv_text: `Sharon Atieno — Digital Marketing Specialist
Mombasa, Kenya | sharon.atieno@email.com | +254714123456

SUMMARY
4 years of digital marketing experience with focus on e-commerce and tourism clients. Hands-on with Google Ads, Meta Ads and analytics.

EXPERIENCE
Digital Marketing Specialist — Mombasa Tourism Board (2021–Present)
- Managed KES 1.5M annual digital advertising budget across Google and Meta
- Developed content calendar and managed 4 social media channels
- Built Google Analytics 4 dashboard for board executive reporting

Marketing Executive — Serena Hotels Kenya (2019–2021)
- Ran email campaigns for hotel promotions; 28% average open rate
- Supported OTA partnerships with Booking.com and Expedia

SKILLS
Google Ads, Meta Ads, GA4, Email Marketing (Mailchimp), SEO basics, Content Strategy

EDUCATION
BBA Marketing — Mombasa Polytechnic University (2015–2019)`,
    },

    // ── Project Manager ──────────────────────────────────────────────────────
    {
      job_id: JOB_IDS.project, full_name: "Hassan Abdalla", email: "hassan.a@email.com",
      phone: "+254715123456", location: "Mombasa", stage: "screened", ai_score: 79.5,
      ai_justification: "Strong project planning and reporting background with evidence of managing stakeholders, risks and delivery timelines.",
      shortlisted: true, source: "linkedin", applied_at: daysAgo(8), consented_at: daysAgo(8),
      cv_text: `Hassan Abdalla — Project Manager
Mombasa, Kenya | hassan.abdalla@email.com | +254715123456

SUMMARY
PMP-certified project manager with 5 years delivering digital and infrastructure projects across the public and private sectors. Strong in stakeholder management, risk planning and reporting.

EXPERIENCE
Project Manager — Kenya Ports Authority (2021–Present)
- Led KES 120M port logistics digitalisation project; delivered on time and 8% under budget
- Managed 14-person cross-functional team across IT, operations and finance
- Developed risk register and change management process for the digital transformation programme

Associate PM — Kenya Red Cross (2019–2021)
- Coordinated 6 concurrent humanitarian aid projects across 3 counties
- Prepared donor reports and maintained project dashboards in Asana and MS Project

CERTIFICATIONS: PMP, PRINCE2 Foundation

SKILLS
Project Planning, Stakeholder Management, Risk Management, Asana, MS Project, Budget Tracking, Agile/Scrum

EDUCATION
BSc Project Management — Technical University of Mombasa (2014–2018)`,
    },
    {
      job_id: JOB_IDS.project, full_name: "Naomi Wambui", email: "naomi.w@email.com",
      phone: "+254716123456", location: "Nairobi", stage: "applied", ai_score: null,
      shortlisted: false, source: "direct", applied_at: daysAgo(6), consented_at: daysAgo(6),
      cv_text: `Naomi Wambui — Programme Coordinator
Nairobi, Kenya | naomi.wambui@email.com | +254716123456

SUMMARY
3 years of programme coordination and project support experience in the NGO and development sector.

EXPERIENCE
Programme Coordinator — GIZ Kenya (2021–Present)
- Coordinated logistics and reporting for 4 development programmes
- Maintained project trackers and prepared monthly donor updates
- Organised stakeholder workshops with government counterparts

Project Assistant — Plan International (2020–2021)
- Supported field teams on community development projects
- Tracked budgets and processed supplier payments

SKILLS
Project Coordination, Reporting, Stakeholder Liaison, MS Project (basic), Excel, Google Workspace

EDUCATION
BA Development Studies — University of Nairobi (2016–2020)`,
    },
    {
      job_id: JOB_IDS.project, full_name: "Eric Kamau", email: "eric.k@email.com",
      phone: "+254717123456", location: "Thika", stage: "applied", ai_score: null,
      shortlisted: false, source: "linkedin", applied_at: daysAgo(0), consented_at: daysAgo(0),
      cv_text: `Eric Kamau — IT Project Manager
Thika, Kenya | eric.kamau@email.com | +254717123456

SUMMARY
4 years of IT project management and business analysis experience. Background in ERP implementations and systems integration projects.

EXPERIENCE
IT Project Manager — Bidco Africa (2021–Present)
- Led SAP S/4HANA implementation across 3 manufacturing plants; KES 80M budget
- Managed vendor relationships with Deloitte implementation partner
- Delivered project 2 months ahead of schedule through rigorous scope management

Business Analyst — Safaricom (2019–2021)
- Gathered and documented requirements for CRM integration project
- Facilitated 30+ workshops with business and IT stakeholders

SKILLS
Project Management, Business Analysis, SAP, Jira, Agile, Requirements Gathering, Vendor Management

EDUCATION
BSc Business Information Technology — Dedan Kimathi University (2015–2019)`,
    },

    // ── Business Development Executive (closed) ──────────────────────────────
    {
      job_id: JOB_IDS.sales, full_name: "Beatrice Muthoni", email: "beatrice.m@email.com",
      phone: "+254718123456", location: "Nairobi", stage: "hired", ai_score: 92.0,
      ai_justification: "Excellent consultative selling record with strong proposal development and regional account growth experience.",
      shortlisted: true, source: "referral", applied_at: daysAgo(85), consented_at: daysAgo(85),
      cv_text: `Beatrice Muthoni — Business Development Director
Nairobi, Kenya | beatrice.muthoni@email.com | +254718123456

SUMMARY
8 years of B2B business development and consultative sales experience in professional services and technology. Consistent record of exceeding targets and growing accounts across East Africa.

EXPERIENCE
Business Development Manager — Ernst & Young Kenya (2019–Present)
- Grew advisory services pipeline by KES 350M over 3 years
- Led tender responses for 12 government digital transformation contracts; won 8
- Built relationships with C-suite stakeholders across banking, telco and FMCG

Senior BD Executive — PwC Kenya (2016–2019)
- Exceeded annual revenue target by 40% in second year
- Developed proposal templates adopted firm-wide; reduced proposal turnaround by 30%

SKILLS
Consultative Selling, Proposal Writing, Stakeholder Management, CRM (Salesforce), Negotiation, Pipeline Management

EDUCATION
MBA — Strathmore Business School (2016)
BCom — University of Nairobi (2011–2015)`,
    },
    {
      job_id: JOB_IDS.sales, full_name: "Joseph Kiprotich", email: "joseph.k@email.com",
      phone: "+254719123456", location: "Eldoret", stage: "rejected", ai_score: 58.0,
      ai_justification: "Good business-development foundations but proposal and enterprise-sales evidence was below threshold.",
      shortlisted: false, source: "direct", applied_at: daysAgo(87), consented_at: daysAgo(87),
      cv_text: `Joseph Kiprotich — Sales Executive
Eldoret, Kenya | joseph.kiprotich@email.com | +254719123456

SUMMARY
3 years of sales experience in financial services and FMCG. Strong prospecting and relationship-building skills; limited enterprise or B2B professional services exposure.

EXPERIENCE
Sales Executive — Equity Bank (2021–Present)
- Acquired 450+ new retail and SME banking customers in Rift Valley region
- Achieved 115% of annual deposit mobilisation target in 2022

Field Sales Representative — EABL (2020–2021)
- Managed 80+ outlet accounts across Eldoret and Kitale
- Grew territory revenue by 18% in first year

SKILLS
Prospecting, Relationship Management, Negotiation, CRM (Salesforce basic), Financial Products

EDUCATION
BCom Marketing — Moi University (2015–2019)`,
    },

  ]).select();
  if (cErr) throw cErr;
  console.log(`  ✓ Inserted ${candidates!.length} candidates`);

  const candByName = Object.fromEntries(
    candidates!.map((c: { full_name: string; id: string }) => [c.full_name, c.id])
  );

  // ── Notes & scorecards ────────────────────────────────────────────────────
  console.log("📝  Seeding notes & scorecards…");

  // Get interviewer/manager IDs
  const { data: users } = await supabase
    .from("users")
    .select("id, email")
    .in("email", ["eng.mgr@growthpad.africa", "mkt.mgr@growthpad.africa", "interviewer@growthpad.africa"]);

  const byEmail = Object.fromEntries(
    (users ?? []).map((u: { email: string; id: string }) => [u.email, u.id])
  );
  const engMgrId = byEmail["eng.mgr@growthpad.africa"];
  const mktMgrId = byEmail["mkt.mgr@growthpad.africa"];
  const interId  = byEmail["interviewer@growthpad.africa"];

  if (engMgrId && interId && candByName["Wanjiku Njoroge"] && candByName["Kevin Mwangi"]) {
    await supabase.from("candidate_notes").insert([
      { candidate_id: candByName["Wanjiku Njoroge"], user_id: engMgrId, note: "Excellent technical call. Strong Next.js architecture discussion. Moving to offer.", created_at: daysAgo(10) },
      { candidate_id: candByName["Kevin Mwangi"],    user_id: interId,  note: "Live coding went well. Confident with TypeScript generics. Schedule final round.", created_at: daysAgo(15) },
    ]);
  }

  if (mktMgrId && candByName["Lydia Wanjiru"]) {
    await supabase.from("candidate_notes").insert([
      { candidate_id: candByName["Lydia Wanjiru"], user_id: mktMgrId, note: "Impressive campaign case study. Negotiating salary band now.", created_at: daysAgo(3) },
    ]);
  }

  if (engMgrId && interId && candByName["Kevin Mwangi"] && candByName["Wanjiku Njoroge"]) {
    await supabase.from("interview_scorecards").insert([
      {
        candidate_id: candByName["Kevin Mwangi"], interviewer_id: interId,
        questions: [
          { question: "Design a URL shortener system", answer: "Described Redis caching, hash generation, analytics layer", score: 4 },
          { question: "Explain Next.js ISR vs SSR", answer: "Accurate explanation with real-world tradeoffs", score: 5 },
          { question: "How do you handle database migrations?", answer: "Mentioned versioned migrations, rollback strategies", score: 4 },
        ],
        overall_score: 4.3, recommendation: "hire",
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
        overall_score: 4.7, recommendation: "hire",
        ai_summary: "Top candidate. Exceptional technical depth and communication. Strong fit for senior role. Recommend fast-tracking offer.",
        submitted_at: daysAgo(9),
      },
    ]);
  }

  console.log("\n✅  Candidates seeded successfully!\n");
  console.log(`   ${candidates!.length} candidates across 5 roles, all with CV text`);
}

run().catch((e) => { console.error(e); process.exit(1); });
