"use client";

import { useEffect, useState, useTransition } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { SimpleModal } from "@/components/ui/SimpleModal";
import { Button } from "@/components/ui/Button";
import SettingsSection from "./SettingsSection";

interface AsanaConnection {
  connected: boolean;
  workspace?: string;
  connectedAt?: string;
}

interface SlackStatus {
  connected: boolean;
  channelName: string | null;
}

interface GoogleCalendarStatus {
  connected: boolean;
  calendarId: string | null;
  calendarName: string | null;
}

interface Props {
  asana: AsanaConnection;
  googleWorkspaceConnected: boolean;
  slackStatus: SlackStatus;
  googleCalendarStatus: GoogleCalendarStatus;
  /** Slack posts to a company-wide channel, so only admins can connect or disconnect it. */
  canManageOrg: boolean;
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
        {meta && (
          <p className="mt-1.5 text-xs font-semibold text-[var(--text-hi)]">
            {meta}
          </p>
        )}
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
            className="rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            {pending ? "…" : "Connect"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function IntegrationsClient({ asana, googleWorkspaceConnected, slackStatus, googleCalendarStatus, canManageOrg }: Props) {
  const [asanaConnected, setAsanaConnected] = useState(asana.connected);

  // Slack state
  const [slackConnected, setSlackConnected] = useState(slackStatus.connected);
  const [slackChannel, setSlackChannel] = useState(slackStatus.channelName ?? "");
  const [showSlackModal, setShowSlackModal] = useState(false);
  const [slackWebhookInput, setSlackWebhookInput] = useState("");
  const [slackChannelInput, setSlackChannelInput] = useState("");
  const [slackPending, startSlackTransition] = useTransition();

  // Google Calendar state
  const [googleCalendar, setGoogleCalendar] = useState(googleCalendarStatus);

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

    const gcalParam = params.get("google_calendar");
    if (gcalParam === "connected") {
      setGoogleCalendar((prev) => ({ ...prev, connected: true }));
      toast.success("Google Calendar connected successfully");
    } else if (gcalParam === "error") {
      toast.error("Google Calendar connection failed. Check that OAuth credentials are configured.");
    }
    if (gcalParam) {
      const url = new URL(window.location.href);
      url.searchParams.delete("google_calendar");
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

  function connectGoogleCalendar() {
    window.location.href = "/api/integrations/google-calendar/connect";
  }

  async function disconnectGoogleCalendar() {
    const res = await fetch("/api/integrations/google-calendar/disconnect", { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      throw new Error(body.error ?? "Could not disconnect");
    }
    setGoogleCalendar({ connected: false, calendarId: null, calendarName: null });
    toast.success("Google Calendar disconnected");
  }

  function openSlackModal() {
    setSlackWebhookInput("");
    setSlackChannelInput("");
    setShowSlackModal(true);
  }

  function connectSlack() {
    if (!slackWebhookInput.startsWith("https://hooks.slack.com/")) {
      toast.error("Webhook URL must start with https://hooks.slack.com/");
      return;
    }
    if (!slackChannelInput.trim()) {
      toast.error("Channel name is required");
      return;
    }
    startSlackTransition(async () => {
      try {
        const res = await fetch("/api/integrations/slack/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            webhook_url: slackWebhookInput.trim(),
            channel_name: slackChannelInput.trim(),
          }),
        });
        const data = await res.json() as { ok?: boolean; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Could not connect Slack");
        setSlackConnected(true);
        setSlackChannel(slackChannelInput.trim());
        setShowSlackModal(false);
        toast.success("Slack connected successfully");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to connect Slack");
      }
    });
  }

  async function disconnectSlack() {
    const res = await fetch("/api/integrations/slack/disconnect", { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      throw new Error(body.error ?? "Could not disconnect Slack");
    }
    setSlackConnected(false);
    setSlackChannel("");
    toast.success("Slack disconnected");
  }

  return (
    <div className="space-y-5">
      <SettingsSection
        title="Messaging"
        description="Connect messaging tools for automated notifications"
        icon="logos:slack-icon"
      >
        <div className="space-y-3">
          <IntegrationCard
            icon="logos:slack-icon"
            name="Slack"
            description="Send Kazi notifications — milestones, recognitions, and reminders — to a Slack channel via incoming webhook."
            status={slackConnected ? "connected" : "disconnected"}
            meta={
              slackConnected && slackChannel
                ? `Slack channel: #${slackChannel}`
                : canManageOrg ? undefined : "Set up by an administrator"
            }
            onConnect={canManageOrg ? openSlackModal : undefined}
            onDisconnect={canManageOrg ? disconnectSlack : undefined}
          />
        </div>
      </SettingsSection>

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
        title="Productivity"
        description="Connect calendar and productivity tools"
        icon="solar:calendar-broken"
      >
        <div className="space-y-3">
          <IntegrationCard
            icon="logos:google-calendar"
            name="Google Calendar"
            description="Sync 1-on-1 meetings to your Google Calendar. Events are created automatically when meetings are scheduled."
            status={googleCalendar.connected ? "connected" : "disconnected"}
            meta={googleCalendar.connected ? `Calendar: ${googleCalendar.calendarName ?? googleCalendar.calendarId ?? "primary"}` : undefined}
            onConnect={connectGoogleCalendar}
            onDisconnect={disconnectGoogleCalendar}
          />
        </div>
      </SettingsSection>

      {/* ── Slack connect modal ──────────────────────────────────────────────── */}
      <SimpleModal
        open={showSlackModal}
        onClose={() => setShowSlackModal(false)}
        title="Connect Slack"
        icon="logos:slack-icon"
      >
        <div className="space-y-4">
          <p className="text-xs text-[var(--text-lo)]">
            Create an incoming webhook in your Slack workspace and paste the URL below. Kazi will use it to post milestone and recognition notifications.
          </p>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[var(--text-hi)]">
              Webhook URL
            </label>
            <input
              type="url"
              placeholder="https://hooks.slack.com/services/..."
              value={slackWebhookInput}
              onChange={(e) => setSlackWebhookInput(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)] focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[var(--text-hi)]">
              Channel name
            </label>
            <input
              type="text"
              placeholder="general"
              value={slackChannelInput}
              onChange={(e) => setSlackChannelInput(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)] focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
            <p className="text-xs text-[var(--text-lo)]">The channel where notifications will be posted (without #).</p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => setShowSlackModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={slackPending}
              onClick={connectSlack}
            >
              Connect
            </Button>
          </div>
        </div>
      </SimpleModal>
    </div>
  );
}
