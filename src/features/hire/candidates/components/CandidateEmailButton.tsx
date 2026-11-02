"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { SimpleModal } from "@/components/ui/SimpleModal";
import { EmailPanel } from "./EmailPanel";

export function CandidateEmailButton({
  candidateId,
  candidateName,
  email,
}: {
  candidateId: string;
  candidateName: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 transition-colors hover:text-brand-500"
      >
        <Icon
          icon="solar:letter-broken"
          className="h-3.5 w-3.5 text-brand-500"
        />
        {email}
      </button>
      <SimpleModal
        open={open}
        onClose={() => setOpen(false)}
        title={`Email ${candidateName}`}
        subtitle="Draft and send a thoughtful update with AI assistance."
        icon="solar:letter-broken"
        maxWidth="max-w-3xl"
      >
        <EmailPanel candidateId={candidateId} />
      </SimpleModal>
    </>
  );
}
