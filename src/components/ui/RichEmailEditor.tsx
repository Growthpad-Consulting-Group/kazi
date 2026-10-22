"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { $getRoot, $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND } from "lexical";
import { $toggleLink } from "@lexical/link";
import { LinkNode } from "@lexical/link";
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, ListNode, ListItemNode } from "@lexical/list";

type Props = {
  initialHtml: string;
  onChange: (html: string, plainText: string) => void;
  placeholder?: string;
};

const theme = {
  paragraph: "mb-3 last:mb-0",
  text: { bold: "font-semibold", italic: "italic" },
  list: { ul: "my-3 list-disc pl-5", ol: "my-3 list-decimal pl-5", listitem: "my-1" },
  link: "text-brand-500 underline underline-offset-2",
};

export function RichEmailEditor({ initialHtml, onChange, placeholder = "Write your email…" }: Props) {
  return <LexicalComposer initialConfig={{ namespace: "KaziEmailComposer", theme, nodes: [ListNode, ListItemNode, LinkNode], onError: (error) => { throw error; } }}><div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] focus-within:border-brand-500/60 focus-within:ring-2 focus-within:ring-brand-500/10"><Toolbar /><div className="relative"><RichTextPlugin contentEditable={<ContentEditable aria-label="Email body" className="relative min-h-52 resize-y px-3 py-3 text-sm leading-relaxed text-[var(--text-hi)] outline-none" />} placeholder={<p className="pointer-events-none absolute left-3 top-3 text-sm text-[var(--text-lo)]">{placeholder}</p>} ErrorBoundary={LexicalErrorBoundary} /><HistoryPlugin /><ListPlugin /><LinkPlugin /><InitialHtmlPlugin html={initialHtml} /><OnChangePlugin onChange={(editorState, editor) => { editorState.read(() => onChange($generateHtmlFromNodes(editor, null), $getRoot().getTextContent())); }} /></div></div></LexicalComposer>;
}

function InitialHtmlPlugin({ html }: { html: string }) {
  const [editor] = useLexicalComposerContext();
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    editor.update(() => {
      const dom = new DOMParser().parseFromString(html || "<p></p>", "text/html");
      const nodes = $generateNodesFromDOM(editor, dom);
      const root = $getRoot();
      root.clear();
      root.append(...nodes);
    });
  }, [editor, html]);
  return null;
}

function Toolbar() {
  const [editor] = useLexicalComposerContext();
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const selectionIsRange = () => editor.getEditorState().read(() => $isRangeSelection($getSelection()));
  const insertLink = () => {
    const cleaned = url.trim();
    if (!cleaned) return;
    editor.update(() => $toggleLink(/^https?:\/\//i.test(cleaned) || /^mailto:/i.test(cleaned) ? cleaned : `https://${cleaned}`));
    setUrl(""); setLinkOpen(false);
  };
  return <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5"><div className="flex items-center gap-1"><ToolButton label="Bold" icon="solar:text-bold-broken" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")} /><ToolButton label="Italic" icon="solar:text-italic-broken" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")} /><span className="mx-1 h-4 w-px bg-[var(--border)]" /><ToolButton label="Bulleted list" icon="solar:list-broken" onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)} /><ToolButton label="Numbered list" icon="solar:list-check-minimalistic-broken" onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)} /><span className="mx-1 h-4 w-px bg-[var(--border)]" /><ToolButton label="Add link" icon="solar:link-broken" onClick={() => { if (selectionIsRange()) setLinkOpen((open) => !open); }} /></div>{linkOpen && <div className="mt-1.5 flex items-center gap-2 border-t border-[var(--border)] pt-1.5"><input autoFocus value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") insertLink(); if (event.key === "Escape") setLinkOpen(false); }} placeholder="https://example.com" className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-hi)] outline-none focus:border-brand-500/60" /><button type="button" onClick={insertLink} className="rounded-lg bg-brand-500 px-2 py-1 text-xs font-medium text-white hover:bg-brand-600">Add link</button></div>}</div>;
}

function ToolButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return <button type="button" aria-label={label} title={label} onMouseDown={(event) => event.preventDefault()} onClick={onClick} className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-lo)] transition-colors hover:bg-[var(--surface)] hover:text-brand-500"><Icon icon={icon} className="h-4 w-4" /></button>;
}
