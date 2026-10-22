"use client";

import { useState, useTransition } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import SettingsSection from "./SettingsSection";
import { Button } from "@/components/ui/Button";
import { saveAISettings } from "../actions";

interface Props {
  initial: {
    provider: string;
    model: string;
    apiKeySet: boolean;
  };
}

const PROVIDERS = [
  { id: "groq", label: "Groq", description: "Fast inference via Groq Cloud — used for summaries and suggestions.", icon: "logos:groq" },
  { id: "openai", label: "OpenAI", description: "GPT-4o and other OpenAI models via the official API.", icon: "simple-icons:openai" },
  { id: "anthropic", label: "Anthropic (Claude)", description: "Claude models for nuanced, long-context tasks.", icon: "simple-icons:anthropic" },
  { id: "google", label: "Google Gemini", description: "Gemini models via Google AI Studio or Vertex AI.", icon: "logos:google-gemini" },
];

const DEFAULT_MODELS: Record<string, string> = {
  groq: "llama3-70b-8192",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-5",
  google: "gemini-1.5-flash",
};

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-hi)] placeholder:text-[var(--text-lo)] transition-all focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

export default function AISettingsClient({ initial }: Props) {
  const [provider, setProvider] = useState(initial.provider);
  const [model, setModel] = useState(initial.model);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isPending, startTransition] = useTransition();

  function pickProvider(id: string) {
    setProvider(id);
    setModel(DEFAULT_MODELS[id] ?? "");
  }

  function save() {
    startTransition(async () => {
      try {
        await saveAISettings({ provider, model, apiKey: apiKey || undefined });
        toast.success("AI settings saved");
        setApiKey("");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save settings");
      }
    });
  }

  const dirty = provider !== initial.provider || model !== initial.model || apiKey.length > 0;

  return (
    <div className="space-y-5">
      <SettingsSection
        title="AI Provider"
        description="Choose the AI backend Kazi uses for summaries, suggestions, and smart features"
        icon="solar:cpu-bolt-broken"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pickProvider(p.id)}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                provider === p.id
                  ? "border-brand-500 bg-brand-500/5 shadow-sm shadow-brand-500/10"
                  : "border-[var(--border)] bg-[var(--surface-2)] hover:border-brand-500/40"
              }`}
            >
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${provider === p.id ? "bg-brand-500/10 text-brand-500" : "bg-[var(--surface)] text-[var(--text-lo)]"}`}>
                <Icon icon={p.icon} className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[var(--text-hi)]">{p.label}</p>
                  {provider === p.id && <Icon icon="solar:check-circle-broken" className="h-4 w-4 text-brand-500" />}
                </div>
                <p className="mt-0.5 text-xs text-[var(--text-lo)]">{p.description}</p>
              </div>
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Model & credentials"
        description="Configure the model and API key for the selected provider"
        icon="solar:key-broken"
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Model ID</span>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={DEFAULT_MODELS[provider] ?? "e.g. gpt-4o"}
              className={inputCls}
            />
            <p className="mt-1.5 text-xs text-[var(--text-lo)]">
              Use the exact model ID from your provider's documentation.
            </p>
          </label>

          <label className="block">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-hi)]">API Key</span>
              {initial.apiKeySet && (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <Icon icon="solar:check-circle-broken" className="h-3.5 w-3.5" />
                  Key is set — enter a new one to replace it
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={initial.apiKeySet ? "••••••••••••••••" : "sk-…"}
                autoComplete="off"
                className={`${inputCls} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-lo)] hover:text-[var(--text-hi)]"
              >
                <Icon icon={showKey ? "solar:eye-closed-broken" : "solar:eye-broken"} className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-xs text-[var(--text-lo)]">
              Stored encrypted. Never logged or sent to the browser.
            </p>
          </label>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Where AI is used in Kazi"
        description="Current AI-powered features"
        icon="solar:magic-stick-3-broken"
      >
        <div className="space-y-2.5">
          {[
            { icon: "solar:diploma-broken", label: "Review summaries", desc: "Summarises submitted peer reviews into a manager digest" },
            { icon: "solar:target-broken", label: "Goal suggestions", desc: "Suggests SMART goal language based on role and department" },
            { icon: "solar:calendar-mark-broken", label: "Check-in prompts", desc: "Generates personalised check-in questions each cycle" },
            { icon: "solar:chart-broken", label: "Pulse insights", desc: "Surfaces patterns in engagement survey responses" },
          ].map((f) => (
            <div key={f.label} className="flex items-start gap-3 rounded-xl bg-[var(--surface-2)] px-3.5 py-3">
              <Icon icon={f.icon} className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              <div>
                <p className="text-sm font-medium text-[var(--text-hi)]">{f.label}</p>
                <p className="text-xs text-[var(--text-lo)]">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>

      <div className="flex justify-end">
        <Button icon="solar:diskette-broken" loading={isPending} disabled={!dirty} onClick={save}>
          {isPending ? "Saving…" : "Save AI settings"}
        </Button>
      </div>
    </div>
  );
}
