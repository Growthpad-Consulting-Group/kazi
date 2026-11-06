export type CampaignTemplate = {
  key: string;
  name: string;
  description: string;
  goal: string;
  pointRule: string;
  slackCopy: string;
};

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    key: "client-wins",
    name: "Client wins",
    description: "Make exceptional client outcomes visible.",
    goal: "Celebrate work that creates a clear WOW moment for a client.",
    pointRule: "No automatic points",
    slackCopy: "Share a client win and the impact it created.",
  },
  {
    key: "project-launches",
    name: "Project launches",
    description: "Recognise the team effort behind a launch.",
    goal: "Celebrate thoughtful delivery, collaboration and learning around a project launch.",
    pointRule: "No automatic points",
    slackCopy: "Recognise a teammate who helped bring this launch to life.",
  },
  {
    key: "values-spotlight",
    name: "Values spotlight",
    description: "Turn company values into specific appreciation.",
    goal: "Recognise everyday actions that demonstrate our values.",
    pointRule: "No automatic points",
    slackCopy: "Which value did your teammate bring to life?",
  },
  {
    key: "onboarding-welcome",
    name: "Onboarding welcome",
    description: "Help new colleagues feel seen and supported.",
    goal: "Welcome new teammates and recognise people who helped them settle in.",
    pointRule: "No automatic points",
    slackCopy:
      "Welcome a new teammate or thank someone who made their first weeks easier.",
  },
  {
    key: "monthly-peer-appreciation",
    name: "Monthly peer appreciation",
    description: "Create a simple monthly rhythm of thanks.",
    goal: "Share specific appreciation for the people who made a difference this month.",
    pointRule: "No automatic points",
    slackCopy:
      "Take a moment to recognise someone who made a difference this month.",
  },
];
