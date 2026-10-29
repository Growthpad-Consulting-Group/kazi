"use client";

import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";

type Block = {
  id: string;
  kind: "photo" | "text" | "divider" | "button";
  value?: string;
  label?: string;
};

const id = () => crypto.randomUUID();

function htmlFor(blocks: Block[]) {
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;">${blocks
    .map((block) => {
      if (block.kind === "photo")
        return `<tr><td style="padding:0 0 12px;vertical-align:top;"><span style="display:inline-block;overflow:hidden;border-radius:9999px;width:72px;height:72px;line-height:0;"><img src="{{photo_url}}" width="72" height="72" alt="{{full_name}}" style="display:block;width:72px;height:72px;object-fit:cover;border:0;" /></span></td></tr>`;
      if (block.kind === "divider")
        return `<tr><td style="padding:10px 0;border-top:1px solid #e5e7eb;font-size:0;line-height:0;">&nbsp;</td></tr>`;
      if (block.kind === "button")
        return `<tr><td style="padding-top:10px;"><a href="${block.value || "https://growthpad.africa"}" style="display:inline-block;background:#f05d23;color:#ffffff;border-radius:6px;padding:9px 14px;font-size:12px;font-weight:bold;text-decoration:none;">${block.label || "Learn more"}</a></td></tr>`;
      return `<tr><td style="font-size:13px;line-height:1.5;">${block.value || "<strong>{{full_name}}</strong><br/><span style='color:#f05d23;'>{{role_title}}</span><br/><a href='mailto:{{email}}' style='color:#374151;text-decoration:none;'>{{email}}</a>"}</td></tr>`;
    })
    .join("")}</table>`;
}

export default function SignatureBlockBuilder({
  initialHtml,
  onSave,
}: {
  initialHtml: string;
  onSave: (html: string) => Promise<void>;
}) {
  const [blocks, setBlocks] = useState<Block[]>(() =>
    initialHtml.includes("{{photo_url}}")
      ? [
          { id: id(), kind: "photo" },
          { id: id(), kind: "text" },
        ]
      : [{ id: id(), kind: "text" }],
  );
  const [saving, setSaving] = useState(false);
  const html = useMemo(() => htmlFor(blocks), [blocks]);
  const preview = html
    .replaceAll(
      "{{photo_url}}",
      "https://placehold.co/72x72/f05d23/ffffff?text=GP",
    )
    .replaceAll("{{full_name}}", "Emmanuel Eshun")
    .replaceAll("{{role_title}}", "Growthpad team")
    .replaceAll("{{email}}", "emmanuel.eshun@growthpad.net");
  const add = (kind: Block["kind"]) =>
    setBlocks((current) => [...current, { id: id(), kind }]);
  const move = (index: number, direction: -1 | 1) =>
    setBlocks((current) => {
      const next = [...current];
      const destination = index + direction;
      if (destination < 0 || destination >= next.length) return current;
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  const updateBlock = (blockId: string, values: Partial<Block>) =>
    setBlocks((current) =>
      current.map((block) =>
        block.id === blockId ? { ...block, ...values } : block,
      ),
    );
  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <aside className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-lo)]">
          Blocks
        </p>
        <div className="mt-3 grid gap-2">
          {(["photo", "text", "divider", "button"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => add(kind)}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm font-semibold capitalize hover:border-brand-500/40"
            >
              <Icon
                icon={
                  kind === "photo"
                    ? "solar:gallery-broken"
                    : kind === "text"
                      ? "solar:text-broken"
                      : kind === "divider"
                        ? "solar:minus-square-broken"
                        : "solar:cursor-broken"
                }
                className="h-4 w-4 text-brand-500"
              />
              Add {kind}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-[var(--text-lo)]">
          The Photo block uses each staff member’s {"{{photo_url}}"}{" "}
          automatically. Text accepts merge tags such as {"{{full_name}}"} and{" "}
          {"{{email}}"}.
        </p>
      </aside>
      <div>
        <div className="space-y-2">
          {blocks.map((block, index) => (
            <div
              key={block.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
                  <Icon
                    icon={
                      block.kind === "photo"
                        ? "solar:gallery-broken"
                        : "solar:document-text-broken"
                    }
                    className="h-4 w-4"
                  />
                </span>
                <span className="flex-1 text-sm font-semibold capitalize">
                  {block.kind}
                </span>
                <button
                  type="button"
                  aria-label="Move block up"
                  onClick={() => move(index, -1)}
                  className="p-1 text-[var(--text-lo)]"
                >
                  <Icon icon="solar:arrow-up-broken" />
                </button>
                <button
                  type="button"
                  aria-label="Move block down"
                  onClick={() => move(index, 1)}
                  className="p-1 text-[var(--text-lo)]"
                >
                  <Icon icon="solar:arrow-down-broken" />
                </button>
                <button
                  type="button"
                  aria-label="Delete block"
                  onClick={() =>
                    setBlocks((current) =>
                      current.filter((item) => item.id !== block.id),
                    )
                  }
                  className="p-1 text-red-500"
                >
                  <Icon icon="solar:trash-bin-trash-broken" />
                </button>
              </div>
              {block.kind === "text" && (
                <textarea
                  value={block.value ?? ""}
                  onChange={(event) =>
                    updateBlock(block.id, { value: event.target.value })
                  }
                  placeholder="Leave blank for the default name, role and email layout."
                  className="mt-3 min-h-20 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2 font-mono text-xs outline-none focus:border-brand-500"
                />
              )}
              {block.kind === "button" && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input
                    value={block.label ?? ""}
                    onChange={(event) =>
                      updateBlock(block.id, { label: event.target.value })
                    }
                    placeholder="Button label"
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-2 text-sm outline-none focus:border-brand-500"
                  />
                  <input
                    value={block.value ?? ""}
                    onChange={(event) =>
                      updateBlock(block.id, { value: event.target.value })
                    }
                    placeholder="https://…"
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-2 text-sm outline-none focus:border-brand-500"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)] bg-white p-5">
          <iframe
            title="Signature builder preview"
            sandbox=""
            srcDoc={preview}
            className="h-52 w-full border-0"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <button
            disabled={saving}
            type="button"
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(html);
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not save builder design.",
                );
              } finally {
                setSaving(false);
              }
            }}
            className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save builder design"}
          </button>
        </div>
      </div>
    </div>
  );
}
