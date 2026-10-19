import Groq from "groq-sdk";

export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Default model — fast and capable for structured tasks
export const GROQ_MODEL = "llama-3.3-70b-versatile";
