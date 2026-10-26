"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import { SendFeedbackForm } from "./SendFeedbackForm";

type Props = React.ComponentProps<typeof SendFeedbackForm>;

export function SendRecognitionButton(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" icon="solar:star-fall-broken" onClick={() => setOpen(true)}>Send recognition</Button>
      <SimpleModal open={open} onClose={() => setOpen(false)} title="Send recognition" icon="solar:star-fall-broken" maxWidth="max-w-xl">
        {open && <SendFeedbackForm {...props} onSent={() => setOpen(false)} />}
      </SimpleModal>
    </>
  );
}
