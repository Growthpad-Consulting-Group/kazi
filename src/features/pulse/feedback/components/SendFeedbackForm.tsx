"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import Select from "react-select";
import { Button } from "@/components/ui/Button";
import {
  getSelectStyles,
  type SelectOption,
} from "@/components/ui/export/selectStyles";
import { useTheme } from "@/shared/contexts/ThemeContext";

const KUDOS_EMOJIS = ["🔥", "💪", "⭐", "🙌", "💡", "🚀", "❤️", "👏"];

interface GiphyGif {
  id: string;
  images: { fixed_height_small: { url: string }; original: { url: string } };
}

interface Props {
  fromUserId: string;
  users: { id: string; name: string }[];
  values: { id: string; name: string; color: string }[];
  campaigns: { id: string; name: string }[];
  groups?: { id: string; name: string; member_ids: string[] }[];
  onSent?: () => void;
}

export function SendFeedbackForm({
  fromUserId,
  users,
  values,
  campaigns,
  groups = [],
  onSent,
}: Props) {
  const router = useRouter();
  const { resolvedMode } = useTheme();
  const [recipientIds, setRecipientIds] = useState<string[]>(
    users[0] ? [users[0].id] : [],
  );
  const [recipientMode, setRecipientMode] = useState<"individual" | "group">(
    "individual",
  );
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [message, setMessage] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [emoji, setEmoji] = useState("⭐");
  const [valueId, setValueId] = useState(values[0]?.id ?? "");
  const [campaignId, setCampaignId] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [giphyQuery, setGiphyQuery] = useState("");
  const [giphyResults, setGiphyResults] = useState<GiphyGif[]>([]);
  const [giphyLoading, setGiphyLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const userOptions: SelectOption[] = users.map((user) => ({
    value: user.id,
    label: user.name,
  }));
  const groupOptions: SelectOption[] = groups.map((group) => ({
    value: group.id,
    label: `${group.name} (${group.member_ids.length} members)`,
  }));

  function handleGroupSelect(groupId: string) {
    setSelectedGroupId(groupId);
    const group = groups.find((g) => g.id === groupId);
    if (group) setRecipientIds(group.member_ids);
  }

  function handleRecipientModeChange(mode: "individual" | "group") {
    setRecipientMode(mode);
    if (mode === "individual") {
      setSelectedGroupId("");
      setRecipientIds(users[0] ? [users[0].id] : []);
    } else {
      setSelectedGroupId("");
      setRecipientIds([]);
    }
  }

  async function searchGiphy() {
    if (!giphyQuery.trim()) return;
    setGiphyLoading(true);
    try {
      const res = await fetch(
        `/api/pulse/giphy/search?q=${encodeURIComponent(giphyQuery.trim())}`,
      );
      const data = (await res.json()) as { data?: GiphyGif[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "GIF search failed.");
      setGiphyResults(data.data ?? []);
    } catch (reason) {
      setGiphyResults([]);
      setError(reason instanceof Error ? reason.message : "GIF search failed.");
    } finally {
      setGiphyLoading(false);
    }
  }

  async function submit() {
    if (!message.trim() || !recipientIds.length) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/pulse/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_user_id: fromUserId,
          to_user_ids: recipientIds,
          message,
          visibility,
          emoji: visibility === "public" ? emoji : null,
          value_id: visibility === "public" ? valueId || null : null,
          campaign_id: visibility === "public" ? campaignId || null : null,
          media_url: visibility === "public" ? mediaUrl || null : null,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(data?.error ?? "Could not send feedback.");
      setSent(true);
      setMessage("");
      setMediaUrl("");
      setGiphyResults([]);
      setGiphyQuery("");
      router.refresh();
      onSent?.();
      window.setTimeout(() => setSent(false), 3000);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not send feedback.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-[var(--text-hi)]">
            How should this be shared?
          </p>
          <span className="text-[10px] font-medium text-[var(--text-lo)]">
            Choose visibility
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["public", "private"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setVisibility(value);
                if (value === "private" && recipientIds.length > 1)
                  setRecipientIds(recipientIds.slice(0, 1));
                if (value === "private") {
                  setRecipientMode("individual");
                  setSelectedGroupId("");
                }
              }}
              className={`rounded-xl border p-3.5 text-left transition-all duration-200 ${
                visibility === value
                  ? value === "public"
                    ? "border-brand-500/35 bg-brand-500/[0.07] shadow-sm shadow-brand-500/10"
                    : "border-blue-500/30 bg-blue-500/[0.07] shadow-sm shadow-blue-500/10"
                  : "border-[var(--border)] bg-[var(--surface-2)] hover:-translate-y-0.5 hover:bg-[var(--surface)] hover:shadow-sm"
              }`}
            >
              <Icon
                icon={
                  value === "public"
                    ? "solar:star-fall-broken"
                    : "solar:lock-keyhole-minimalistic-broken"
                }
                className={`h-4 w-4 ${visibility === value ? (value === "public" ? "text-brand-500" : "text-blue-600") : "text-[var(--text-lo)]"}`}
              />
              <span className="mt-2 block text-sm font-semibold text-[var(--text-hi)]">
                {value === "public" ? "Shout-out" : "Private note"}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-[var(--text-lo)]">
                {value === "public"
                  ? "Celebrate work with the team."
                  : "Share feedback just with them."}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface)] text-brand-500 shadow-sm">
              <Icon
                icon="solar:users-group-rounded-broken"
                className="h-4 w-4"
              />
            </span>
            <label className="text-xs font-semibold text-[var(--text-hi)]">
              Who is this for?
            </label>
          </div>
          {visibility === "public" && recipientMode === "individual" && (
            <span className="text-[10px] text-[var(--text-lo)]">
              One or more staff
            </span>
          )}
        </div>
        {visibility === "public" && groups.length > 0 && (
          <div className="mb-3 flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
            {(["individual", "group"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleRecipientModeChange(mode)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  recipientMode === mode
                    ? "bg-[var(--surface)] text-[var(--text-hi)] shadow-sm"
                    : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
                }`}
              >
                {mode === "individual" ? "Individual" : "Staff group"}
              </button>
            ))}
          </div>
        )}

        {recipientMode === "group" ? (
          <Select<SelectOption, false>
            value={
              groupOptions.find((option) => option.value === selectedGroupId) ??
              null
            }
            onChange={(option) =>
              handleGroupSelect(String(option?.value ?? ""))
            }
            options={groupOptions}
            placeholder="Choose a staff group"
            isClearable
            classNamePrefix="react-select"
            styles={getSelectStyles<SelectOption>(resolvedMode)}
            menuPortalTarget={
              typeof document !== "undefined" ? document.body : undefined
            }
            menuPosition="fixed"
            aria-label="Choose a staff group"
          />
        ) : (
          <>
            {visibility === "public" ? (
              <Select<SelectOption, true>
                isMulti
                value={userOptions.filter((option) =>
                  recipientIds.includes(String(option.value)),
                )}
                onChange={(selected) =>
                  setRecipientIds(
                    selected.map((option) => String(option.value)),
                  )
                }
                options={userOptions}
                placeholder="Choose staff"
                isClearable
                isSearchable
                classNamePrefix="react-select"
                styles={getSelectStyles<SelectOption, true>(resolvedMode)}
                menuPortalTarget={
                  typeof document !== "undefined" ? document.body : undefined
                }
                menuPosition="fixed"
                aria-label="Choose staff"
              />
            ) : (
              <Select<SelectOption, false>
                value={
                  userOptions.find(
                    (option) => option.value === recipientIds[0],
                  ) ?? null
                }
                onChange={(selected) =>
                  setRecipientIds(selected ? [String(selected.value)] : [])
                }
                options={userOptions}
                placeholder="Choose a staff member"
                isClearable
                isSearchable
                classNamePrefix="react-select"
                styles={getSelectStyles<SelectOption>(resolvedMode)}
                menuPortalTarget={
                  typeof document !== "undefined" ? document.body : undefined
                }
                menuPosition="fixed"
                aria-label="Choose a staff member"
              />
            )}
          </>
        )}

        {visibility === "public" && recipientMode === "individual" && (
          <p className="mt-1.5 text-[10px] text-[var(--text-lo)]">
            {recipientIds.length
              ? `${recipientIds.length} staff member${recipientIds.length === 1 ? "" : "s"} selected`
              : "Choose who to celebrate"}
          </p>
        )}
        {recipientMode === "group" && selectedGroupId && (
          <p className="mt-1.5 text-[10px] text-[var(--text-lo)]">
            {recipientIds.length} member{recipientIds.length !== 1 ? "s" : ""}{" "}
            will receive this shout-out
          </p>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold text-[var(--text-hi)]">
            {visibility === "public"
              ? "What made the impact?"
              : "Your feedback"}
          </label>
          <span className="text-[10px] text-[var(--text-lo)]">
            {message.length}/1200
          </span>
        </div>
        <textarea
          rows={5}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={1200}
          placeholder={
            visibility === "public"
              ? "Describe what they did and why it mattered…"
              : "Share constructive, specific feedback…"
          }
          className="w-full resize-y rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-3 text-sm leading-relaxed text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)] focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10"
        />
      </section>

      {visibility === "public" && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface)] text-brand-500 shadow-sm">
              <Icon icon="solar:star-fall-broken" className="h-4 w-4" />
            </span>
            <p className="text-xs font-semibold text-[var(--text-hi)]">
              Recognition details
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-[var(--text-hi)]">
                Value demonstrated
              </p>
              {values.length ? (
                <select
                  value={valueId}
                  onChange={(event) => setValueId(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60"
                >
                  <option value="">Choose a value</option>
                  {values.map((value) => (
                    <option key={value.id} value={value.id}>
                      {value.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="rounded-xl bg-[var(--surface-2)] px-3 py-2.5 text-xs text-[var(--text-lo)]">
                  Your HR team has not configured recognition values yet.
                </p>
              )}
            </div>

            {campaigns.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-[var(--text-hi)]">
                  Campaign{" "}
                  <span className="font-normal text-[var(--text-lo)]">
                    Optional
                  </span>
                </p>
                <select
                  value={campaignId}
                  onChange={(event) => setCampaignId(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60"
                >
                  <option value="">Not linked to a campaign</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="mt-3 border-t border-[var(--border)] pt-3">
            <p className="mb-1.5 text-xs font-semibold text-[var(--text-hi)]">
              Pick a moment
            </p>
            <div className="flex flex-wrap gap-1.5">
              {KUDOS_EMOJIS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setEmoji(item)}
                  aria-label={`Use ${item}`}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-base transition-colors ${
                    emoji === item
                      ? "bg-brand-500/15 ring-1 ring-brand-500/35"
                      : "bg-[var(--surface-2)] hover:bg-brand-500/10"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <details className="mt-4 border-t border-[var(--border)] pt-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-[var(--text-hi)] marker:hidden">
              <Icon
                icon="solar:gallery-broken"
                className="h-4 w-4 text-brand-500"
              />
              Add an image or GIF{" "}
              <span className="font-normal text-[var(--text-lo)]">
                Optional
              </span>
              <Icon
                icon="solar:alt-arrow-down-broken"
                className="ml-auto h-3.5 w-3.5 text-[var(--text-lo)]"
              />
            </summary>
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
                  Image / GIF URL
                </label>
                <input
                  type="url"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://media.giphy.com/…"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--text-hi)] placeholder:text-[var(--text-lo)] outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10"
                />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-[var(--text-hi)]">
                  Search GIFs
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={giphyQuery}
                    onChange={(e) => setGiphyQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchGiphy()}
                    placeholder="Search Giphy…"
                    className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-sm text-[var(--text-hi)] placeholder:text-[var(--text-lo)] outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="solar:magnifer-broken"
                    loading={giphyLoading}
                    disabled={giphyLoading || !giphyQuery.trim()}
                    onClick={searchGiphy}
                  >
                    Search
                  </Button>
                </div>
                {giphyResults.length > 0 && (
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {giphyResults.map((gif) => (
                      <button
                        key={gif.id}
                        type="button"
                        onClick={() => setMediaUrl(gif.images.original.url)}
                        className={`overflow-hidden rounded-lg border-2 transition-all ${mediaUrl === gif.images.original.url ? "border-brand-500 ring-2 ring-brand-500/30" : "border-transparent hover:border-brand-500/40"}`}
                        title="Use this GIF"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={gif.images.fixed_height_small.url}
                          alt=""
                          className="h-16 w-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {mediaUrl && (
                <div className="relative overflow-hidden rounded-xl border border-[var(--border)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mediaUrl}
                    alt="Preview"
                    className="max-h-40 w-full object-cover"
                    loading="lazy"
                  />
                  <button
                    type="button"
                    onClick={() => setMediaUrl("")}
                    className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                    title="Remove image"
                  >
                    <Icon
                      icon="solar:close-circle-broken"
                      className="h-4 w-4"
                    />
                  </button>
                </div>
              )}
            </div>
          </details>
        </section>
      )}

      {error && (
        <p className="mt-3 text-xs font-medium text-red-500">{error}</p>
      )}
      {sent && (
        <p className="mt-3 text-xs font-medium text-emerald-600">
          Feedback sent.
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <Button
          icon={
            visibility === "public"
              ? "solar:star-fall-broken"
              : "solar:letter-broken"
          }
          loading={saving}
          disabled={
            saving ||
            !message.trim() ||
            !recipientIds.length ||
            (visibility === "public" && values.length > 0 && !valueId)
          }
          onClick={submit}
        >
          {saving
            ? "Sending"
            : visibility === "public"
              ? "Share shout-out"
              : "Send privately"}
        </Button>
      </div>
    </div>
  );
}
