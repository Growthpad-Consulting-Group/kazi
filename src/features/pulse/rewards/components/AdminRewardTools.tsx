"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import StatCard from "@/components/ui/StatCard";
import { useFileDrop } from "@/lib/useFileDrop";
import type { RewardCatalogue } from "@/types/database";

type StaffOption = { id: string; name: string };

const inputClass =
  "mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60";
const labelClass = "block text-xs font-semibold text-[var(--text-hi)]";

async function send(url: string, method: string, body: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  if (!response.ok) throw new Error(data?.error ?? "Something went wrong.");
}

export function RewardForm({
  item,
  onDone,
}: {
  item?: RewardCatalogue;
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [pointsCost, setPointsCost] = useState(String(item?.points_cost ?? ""));
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [vendorName, setVendorName] = useState(item?.vendor_name ?? "");
  const [stockQuantity, setStockQuantity] = useState(
    item?.stock_quantity?.toString() ?? "",
  );
  const [redemptionLimit, setRedemptionLimit] = useState(
    item?.redemption_limit_per_user?.toString() ?? "",
  );
  const [fulfilmentInstructions, setFulfilmentInstructions] = useState(
    item?.fulfilment_instructions ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { isDragging, dropProps } = useFileDrop({
    accept: "image/*",
    disabled: uploading,
    onFiles: ([file]) => void uploadImage(file),
  });

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/pulse/rewards/catalogue/image", {
        method: "POST",
        body: form,
      });
      const data = (await response.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;
      if (!response.ok || !data?.url)
        throw new Error(data?.error ?? "Could not upload the image.");
      setImageUrl(data.url);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not upload the image.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        points_cost: Number(pointsCost),
        image_url: imageUrl,
        category,
        vendor_name: vendorName,
        stock_quantity: stockQuantity.trim() ? Number(stockQuantity) : null,
        redemption_limit_per_user: redemptionLimit.trim()
          ? Number(redemptionLimit)
          : null,
        fulfilment_instructions: fulfilmentInstructions,
      };
      if (item)
        await send(`/api/pulse/rewards/catalogue/${item.id}`, "PATCH", payload);
      else await send("/api/pulse/rewards/catalogue", "POST", payload);
      toast.success(item ? "Reward updated" : "Reward added");
      onDone();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the reward.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-[132px_minmax(0,1fr)]">
        <div>
          <p className={labelClass}>
            Reward image{" "}
            <span className="font-normal text-[var(--text-lo)]">Optional</span>
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={`group relative mt-1.5 flex h-32 w-full overflow-hidden rounded-xl border border-dashed bg-[var(--surface-2)] text-left transition-colors hover:border-brand-500/50 hover:bg-brand-500/5 ${isDragging ? "border-brand-500 bg-brand-500/5" : "border-[var(--border)]"}`}
            {...dropProps}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- preview is an uploaded external reward image
              <img
                src={imageUrl}
                alt="Reward preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex w-full flex-col items-center justify-center px-3 text-center text-[var(--text-lo)]">
                <Icon
                  icon="solar:gallery-add-broken"
                  className="h-5 w-5 text-brand-500"
                />
                <span className="mt-2 text-[11px] font-medium">
                  Upload or drop image
                </span>
                <span className="mt-0.5 text-[10px]">Optional</span>
              </span>
            )}
            {imageUrl && (
              <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1.5 text-center text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                Replace image
              </span>
            )}
          </button>
          {imageUrl && (
            <button
              type="button"
              onClick={() => setImageUrl("")}
              className="mt-2 w-full text-center text-[11px] font-medium text-[var(--text-lo)] hover:text-red-500"
            >
              Remove image
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void uploadImage(file);
            }}
          />
          {uploading && (
            <p className="mt-2 text-center text-[11px] text-brand-500">
              Uploading image…
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px]">
            <label className={labelClass}>
              Reward name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                placeholder="e.g. Lunch voucher"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Points cost
              <input
                type="number"
                min={1}
                value={pointsCost}
                onChange={(e) => setPointsCost(e.target.value)}
                placeholder="500"
                className={inputClass}
              />
            </label>
          </div>
          <label className={labelClass}>
            Description{" "}
            <span className="font-normal text-[var(--text-lo)]">Optional</span>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this reward include?"
              className={`${inputClass} resize-y`}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Category
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Experience"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Vendor or partner{" "}
              <span className="font-normal text-[var(--text-lo)]">
                Optional
              </span>
              <input
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="e.g. Carrefour"
                className={inputClass}
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Stock{" "}
              <span className="font-normal text-[var(--text-lo)]">
                Blank = unlimited
              </span>
              <input
                type="number"
                min={0}
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                placeholder="Unlimited"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Per-person limit{" "}
              <span className="font-normal text-[var(--text-lo)]">
                Blank = none
              </span>
              <input
                type="number"
                min={1}
                value={redemptionLimit}
                onChange={(e) => setRedemptionLimit(e.target.value)}
                placeholder="No limit"
                className={inputClass}
              />
            </label>
          </div>
          <label className={labelClass}>
            Fulfilment instructions{" "}
            <span className="font-normal text-[var(--text-lo)]">Optional</span>
            <textarea
              rows={2}
              value={fulfilmentInstructions}
              onChange={(e) => setFulfilmentInstructions(e.target.value)}
              placeholder="How the team should fulfil this reward after approval."
              className={`${inputClass} resize-y`}
            />
          </label>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
        <p className="text-[11px] text-[var(--text-lo)]">
          {item
            ? "Changes apply to future redemptions."
            : "You can hide this reward later without losing its history."}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={onDone}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={saving}
            disabled={!name.trim() || !Number(pointsCost)}
            onClick={save}
          >
            {item ? "Save changes" : "Create reward"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function NewRewardButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        icon="solar:add-circle-broken"
        onClick={() => setOpen(true)}
      >
        Add reward
      </Button>
      <SimpleModal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a reward"
        icon="solar:add-circle-broken"
        maxWidth="max-w-2xl"
      >
        {open && <RewardForm onDone={() => setOpen(false)} />}
      </SimpleModal>
    </>
  );
}

