import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const apply = process.argv.includes("--apply");

const salesRequirements = [
  "2+ years proven experience in telesales, inside sales, or call center sales",
  "Excellent spoken and written English — neutral accent, articulate, persuasive",
  "Demonstrated ability to consistently meet or exceed sales quotas",
  "Familiarity with CRM tools (HubSpot, Salesforce, Zoho, etc.)",
  "Strong active listening, objection handling, and negotiation skills",
  "High energy, resilient under pressure, and goal-oriented mindset",
];

const danishRequirements = [
  "Fluent in Danish — spoken and written (C1 or native level)",
  "Strong English communication skills",
  "Previous experience in customer service, BPO, or contact center environments is an advantage",
  "Proficient in using CRM and ticketing tools",
  "Ability to work in shifts, including weekends if required",
  "Patient, empathetic, and solution-oriented attitude",
];

const jobs = [
  {
    slug: "sales-executive-telesales-omnichannel-growth",
    title: "Sales Executive – Telesales & Omnichannel Growth",
    department: "Sales",
    location: "Nairobi, Kenya",
    employment_type: "Full-time",
    work_mode: "Hybrid",
    description:
      "We are seeking experienced, highly fluent English-speaking Sales Executives with a strong passion for telesales and omnichannel outreach. This role is ideal for self-motivated closers who enjoy engaging prospects, overcoming objections, and converting warm and cold leads into paying customers across phone, email, WhatsApp, and LinkedIn.\n\nYou will be at the frontline of revenue generation, representing both CCSA and our clients, with clear performance metrics, structured playbooks, and strong leadership support.",
    requirements: { must_haves: salesRequirements, nice_to_haves: [] },
    scoring_rubric: [
      { criterion: "Telesales experience", weight: 30, description: "Evidence of sustained telesales, inside-sales or contact-centre sales experience." },
      { criterion: "Sales results", weight: 25, description: "Clear quota attainment, conversion, revenue or pipeline outcomes." },
      { criterion: "Communication", weight: 20, description: "Persuasive spoken and written English, with client-ready communication." },
      { criterion: "CRM and outreach", weight: 15, description: "Experience with CRM hygiene and multi-channel prospecting." },
      { criterion: "Resilience and fit", weight: 10, description: "Motivation, coachability and comfort in a target-driven team." },
    ],
    status: "open",
    published_at: new Date().toISOString(),
    closes_at: "2026-11-30T23:59:59.999Z",
    benefits:
      "Competitive base salary + uncapped commissions\nPerformance bonuses and incentive trips\nStructured onboarding, sales training, and coaching\nClear career path: Senior Sales Executive → Team Lead → Sales Manager\nDynamic, high-energy work culture with a winning mindset\nExposure to international clients across Europe, the UK, and Africa",
    application_instructions: "Apply online with your CV and LinkedIn profile.",
    selection_process: "Applications are reviewed on a rolling basis. Shortlisted candidates will be invited to interviews and role-relevant assessments.",
    public_details: {
      summary: "We are seeking experienced, highly fluent English-speaking Sales Executives with a strong passion for telesales and omnichannel outreach.",
      openings: 10,
      languages: ["English"],
      hiring_timeline: "Rolling basis",
      tags: ["telesales", "sales", "omnichannel", "CRM"],
      about_company: [
        "Call Center Solutions Africa (CCSA) is a fast-growing outsourced sales and customer engagement company serving businesses across Africa, Europe, and global markets. We specialize in high-performance telesales, lead conversion, and omnichannel outreach that directly drives revenue for our clients.",
        "We are building a world-class sales engine and are looking for driven sales professionals who thrive on targets, conversations, and closing deals.",
      ],
      role_overview: [
        "We are seeking experienced, highly fluent English-speaking Sales Executives with a strong passion for telesales and omnichannel outreach. This role is ideal for self-motivated closers who enjoy engaging prospects, overcoming objections, and converting warm and cold leads into paying customers across phone, email, WhatsApp, and LinkedIn.",
        "You will be at the frontline of revenue generation, representing both CCSA and our clients, with clear performance metrics, structured playbooks, and strong leadership support.",
      ],
      responsibilities: [
        "Execute high-volume outbound telesales campaigns targeting qualified leads provided via CRM",
        "Engage prospects through omnichannel outreach (calls, email, WhatsApp, LinkedIn)",
        "Conduct needs discovery, qualify prospects, and confidently pitch client solutions",
        "Handle objections and close deals while maintaining high conversion rates",
        "Accurately update CRM systems with call outcomes, notes, and next actions",
        "Meet and exceed daily, weekly, and monthly sales targets",
        "Collaborate with QA, training, and team leads to continuously improve scripts and performance",
        "Maintain exceptional professionalism, tone, and clarity in all customer interactions",
      ],
      ideal_candidate: [
        "Ambitious and self-motivated with a proven track record in sales",
        "Comfortable making 60–100+ calls per day",
        "Resourceful and proactive in getting work done",
        "A team player who lifts others and celebrates wins collectively",
        "Detail-oriented about CRM logging and pipeline hygiene",
      ],
    },
  },
  {
    slug: "customer-service-executive-danish-speaking",
    title: "Customer Service Executive (Danish Speaking)",
    department: "Customer Experience",
    location: "Nairobi, Kenya",
    employment_type: "Full-time",
    work_mode: "Hybrid",
    description:
      "As a Customer Service Executive (Danish-speaking), you will be the primary point of contact for Danish-speaking customers of our international clients. Your role is to deliver timely, professional, and empathetic support across inbound and outbound channels including phone, email, chat, and WhatsApp.\n\nYou must be highly proficient in both Danish and English, with strong communication skills and a service-first attitude.",
    requirements: { must_haves: danishRequirements, nice_to_haves: [] },
    scoring_rubric: [
      { criterion: "Danish proficiency", weight: 35, description: "C1/native Danish written and spoken proficiency." },
      { criterion: "Customer service experience", weight: 25, description: "Relevant customer support, BPO or contact-centre experience." },
      { criterion: "Communication and empathy", weight: 20, description: "Clear English communication and service-first problem solving." },
      { criterion: "CRM and process discipline", weight: 10, description: "Comfort with CRM/ticketing workflows and accurate documentation." },
      { criterion: "Availability and fit", weight: 10, description: "Reliability for shift work and collaborative performance culture." },
    ],
    status: "open",
    published_at: new Date().toISOString(),
    closes_at: "2026-12-05T23:59:59.999Z",
    benefits:
      "Competitive salary reflective of Danish language skills\nPerformance bonuses based on CSAT and quality scores\nPaid training and onboarding for client processes and tools\nClear growth path: Senior Agent → Team Lead → Quality Analyst\nWork in a multilingual, international team environment\nExposure to Nordic market clients and business culture",
    application_instructions: "Apply online with your CV and LinkedIn profile.",
    selection_process: "Applications are reviewed on a rolling basis. Shortlisted candidates will be invited to interviews and role-relevant assessments.",
    public_details: {
      summary: "We are expanding our Nordic-language support capability and are looking for Danish-speaking Customer Service Executives who take pride in delivering clear, professional, and empathetic customer support.",
      languages: ["Danish", "English"],
      hiring_timeline: "Rolling basis",
      tags: ["customer service", "Danish", "Nordic", "multilingual", "CX"],
      about_company: [
        "Call Center Solutions Africa (CCSA) is a fast-growing customer experience and sales outsourcing company supporting clients across Europe, the UK, and global markets. We deliver high-quality, multilingual customer support, telesales, and omnichannel engagement through disciplined processes, trained talent, and strong performance management.",
        "We are expanding our Nordic-language support capability and are looking for Danish-speaking Customer Service Executives who take pride in delivering clear, professional, and empathetic customer support.",
      ],
      role_overview: [
        "As a Customer Service Executive (Danish-speaking), you will be the primary point of contact for Danish-speaking customers of our international clients. Your role is to deliver timely, professional, and empathetic support across inbound and outbound channels including phone, email, chat, and WhatsApp.",
        "You must be highly proficient in both Danish and English, with strong communication skills and a service-first attitude.",
      ],
      responsibilities: [
        "Handle inbound and outbound customer interactions in Danish across phone, email, chat, and WhatsApp",
        "Resolve customer queries, complaints, and requests within defined SLAs",
        "Accurately document all customer interactions in the CRM system",
        "Escalate complex issues to the relevant teams or supervisors when needed",
        "Maintain a positive, empathetic, and professional tone in all customer interactions",
        "Meet or exceed daily KPIs including CSAT, FCR, AHT, and quality scores",
        "Participate in team briefings, coaching sessions, and performance reviews",
      ],
      ideal_candidate: [
        "A natural communicator who finds joy in helping people",
        "Detail-oriented and accurate",
        "Adaptable in complex or emotional customer interactions",
        "Comfortable in a performance-driven environment with clear KPIs",
        "A team player who also takes initiative independently",
      ],
    },
  },
];

const { data: company, error: companyError } = await supabase
  .from("companies")
  .select("id")
  .eq("slug", "ccsa")
  .single();
if (companyError || !company) throw companyError ?? new Error("CCSA company not found.");

const recruiterId = "3cb613df-eafb-4c73-aa9b-bd65586694cf";
const { data: membership, error: membershipError } = await supabase
  .from("company_memberships")
  .select("id")
  .eq("company_id", company.id)
  .eq("user_id", recruiterId)
  .eq("is_active", true)
  .single();
if (membershipError || !membership) {
  throw membershipError ?? new Error("CCSA recruiter membership not found.");
}

const rows = jobs.map((job) => ({
  ...job,
  company_id: company.id,
  created_by: recruiterId,
}));

if (!apply) {
  console.log(JSON.stringify(rows.map(({ slug, title, closes_at }) => ({ slug, title, closes_at })), null, 2));
  console.log("Dry run only. Re-run with --apply to migrate these CCSA jobs.");
  process.exit(0);
}

const { data, error } = await supabase
  .from("jobs")
  .upsert(rows, { onConflict: "slug" })
  .select("id, slug, title, status, company_id, closes_at");
if (error) throw error;

console.log(JSON.stringify(data, null, 2));
