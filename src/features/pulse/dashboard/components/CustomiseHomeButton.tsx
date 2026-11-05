"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { SimpleModal } from "@/components/ui/SimpleModal";
import HomeModulesForm from "./HomeModulesForm";
import type { HomeModuleId } from "../home-modules";

export default function CustomiseHomeButton({
  initial,
}: {
  initial: HomeModuleId[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-left transition-colors hover:bg-[var(--surface)]"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
          <Icon icon="solar:widget-2-broken" className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1 text-xs font-semibold text-[var(--text-hi)]">
          Customise home
        </span>
        <Icon
          icon="solar:arrow-right-broken"
          className="h-3.5 w-3.5 text-[var(--text-lo)] transition-transform group-hover:translate-x-0.5"
        />
      </button>
      <SimpleModal
        open={open}
        onClose={close}
        title="Customise your home"
        icon="solar:widget-2-broken"
        subtitle="Choose optional cards for your Pulse home."
        maxWidth="max-w-xl"
      >
        <HomeModulesForm
          initial={initial}
          onSaved={() => router.refresh()}
        />
      </SimpleModal>
    </>
  );
}