export function CatalogueManager({ items }: { items: RewardCatalogue[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<RewardCatalogue | null>(null);
  const [deleting, setDeleting] = useState<RewardCatalogue | null>(null);
  const [query, setQuery] = useState("");
  const visibleItems = useMemo(
    () =>
      items.filter((item) =>
        `${item.name} ${item.description ?? ""}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    [items, query],
  );
  const activeItems = items.filter((item) => item.is_active);
  const activeCount = activeItems.length;
  const lowestCost = activeItems.length
    ? Math.min(...activeItems.map((item) => item.points_cost))
    : null;

  async function toggle(item: RewardCatalogue) {
    try {
      await send(`/api/pulse/rewards/catalogue/${item.id}`, "PATCH", {
        is_active: !item.is_active,
      });
      toast.success(
        item.is_active ? "Reward hidden from staff" : "Reward shown to staff",
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update the reward.",
      );
    }
  }

  async function remove(item: RewardCatalogue) {
    try {
      await send(
        `/api/pulse/rewards/catalogue/${item.id}`,
        "DELETE",
        undefined,
      );
      toast.success("Reward deleted");
      setDeleting(null);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the reward.",
      );
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          title="Catalogue items"
          value={items.length}
          icon="solar:gift-broken"
          color="orange"
          variant="inline"
          compact
          subtitle="All configured rewards"
        />
        <StatCard
          title="Available now"
          value={activeCount}
          icon="solar:check-circle-broken"
          color="green"
          variant="inline"
          compact
          subtitle="Visible to staff"
        />
        <StatCard
          title="Starting from"
          value={lowestCost === null ? "—" : `${lowestCost} pts`}
          icon="solar:star-broken"
          color="amber"
          variant="inline"
          compact
          subtitle={
            activeCount ? "Lowest available reward" : "Add an available reward"
          }
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
        <div className="p-4 sm:p-5">
          {items.length > 4 && (
            <label className="relative mb-4 block">
              <Icon
                icon="solar:magnifer-broken"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-lo)]"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search rewards"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] py-2.5 pl-9 pr-3 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60"
              />
            </label>
          )}
          {items.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                <Icon icon="solar:gift-broken" className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-[var(--text-hi)]">
                No rewards in the catalogue
              </p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-[var(--text-lo)]">
                Use the Add reward action above to create the first perk staff
                can work towards.
              </p>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="rounded-xl bg-[var(--surface-2)] px-4 py-8 text-center">
              <p className="text-sm font-semibold text-[var(--text-hi)]">
                No rewards match that search
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-2 text-xs font-semibold text-brand-500 hover:text-brand-600"
              >
                Clear search
              </button>
            </div>
          ) : (
            <ul className="space-y-2">
              {visibleItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 transition-shadow hover:shadow-md"
                >
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- reward images are uploaded external URLs
                    <img
                      src={item.image_url}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
                      <Icon icon="solar:gift-broken" className="h-4 w-4" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-semibold ${item.is_active ? "text-[var(--text-hi)]" : "text-[var(--text-lo)]"}`}
                    >
                      {item.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[var(--text-lo)]">
                      {item.description || "No description added"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-xs font-bold text-brand-500">
                      {item.points_cost} pts
                    </p>
                    <button
                      type="button"
                      onClick={() => toggle(item)}
                      className={`mt-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${item.is_active ? "bg-emerald-500/10 text-emerald-600" : "bg-[var(--surface-2)] text-[var(--text-lo)]"}`}
                    >
                      {item.is_active ? "Available" : "Hidden"}
                    </button>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      aria-label={`Edit ${item.name}`}
                      title={`Edit ${item.name}`}
                      className="rounded-lg p-2 text-[var(--text-lo)] transition-colors hover:bg-brand-500/10 hover:text-brand-500"
                    >
                      <Icon icon="solar:pen-broken" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(item)}
                      aria-label={`Delete ${item.name}`}
                      title={`Delete ${item.name}`}
                      className="rounded-lg p-2 text-[var(--text-lo)] transition-colors hover:bg-red-500/10 hover:text-red-500"
                    >
                      <Icon
                        icon="solar:trash-bin-minimalistic-broken"
                        className="h-4 w-4"
                      />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <SimpleModal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.name}` : "Edit reward"}
        icon="solar:pen-broken"
        maxWidth="max-w-2xl"
      >
        {editing && (
          <RewardForm item={editing} onDone={() => setEditing(null)} />
        )}
      </SimpleModal>
      <SimpleModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete reward?"
        icon="solar:danger-triangle-broken"
        maxWidth="max-w-md"
      >
        {deleting && (
          <DeleteRewardConfirm
            item={deleting}
            onCancel={() => setDeleting(null)}
            onHide={async () => {
              await toggle(deleting);
              setDeleting(null);
            }}
            onDelete={() => remove(deleting)}
          />
        )}
      </SimpleModal>
    </div>
  );
}

function DeleteRewardConfirm({
  item,
  onCancel,
  onHide,
  onDelete,
}: {
  item: RewardCatalogue;
  onCancel: () => void;
  onHide: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [action, setAction] = useState<"hide" | "delete" | null>(null);
  const runAction = async (nextAction: "hide" | "delete") => {
    setAction(nextAction);
    try {
      await (nextAction === "hide" ? onHide() : onDelete());
    } finally {
      setAction(null);
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-[var(--text-lo)]">
        Delete{" "}
        <span className="font-semibold text-[var(--text-hi)]">{item.name}</span>
        ? This is permanent.{" "}
        {item.is_active
          ? "You can hide it instead to remove it from the staff catalogue while keeping its redemption history."
          : "It is already hidden from the staff catalogue."}
      </p>
      <div className="flex flex-nowrap items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
        <Button
          size="sm"
          variant="secondary"
          disabled={action !== null}
          onClick={onCancel}
        >
          Cancel
        </Button>
        {item.is_active && (
          <Button
            size="sm"
            variant="secondary"
            loading={action === "hide"}
            disabled={action !== null}
            icon="solar:eye-closed-broken"
            onClick={() => runAction("hide")}
          >
            Hide reward
          </Button>
        )}
        <Button
          size="sm"
          variant="danger"
          loading={action === "delete"}
          disabled={action !== null}
          icon="solar:trash-bin-minimalistic-broken"
          onClick={() => runAction("delete")}
        >
          Delete reward
        </Button>
      </div>
    </div>
  );
}

function GrantPoints({ staff }: { staff: StaffOption[] }) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function grant() {
    setSaving(true);
    try {
      await send("/api/pulse/rewards/grant", "POST", {
        user_id: userId,
        points: Number(points),
        reason,
      });
      toast.success("Points granted");
      setPoints("");
      setReason("");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not grant points.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-lo)]">
        Add points to someone&apos;s balance for a reason that isn&apos;t a
        recognition, such as an off-platform win. The reason is shown in their
        history.
      </p>
      <label className={labelClass}>
        Person
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className={inputClass}
        >
          <option value="">Choose a person</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
        <label className={labelClass}>
          Points
          <input
            type="number"
            min={1}
            max={10000}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Reason
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            placeholder="e.g. Team offsite award"
            className={inputClass}
          />
        </label>
      </div>
      <div className="flex justify-end">
        <Button
          loading={saving}
          disabled={!userId || !Number(points) || !reason.trim()}
          onClick={grant}
        >
          Grant points
        </Button>
      </div>
    </div>
  );
}

export function AdminRewardTools({ staff }: { staff: StaffOption[] }) {
  const [view, setView] = useState<"grant" | null>(null);
  return (
    <>
      <Button
        size="sm"
        icon="solar:star-broken"
        onClick={() => setView("grant")}
      >
        Grant points
      </Button>
      <SimpleModal
        open={view === "grant"}
        onClose={() => setView(null)}
        title="Grant points"
        icon="solar:star-broken"
        maxWidth="max-w-lg"
      >
        {view === "grant" && <GrantPoints staff={staff} />}
      </SimpleModal>
    </>
  );
}
