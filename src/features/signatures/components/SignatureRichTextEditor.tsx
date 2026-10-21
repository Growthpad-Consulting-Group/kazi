"use client";

import { RichEmailEditor } from "@/components/ui/RichEmailEditor";
import type { Block } from "@/features/signatures/lib/signoffBlocks";

export default function SignatureRichTextEditor({ html, onChange }: { html: string; onChange: (html: string) => void; templateId: string; onInsertBlockAfter?: (type: Block["type"]) => void }) {
  return <RichEmailEditor initialHtml={html} onChange={(nextHtml) => onChange(nextHtml)} placeholder="Write signature content…" />;
}
