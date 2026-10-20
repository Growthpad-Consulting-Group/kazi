import Groq from "groq-sdk";

export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Default model — production Groq model with JSON mode for structured tasks.
// The former Llama 3.3 model was retired for developer accounts in August 2026.
export const GROQ_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
