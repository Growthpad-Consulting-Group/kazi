"use client";

import { useEffect, useState, useTransition } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import SettingsSection from "./SettingsSection";

interface AsanaConnection {
  connected: boolean;
  workspace?: string;
  connectedAt?: string;
}

interface Props {
  asana: AsanaConnection;
  googleWorkspaceConnected: boolean;
}

function IntegrationCard({
  icon,
  name,
  description,
  status,
  onConnect,
  onDisconnect,
  meta,
}: {
  icon: string;
  name: string;
  description: string;
  status: "connected" | "disconnected" | "system";
  onConnect?: () => void;
  onDisconnect?: () => void;
  meta?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] border border-[var(--border)]">
        <Icon icon={icon} className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-sm text-[var(--text-hi)]">{name}</p>
          {status === "connected" && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">Connected</span>
          )}
          {status === "system" && (
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-600">System managed</span>
          )}
          {status === "disconnected" && (
            <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-xs font-semibold text-[var(--text-lo)]">Not connected</span>
          )}
        </div>
        <p className="mt-1 text-xs text-[var(--text-lo)]">{description}</p>
        {meta && <p className="mt-1 text-xs text-[var(--text-lo)]">{meta}</p>}
      </div>
      <div className="shrink-0">
        {status === "connected" && onDisconnect && (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(async () => { try { await onDisconnect(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } })}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/5 disabled:opacity-50"
          >
            {pending ? "…" : "Disconnect"}
          </button>
        )}
        {status === "disconnected" && onConnect && (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(async () => { try { await onConnect(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } })}
            className="rounded-xl bg-[#f05d23] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#d94f1c] disabled:opacity-50"
          >
            {pending ? "…" : "Connect"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function IntegrationsClient({ asana, googleWorkspaceConnected }: Props) {
  const [asanaConnected, setAsanaConnected] = useState(asana.connected);

  // Handle OAuth return — read param directly from window.location (avoids Suspense requirement)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const asanaParam = params.get("asana");
    if (asanaParam === "connected") {
      setAsanaConnected(true);
      toast.success("Asana connected successfully");
    } else if (asanaParam === "error") {
      toast.error("Asana connection failed. Check that Asana OAuth credentials are configured.");
    }
    if (asanaParam) {
      const url = new URL(window.location.href);
      url.searchParams.delete("asana");
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  function connectAsana() {
    // Return here after OAuth so user doesn't land in check-ins
    window.location.href = "/api/integrations/asana/connect?returnTo=/settings/integrations";
  }

  async function disconnectAsana() {
    const res = await fetch("/api/integrations/asana/disconnect", { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      throw new Error(body.error ?? "Could not disconnect");
    }
    setAsanaConnected(false);
    toast.success("Asana disconnected");
  }

  return (
    <div className="space-y-5">
      <SettingsSection
        title="Project management"
        description="Connect task and project tools to Kazi workflows"
        icon="solar:widget-2-broken"
      >
        <div className="space-y-3">
          <IntegrationCard
            icon="logos:asana"
            name="Asana"
            description="Sync Kazi goals and check-ins with your Asana workspace. Tasks are created automatically when goals are set."
            status={asanaConnected ? "connected" : "disconnected"}
            meta={asana.workspace ? `Workspace: ${asana.workspace}` : undefined}
            onConnect={connectAsana}
            onDisconnect={disconnectAsana}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Google Workspace"
        description="Gmail and Google services used by Kazi Signatures"
        icon="logos:google-gmail"
      >
        <div className="space-y-3">
          <IntegrationCard
            icon="logos:google-gmail"
            name="Gmail (service account)"
            description="Kazi Signatures uses a Google Workspace service account to deploy email signatures to managed mailboxes. Configured at the infrastructure level."
            status={googleWorkspaceConnected ? "system" : "disconnected"}
            meta={googleWorkspaceConnected ? "Service account active — managed via Kazi infrastructure settings" : undefined}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Coming soon"
        description="More integrations are on the roadmap"
        icon="solar:hourglass-broken"
        iconBg="bg-slate-500/10 text-slate-500"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { icon: "logos:google-calendar", name: "Google Calendar", desc: "Sync 1-on-1 meetings to calendar" },
            { icon: "logos:slack-icon", name: "Slack", desc: "Send Kazi notifications to Slack channels" },
            { icon: "arcticons:bamboohr", name: "BambooHR", desc: "Sync employee data and org structure" },
            { icon: "thesvg-color:workday", name: "Workday", desc: "Bi-directional HR data integration" },
          ].map((item) => (
            <div key={item.name} className="flex items-start gap-3 rounded-xl border border-dashed border-[var(--border)] p-3 opacity-60">
              <Icon icon={item.icon} className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-[var(--text-hi)]">{item.name}</p>
                <p className="text-xs text-[var(--text-lo)]">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}
