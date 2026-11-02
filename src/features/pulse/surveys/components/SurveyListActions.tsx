"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { SurveyStatus } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import { EditSurveyDetailsButton } from "./EditSurveyDetailsButton";

export function SurveyListActions({
  surveyId,
  title,
  description,
  status,
}: {
  surveyId: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (
        !triggerRef.current?.contains(event.target as Node) &&
        !menuRef.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function toggleMenu() {
    if (open) return setOpen(false);
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPosition({
        top: rect.bottom + 8,
        left: Math.max(8, rect.right - 176),
      });
    }
    setOpen(true);
  }

  async function request(
    path: string,
    method: "PATCH" | "POST" | "DELETE",
    body?: object,
  ) {
    const response = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? "Could not update survey.");
    return data as { id?: string };
  }

  async function setStatus(nextStatus: SurveyStatus) {
    setSaving(true);
    try {
      await request(`/api/pulse/surveys/${surveyId}`, "PATCH", {
        status: nextStatus,
      });
      toast.success(
        nextStatus === "active"
          ? "Survey launched"
          : nextStatus === "closed"
            ? "Survey closed"
            : "Survey archived",
      );
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update survey.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function duplicate() {
    setSaving(true);
    try {
      const data = await request(`/api/pulse/surveys/${surveyId}`, "POST");
      toast.success("Draft copy created");
      setOpen(false);
      if (data.id) router.push(`/pulse/surveys/${data.id}`);
      else router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not duplicate survey.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await request(`/api/pulse/surveys/${surveyId}`, "DELETE");
      toast.success("Draft deleted");
      setConfirmingDelete(false);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete survey.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${title} actions`}
        aria-expanded={open}
        onClick={toggleMenu}
        className="rounded-lg p-1.5 text-[var(--text-lo)] transition-colors hover:bg-[var(--surface-2)] hover:text-brand-500"
      >
        <Icon icon="solar:menu-dots-broken" className="h-4 w-4" />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] w-44 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-2xl shadow-black/20"
            style={menuPosition}
          >
            {status === "draft" && (
              <EditSurveyDetailsButton
                surveyId={surveyId}
                initialTitle={title}
                initialDescription={description}
                renderTrigger={(showEditor) => (
                  <MenuButton
                    icon="solar:pen-new-square-broken"
                    onClick={() => {
                      setOpen(false);
                      showEditor();
                    }}
                  >
                    Edit draft
                  </MenuButton>
                )}
              />
            )}
            {status === "draft" && (
              <MenuButton
                icon="solar:play-circle-broken"
                disabled={saving}
                onClick={() => setStatus("active")}
              >
                Launch survey
              </MenuButton>
            )}
            {status === "active" && (
              <MenuButton
                icon="solar:lock-keyhole-broken"
                disabled={saving}
                onClick={() => setStatus("closed")}
              >
                Close survey
              </MenuButton>
            )}
            {status === "closed" && (
              <MenuButton
                icon="solar:archive-down-minimalistic-broken"
                disabled={saving}
                onClick={() => setStatus("archived")}
              >
                Archive survey
              </MenuButton>
            )}
            <MenuButton
              icon="solar:copy-broken"
              disabled={saving}
              onClick={duplicate}
            >
              Duplicate
            </MenuButton>
            {status === "draft" && (
              <MenuButton
                icon="solar:trash-bin-minimalistic-broken"
                danger
                onClick={() => {
                  setOpen(false);
                  setConfirmingDelete(true);
                }}
              >
                Delete draft
              </MenuButton>
            )}
          </div>,
          document.body,
        )}
      <SimpleModal
        open={confirmingDelete}
        onClose={() => !deleting && setConfirmingDelete(false)}
        title="Delete draft survey?"
        icon="solar:trash-bin-minimalistic-broken"
        maxWidth="max-w-md"
      >
        <p className="text-sm text-[var(--text-lo)]">
          Delete{" "}
          <span className="font-semibold text-[var(--text-hi)]">{title}</span>?
          This permanently removes its unused draft and audience setup.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => setConfirmingDelete(false)}
          >
            Cancel
          </Button>
          <Button variant="danger" loading={deleting} onClick={remove}>
            Delete draft
          </Button>
        </div>
      </SimpleModal>
    </>
  );
}

function MenuButton({
  children,
  icon,
  onClick,
  disabled,
  danger = false,
}: {
  children: React.ReactNode;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${danger ? "text-red-500 hover:bg-red-500/10" : "text-[var(--text-hi)] hover:bg-[var(--surface-2)]"}`}
    >
      <Icon icon={icon} className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}
