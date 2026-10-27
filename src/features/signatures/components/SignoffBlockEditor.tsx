"use client";
/* eslint-disable react-hooks/refs, react/no-unescaped-entities, @next/next/no-img-element -- ported Signoff canvas uses dnd-kit callback refs and email-preview images. */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { CollisionDetection, DndContext, DragEndEvent, DragOverlay, DragStartEvent, KeyboardSensor, PointerSensor, closestCenter, pointerWithin, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import MediaPicker from "./SignatureMediaPicker";
import RichTextEditor from "./SignatureRichTextEditor";
import {
  Align,
  Block,
  ColumnPath,
  ColumnStyle,
  ImageShape,
  cloneBlockWithNewIds,
  computeColumnWidths,
  createBlock,
  findBlockById,
  findContainerPath,
  getListAt,
  imageBorderRadius,
  insertAfterId,
  insertIntoList,
  newBlockId,
  removeBlockById,
  removeBlockWithResult,
  sameColumnPath,
  updateBlockById,
  updateColumnList,
  wrapLegacyHtml,
} from "@/features/signatures/lib/signoffBlocks";
import { DEFAULT_CANVAS_WIDTH, serializeBlocks } from "@/features/signatures/lib/signoffBlockSerializer";
import { SIGNATURE_LINK_BASE_URL } from "@/features/signatures/lib/signoffTrackedLink";

// dnd-kit droppable ids for each list's *container* (distinct from any block's own id) — needed
// so an empty column, which otherwise has nothing to be "over", is still a valid drop target,
// and so onDragEnd can tell which list a drop landed in when it wasn't dropped on an item.
const ROOT_CONTAINER_ID = "container:root";
const columnContainerId = (columnsId: string, colIndex: number) => `container:${columnsId}:${colIndex}`;
function parseContainerId(id: string): ColumnPath | null | undefined {
  if (id === ROOT_CONTAINER_ID) return null;
  const m = /^container:(.+):(\d+)$/.exec(id);
  return m ? { columnsId: m[1], colIndex: Number(m[2]) } : undefined;
}

// Plain `closestCenter` doesn't understand nesting: the root canvas's own droppable rect spans
// the entire tree (every column and block lives inside it), so its center can end up "closer"
// than the actual, much smaller column being hovered — the exact bug where one column highlights
// on hover and a sibling column never does. Trying `pointerWithin` first (which container is the
// pointer literally inside?) and, among matches, preferring the smallest rect (the innermost,
// most specific container rather than a large ancestor) is dnd-kit's own documented fix for
// nested multi-container trees like this one.
const collisionDetectionStrategy: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length === 0) return closestCenter(args);
  return [...pointerCollisions].sort((a, b) => {
    const rectA = args.droppableRects.get(a.id);
    const rectB = args.droppableRects.get(b.id);
    const areaA = rectA ? rectA.width * rectA.height : Infinity;
    const areaB = rectB ? rectB.width * rectB.height : Infinity;
    return areaA - areaB;
  });
};

// Draggable id for a palette entry — distinguishes "dragging a new block in from the palette"
// from "reordering/moving an existing block" in onDragEnd, since both share one DndContext.
const PALETTE_DRAG_PREFIX = "palette:";
const paletteDragId = (type: Block["type"]) => `${PALETTE_DRAG_PREFIX}${type}`;
const paletteTypeFromDragId = (id: string): Block["type"] | null => (id.startsWith(PALETTE_DRAG_PREFIX) ? (id.slice(PALETTE_DRAG_PREFIX.length) as Block["type"]) : null);

// Same idea as the palette prefix above, but for a preset (which builds one or more ready-made
// blocks rather than a single blank one of a given type) — a separate prefix so onDragEnd can
// tell the two apart.
const PRESET_DRAG_PREFIX = "preset:";
const presetDragId = (id: string) => `${PRESET_DRAG_PREFIX}${id}`;
const presetIdFromDragId = (id: string): string | null => (id.startsWith(PRESET_DRAG_PREFIX) ? id.slice(PRESET_DRAG_PREFIX.length) : null);

export interface BlockEditorHandle {
  getExport: () => { blocks: Block[]; html: string; canvasWidth: number };
  undo: () => void;
  redo: () => void;
}

interface BlockEditorProps {
  templateId: string;
  initialBlocks: Block[] | null;
  initialHtml: string;
  // The "master" width (px) nothing added to the canvas is meant to exceed — a real signature
  // width, not the wide canvas shown while editing. null/undefined (a template that predates
  // this setting) falls back to DEFAULT_CANVAS_WIDTH.
  initialCanvasWidth?: number | null;
  onChange: (blocks: Block[], html: string) => void;
  // Lets the page render its own Undo/Redo buttons in the top toolbar (alongside History/
  // Delete/Preview/Save) rather than as an isolated, easy-to-miss pair of icons floating above
  // the canvas with nothing else around them for context.
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  // When true the canvas swaps in darkSrc for any image block that has one, matching the dark
  // preview toggle in the outer page.
  previewDark?: boolean;
}

const PALETTE: { type: Block["type"]; label: string; icon: string }[] = [
  { type: "text", label: "Text", icon: "solar:text-broken" },
  { type: "image", label: "Image", icon: "solar:gallery-broken" },
  { type: "button", label: "Button", icon: "solar:cursor-broken" },
  { type: "divider", label: "Divider", icon: "solar:minus-square-broken" },
  { type: "spacer", label: "Spacer", icon: "solar:maximize-square-broken" },
  { type: "social", label: "Social row", icon: "solar:share-broken" },
  { type: "columns", label: "Columns", icon: "solar:widget-4-broken" },
];

// Columns-within-columns isn't supported (one level of nesting is enough for the "slice a banner
// into side-by-side clickable pieces" use case this exists for), so the mini palette shown
// inside a column omits it.
const MINI_PALETTE = PALETTE.filter((p) => p.type !== "columns");

/** A ready-made "photo + name/role side by side" layout — a `columns` block pre-filled with a
 * per-staff photo and a text block carrying the two merge tags, rather than a new block type.
 * Every piece (photo size/shape, column width, the text markup) is then just a normal, editable
 * columns block once inserted — no special-cased "staff card" concept downstream. */
function createStaffCardBlock(): Block {
  return {
    id: newBlockId(),
    type: "columns",
    columns: [
      [{ id: newBlockId(), type: "image", src: "{{photo_url}}", alt: "{{full_name}}", width: 64, height: 64, shape: "circle", align: "left" }],
      [
        {
          id: newBlockId(),
          type: "text",
          html: `<p style="margin:0;font-weight:bold;font-size:15px;color:#111827;">{{full_name}}</p><p style="margin:0;font-size:12px;color:#6b7280;">{{role_title}}</p>`,
        },
      ],
    ],
    columnStyles: [{ width: 20 }, {}],
  };
}

// SIGNATURE_LINK_BASE_URL, not NEXT_PUBLIC_APP_URL — this gets baked into the stored block's `src`
// the moment this preset is added, from whichever environment happened to be editing (local dev
// bakes a dead localhost URL nobody but that machine can resolve). Same gotcha as
// blockSerializer.ts's SOCIAL_ICON and trackedLink.ts's tracked-link URLs.
// .png, not .svg — Gmail doesn't render SVG images in signatures at all (shows as a broken
// image), the same reason the pre-existing social icons are PNG too.
const CONTACT_ICON = (icon: string) => `${SIGNATURE_LINK_BASE_URL}/assets/icons/contact/${icon}.png`;

/** `{{phone}}`/`{{mobile}}` wrapped in a `tel:` link — the merge tag appears twice (href and
 * label) so each staff member's own number ends up as both the link target and the visible text
 * once renderSignatureHtml substitutes it; a plain `{{phone}}` alone rendered as inert text in
 * Gmail (no href at all), which is the "plain text, not clickable" problem this fixes. No
 * click-tracking redirect here (unlike the Link URL field on an image/button block) — those are
 * baked in at template-authoring time with a fixed destination, but a `tel:` target has to vary
 * per staff, which only a merge tag inside the href itself can do. */
const telLink = (tag: "phone" | "mobile") => `<a href="tel:{{${tag}}}">{{${tag}}}</a>`;

/** One icon-in-a-circle + text row (phone/mobile/address/website) — a `columns` block just like
 * the staff card, so it stays fully editable (swap the icon, edit the text, resize the columns)
 * rather than being a one-off special case. */
function createContactRow(icon: string, text: string): Block {
  return {
    id: newBlockId(),
    type: "columns",
    columns: [
      // shape: "circle" even though the source PNG is already a circle — the icon still needs
      // Gmail's actual clip (the overflow:hidden wrapper blockSerializer adds for a circle
      // shape), since Gmail can render a square image area slightly non-square inside its own
      // narrow table cell, flattening an already-round source image into a squircle otherwise.
      [{ id: newBlockId(), type: "image", src: CONTACT_ICON(icon), alt: icon, width: 28, height: 28, shape: "circle", align: "left" }],
      [{ id: newBlockId(), type: "text", html: `<p style="margin:0;font-size:13px;color:#374151;">${text}</p>` }],
    ],
    columnStyles: [{ width: 14 }, {}],
  };
}

/** A ready-made 4-row "contact details" block: phone, mobile, address, website, each with a
 * circular brand-colored icon — built from the same primitives as the staff card. Phone/mobile
 * use the real merge tags; address/website have no merge tag (they're not per-staff data), so
 * they land as plain editable placeholder text instead. */
function createContactDetailsBlocks(): Block[] {
  return [
    createContactRow("phone", telLink("phone")),
    { id: newBlockId(), type: "spacer", height: 8 },
    createContactRow("mobile", telLink("mobile")),
    { id: newBlockId(), type: "spacer", height: 8 },
    createContactRow("location", "Your office address"),
    { id: newBlockId(), type: "spacer", height: 8 },
    createContactRow("website", "www.example.com"),
  ];
}

// The Presets section in the sidebar — each builds one or more ready-made blocks. Shared between
// the click-to-append buttons and the drag-into-canvas handling in onDragEnd, same relationship
// PALETTE has to the plain block types.
const PRESETS: { id: string; label: string; icon: string; build: () => Block[] }[] = [
  { id: "staffCard", label: "Staff card (photo + name/role)", icon: "solar:user-id-broken", build: () => [createStaffCardBlock()] },
  { id: "contactDetails", label: "Contact details (icons)", icon: "solar:phone-broken", build: createContactDetailsBlocks },
  // Single rows, for adding one contact field (with its icon) to a template that doesn't want
  // the full 4-row contactDetails preset — e.g. a template that already has phone/address/
  // website and just needs mobile added, without rebuilding the whole block as plain text (which
  // is how templates predating this preset ended up with an icon-less number row).
  { id: "phoneRow", label: "Phone (icon)", icon: "solar:phone-calling-broken", build: () => [createContactRow("phone", telLink("phone"))] },
  { id: "mobileRow", label: "Mobile (icon)", icon: "solar:smartphone-broken", build: () => [createContactRow("mobile", telLink("mobile"))] },
  { id: "locationRow", label: "Address (icon)", icon: "solar:map-point-broken", build: () => [createContactRow("location", "Your office address")] },
  { id: "websiteRow", label: "Website (icon)", icon: "solar:global-broken", build: () => [createContactRow("website", "www.example.com")] },
];

const SOCIAL_OPTIONS = ["linkedin", "instagram", "facebook", "x", "youtube"];

interface ListActions {
  selectedId: string | null;
  templateId: string;
  previewDark?: boolean;
  previewMobile?: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onTextChange: (id: string, html: string) => void;
  onInsertBlockAfter: (id: string, type: Block["type"]) => void;
  onReorder: (path: ColumnPath | null, oldIndex: number, newIndex: number) => void;
  onAddBlock: (path: ColumnPath | null, type: Block["type"]) => void;
}

function BlockPreview({ block, editingText, actions }: { block: Block; editingText?: boolean; actions: ListActions }) {
  switch (block.type) {
    case "text":
      // Only the selected text block mounts a live Tiptap instance — mounting one per block up
      // front would be wasteful, and only one can be focused/edited at a time anyway.
      return editingText ? (
        <RichTextEditor
          html={block.html}
          onChange={(html) => actions.onTextChange(block.id, html)}
          templateId={actions.templateId}
          onInsertBlockAfter={(type) => actions.onInsertBlockAfter(block.id, type)}
        />
      ) : (
        // Unselected, this is raw HTML (not a live Tiptap instance yet), so a link inside it is a
        // real, clickable <a> — clicking it to select the block also navigated. A click-time
        // preventDefault() isn't reliable enough here (dnd-kit's own pointer listeners are also
        // on this subtree), so pointer-events:none on every descendant <a> stops the browser from
        // ever dispatching a click to the anchor at all — the click passes straight through to
        // this div underneath it, which still bubbles up to select the block as normal.
        <div className="text-sm text-text-hi [&_a]:pointer-events-none" dangerouslySetInnerHTML={{ __html: block.html }} />
      );
    case "image":
      // The merge tag isn't a real URL, so the canvas can't actually load it — show a clear
      // placeholder instead of what would otherwise just look like a broken image.
      if (block.src === "{{photo_url}}") {
        return (
          <div style={{ paddingTop: block.paddingY, paddingBottom: block.paddingY, paddingLeft: block.paddingX, paddingRight: block.paddingX }}>
            <div
              className={`flex items-center justify-center border border-dashed border-app-border bg-surface-2/60 text-text-lo ${block.align === "center" ? "mx-auto" : block.align === "right" ? "ml-auto" : ""}`}
              style={{ width: block.width, height: block.height || block.width, borderRadius: imageBorderRadius(block.shape) }}
            >
              <Icon icon="solar:user-circle-broken" className="h-1/2 w-1/2" />
            </div>
          </div>
        );
      }
      return block.src ? (
        <div style={{ paddingTop: block.paddingY, paddingBottom: block.paddingY, paddingLeft: block.paddingX, paddingRight: block.paddingX }}>
          <img
            src={(actions.previewDark && block.darkSrc) ? block.darkSrc : block.src}
            alt={block.alt}
            style={{ width: block.width, height: block.height || (block.shape === "circle" ? block.width : undefined), objectFit: block.height || block.shape === "circle" ? "cover" : undefined, borderRadius: imageBorderRadius(block.shape), maxWidth: "100%", display: "block" }}
            className={block.align === "center" ? "mx-auto" : block.align === "right" ? "ml-auto" : ""}
          />
        </div>
      ) : (
        <div className="flex h-16 w-24 items-center justify-center rounded border border-dashed border-app-border text-text-lo">
          <Icon icon="solar:gallery-broken" className="h-5 w-5" />
        </div>
      );
    case "button":
      return (
        <div className={block.align === "center" ? "text-center" : block.align === "right" ? "text-right" : ""}>
          <span className="inline-block rounded-md px-4 py-2 text-sm font-bold" style={{ backgroundColor: block.bgColor, color: block.textColor }}>
            {block.label}
          </span>
        </div>
      );
    case "divider":
      return <div className="border-t" style={{ borderColor: block.color }} />;
    case "spacer":
      return <div style={{ height: block.height }} className="text-xs text-text-lo/50">{`Spacer (${block.height}px)`}</div>;
    case "social":
      return (
        <div className={`flex gap-2 ${block.align === "center" ? "justify-center" : block.align === "right" ? "justify-end" : ""}`}>
          {block.icons.length === 0 ? (
            <span className="text-xs text-text-lo">No icons added yet</span>
          ) : (
            block.icons.map((i, idx) => (
              <img key={idx} src={`/assets/icons/social/${i.icon}.png`} alt={i.icon} className="h-5 w-5" />
            ))
          )}
        </div>
      );
    case "columns":
      return (
        <div className="grid gap-4" style={{ gridTemplateColumns: actions.previewMobile ? "1fr" : computeColumnWidths(block.columnStyles).map((w) => `${w}%`).join(" ") }}>
          {block.columns.map((col, idx) => {
            const cs = block.columnStyles[idx] || {};
            const borderColor = cs.borderColor || "#e5e7eb";
            const borderWidth = cs.borderWidth || 2;
            const realStyle: React.CSSProperties = {
              padding: cs.padding,
              backgroundColor: cs.backgroundColor,
              borderTop: cs.borderTop ? `${borderWidth}px solid ${borderColor}` : undefined,
              borderRight: cs.borderRight ? `${borderWidth}px solid ${borderColor}` : undefined,
              borderBottom: cs.borderBottom ? `${borderWidth}px solid ${borderColor}` : undefined,
              borderLeft: cs.borderLeft ? `${borderWidth}px solid ${borderColor}` : undefined,
            };
            return (
              // The outer dashed box is just an editing affordance; `realStyle` on the inner div
              // is what actually ships in the exported HTML (see blockSerializer.ts).
              <div key={idx} onClick={(e) => e.stopPropagation()} className="rounded-lg border border-dashed border-app-border/50 p-1">
                <div style={realStyle}>
                  <BlockList blocks={col} path={{ columnsId: block.id, colIndex: idx }} actions={actions} nested />
                </div>
              </div>
            );
          })}
        </div>
      );
    case "html":
      return (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-400">
          <p className="mb-1 flex items-center gap-1 font-medium">
            <Icon icon="solar:code-broken" className="h-3.5 w-3.5" />
            Advanced HTML block
          </p>
          <p>Raw HTML from before the visual editor — edit it in the Settings panel, or replace it with real blocks.</p>
        </div>
      );
  }
}

function SortableBlock({ block, actions }: { block: Block; actions: ListActions }) {
  const selected = block.id === actions.selectedId;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  // A live Tiptap instance is mounted while a text block is selected — dragging from anywhere on
  // its body would hijack click-and-drag text selection (needed for the bubble menu), so only
  // the handle drags in that case. Every other block (or a text block when not being edited)
  // drags from anywhere; PointerSensor's 8px activation distance already tells a genuine drag
  // apart from a plain click, so this doesn't fight the onClick-to-select below it.
  //
  // "columns" is excluded outright: its body can contain a nested, currently-editing text block
  // several levels down, and `{...listeners}` includes dnd-kit's KeyboardSensor handler, which
  // treats Space as "start a drag." Spread onto this wrapping div, that handler becomes an
  // ancestor of that nested editor — a keypress inside it bubbles up and gets swallowed as a
  // drag-start instead of typing a space. Handle-only dragging sidesteps that for every column,
  // not just the one currently being typed in.
  const wholeBodyDraggable = block.type !== "columns" && !(block.type === "text" && selected);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => actions.onSelect(block.id)}
      {...(wholeBodyDraggable ? attributes : {})}
      {...(wholeBodyDraggable ? listeners : {})}
      // Notion-style chrome: no permanent box, just a hover-revealed drag handle/delete and a
      // left accent bar on selection — a permanent bordered card per block is what reads as
      // "basic" as much as anything about the text editor itself. The handle/actions are
      // absolutely positioned overlays (not flex siblings of the content) so a narrow nested
      // column — e.g. a contact row's 14%-wide icon column — doesn't have its actual preview
      // content squeezed down to make room for them; they float over the small reserved padding
      // on each side instead of competing with the content for width.
      className={`group relative rounded-md py-1 pl-6 pr-8 transition-colors ${wholeBodyDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${
        selected ? "bg-brand-500/5" : "hover:bg-surface-2/60"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        title="Drag to move"
        className="absolute left-0 top-1 cursor-grab rounded p-1 text-text-lo opacity-0 transition hover:bg-surface-2 hover:text-text-hi active:cursor-grabbing group-hover:opacity-100"
      >
        <Icon icon="solar:hamburger-menu-broken" className="h-4 w-4" />
      </button>
      <div className={`min-w-0 border-l-2 pl-3 ${selected ? "border-brand-500" : "border-transparent"}`}>
        <BlockPreview block={block} editingText={false} actions={actions} />
      </div>
      <div className="absolute right-0 top-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            actions.onDuplicate(block.id);
          }}
          title="Duplicate"
          className="rounded p-1 text-text-lo transition-colors hover:bg-surface-2 hover:text-text-hi"
        >
          <Icon icon="solar:copy-broken" className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            actions.onRemove(block.id);
          }}
          title="Delete"
          className="rounded p-1 text-text-lo transition-colors hover:bg-status-danger/10 hover:text-status-danger"
        >
          <Icon icon="solar:trash-bin-trash-broken" className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Renders one block list — either the top-level canvas (`path: null`) or one column of a
 * `columns` block (`path` set). Recurses via BlockPreview's "columns" case, so nesting is just "a
 * BlockList inside a BlockList". Drag-and-drop is *not* scoped here — one `DndContext` at the
 * `BlockEditor` root spans every list (this is dnd-kit's standard multi-container pattern), so a
 * block can be dragged between lists, not just reordered within one. `useDroppable` on the
 * container itself (rather than relying only on item-level sortable ids) is what makes an empty
 * column — which otherwise has no item to be "over" — still a valid drop target. */
function BlockList({ blocks, path, actions, nested }: { blocks: Block[]; path: ColumnPath | null; actions: ListActions; nested?: boolean }) {
  const containerId = path ? columnContainerId(path.columnsId, path.colIndex) : ROOT_CONTAINER_ID;
  const { setNodeRef, isOver } = useDroppable({ id: containerId });

  return (
    <div ref={setNodeRef} className={`rounded-lg transition-colors ${isOver ? "bg-brand-500/5" : ""}`}>
      {blocks.length === 0 ? (
        <p className={nested ? "py-3 text-center text-xs text-text-lo" : "py-12 text-center text-sm text-text-lo"}>
          {nested ? "Empty column — drag a block here, or use the icons below." : "Click or drag a block from the panel to get started."}
        </p>
      ) : (
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {blocks.map((block) => (
              <SortableBlock key={block.id} block={block} actions={actions} />
            ))}
          </div>
        </SortableContext>
      )}
      {nested && (
        <div className="mt-1 flex flex-wrap gap-0.5 border-t border-app-border pt-1">
          {MINI_PALETTE.map((p) => (
            <button
              key={p.type}
              title={`Add ${p.label}`}
              onClick={() => actions.onAddBlock(path, p.type)}
              className="rounded p-1 text-text-lo transition-colors hover:bg-surface-2 hover:text-text-hi"
            >
              <Icon icon={p.icon} className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** One entry in the main sidebar palette — click still appends to the end of the canvas
 * (unchanged), but it's now also a drag source: pick it up and drop it anywhere in the canvas or
 * directly into a column to insert it right there, via the same onDragEnd the block-move/reorder
 * logic uses (distinguished by the `palette:` id prefix). */
function PaletteButton({ type, label, icon, onClick }: { type: Block["type"]; label: string; icon: string; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: paletteDragId(type) });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-xl border border-transparent bg-surface-2/65 px-3 py-2.5 text-sm text-text-hi transition-colors hover:bg-brand-500/8 hover:text-brand-500 ${
        isDragging ? "cursor-grabbing opacity-50" : "cursor-grab"
      }`}
    >
      <Icon icon={icon} className="h-4 w-4 text-brand-600" />
      {label}
    </button>
  );
}

/** Same drag-or-click behavior as PaletteButton, but for a Preset entry (the `preset:` id prefix
 * instead of `palette:`) — dragging one onto the canvas or into a column inserts every block the
 * preset builds, right at the drop point. */
function PresetButton({ id, label, icon, onClick }: { id: string; label: string; icon: string; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: presetDragId(id) });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-xl border border-transparent bg-surface-2/65 px-3 py-2.5 text-sm text-text-hi transition-colors hover:bg-brand-500/8 hover:text-brand-500 ${
        isDragging ? "cursor-grabbing opacity-50" : "cursor-grab"
      }`}
    >
      <Icon icon={icon} className="h-4 w-4 text-brand-600" />
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-text-hi">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "w-full rounded-lg border border-transparent bg-surface-2 px-2.5 py-1.5 text-sm text-text-hi outline-none transition-colors focus:border-brand-500/35 focus:bg-surface focus:ring-2 focus:ring-brand-500/10";

const BlockEditor = forwardRef<BlockEditorHandle, BlockEditorProps>(function BlockEditor(
  { templateId, initialBlocks, initialHtml, initialCanvasWidth, onChange, onHistoryChange, previewDark },
  ref
) {
  const [blocks, setBlocks] = useState<Block[]>(() => (initialBlocks && initialBlocks.length > 0 ? initialBlocks : wrapLegacyHtml(initialHtml)));
  const [canvasWidth, setCanvasWidth] = useState<number>(initialCanvasWidth || DEFAULT_CANVAS_WIDTH);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paletteCollapsed, setPaletteCollapsed] = useState(true);
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null);
  const [darkPickerOpenFor, setDarkPickerOpenFor] = useState<string | null>(null);
  // Label shown in the DragOverlay while dragging a *new* block in from the palette — sortable
  // items already get their own transform-based preview from useSortable, so this only needs to
  // cover the palette case (which isn't part of any SortableContext).
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Undo/redo over the whole block tree. Snapshots are coalesced on a pause in editing (not
  // pushed per keystroke — that'd make undo require one press per character typed) using the
  // same debounce-on-settle pattern as the autosave notification below, just with its own timer.
  const historyRef = useRef<Block[][]>([]);
  const futureRef = useRef<Block[][]>([]);
  const lastSnapshotRef = useRef<Block[]>(blocks);
  const historyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0); // bumped to re-render Undo/Redo's disabled state

  const undo = () => {
    if (historyRef.current.length === 0) return;
    const previous = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, blocks];
    lastSnapshotRef.current = previous;
    setBlocks(previous);
    setSelectedId(null);
    setHistoryVersion((v) => v + 1);
  };

  const redo = () => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    historyRef.current = [...historyRef.current, blocks];
    lastSnapshotRef.current = next;
    setBlocks(next);
    setSelectedId(null);
    setHistoryVersion((v) => v + 1);
  };

  // Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z — but not while focus is inside a text block's Tiptap editor,
  // which has its own character-level undo (StarterKit's History extension); letting both fire
  // on the same keypress would double-undo.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod || e.key.toLowerCase() !== "z") return;
      if (e.target instanceof HTMLElement && e.target.closest(".ProseMirror")) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  const onHistoryChangeRef = useRef(onHistoryChange);
  onHistoryChangeRef.current = onHistoryChange;
  useEffect(() => {
    onHistoryChangeRef.current?.(historyRef.current.length > 0, futureRef.current.length > 0);
  }, [historyVersion]);

  const selected = selectedId ? findBlockById(blocks, selectedId) : null;

  useImperativeHandle(ref, () => ({
    getExport: () => ({ blocks, html: serializeBlocks(blocks, templateId, canvasWidth), canvasWidth }),
    undo,
    redo,
  }));

  // Fires once immediately on mount (so the page's preview/autosave state reflects the initial
  // content right away, matching GrapesEditor's "load" event) and debounced on every edit after
  // — including a canvasWidth change, which also needs to autosave and re-render the preview.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      onChangeRef.current(blocks, serializeBlocks(blocks, templateId, canvasWidth));
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      onChangeRef.current(blocks, serializeBlocks(blocks, templateId, canvasWidth));
    }, 500);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, canvasWidth]);

  // Commits `lastSnapshotRef` (the state from before this burst of edits) onto the undo stack
  // once edits settle, then moves the snapshot forward — one undo step per pause in editing.
  useEffect(() => {
    if (!mountedRef.current) return; // the mount-time effect above already set lastSnapshotRef
    if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
    historyDebounceRef.current = setTimeout(() => {
      if (lastSnapshotRef.current !== blocks) {
        historyRef.current = [...historyRef.current.slice(-49), lastSnapshotRef.current];
        futureRef.current = [];
        lastSnapshotRef.current = blocks;
        setHistoryVersion((v) => v + 1);
      }
    }, 600);
    return () => {
      if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
    };
  }, [blocks]);

  const updateBlock = (id: string, patch: Partial<Block>) => {
    setBlocks((prev) => updateBlockById(prev, id, patch));
  };

  const addBlock = (type: Block["type"]) => {
    const block = createBlock(type);
    setBlocks((prev) => [...prev, block]);
    setSelectedId(block.id);
  };

  const addPresetBlocks = (newBlocks: Block[]) => {
    if (newBlocks.length === 0) return;
    setBlocks((prev) => [...prev, ...newBlocks]);
    setSelectedId(newBlocks[0].id);
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => removeBlockById(prev, id));
    if (selectedId === id) setSelectedId(null);
  };

  const duplicateBlock = (id: string) => {
    const block = findBlockById(blocks, id);
    if (!block) return;
    const clone = cloneBlockWithNewIds(block);
    setBlocks((prev) => {
      const { result, inserted } = insertAfterId(prev, id, clone);
      return inserted ? result : [...prev, clone];
    });
    setSelectedId(clone.id);
  };

  // Splices a new block right after `afterId`, wherever it is in the tree — used by the "/"
  // slash-command menu inside a text block, so a block can be added without leaving the writing
  // flow for the side palette (or the mini palette, if the text block is inside a column).
  const insertBlockAfter = (afterId: string, type: Block["type"]) => {
    const block = createBlock(type);
    setBlocks((prev) => {
      const { result, inserted } = insertAfterId(prev, afterId, block);
      return inserted ? result : [...prev, block];
    });
    setSelectedId(block.id);
  };

  // Adds to the top-level canvas (path null) or a specific column (path set) — the mini palette
  // under each column uses this to let a column be filled without dragging from the main panel.
  const addBlockToList = (path: ColumnPath | null, type: Block["type"]) => {
    const block = createBlock(type);
    setBlocks((prev) => (path ? updateColumnList(prev, path, (col) => [...col, block]) : [...prev, block]));
    setSelectedId(block.id);
  };

  const reorderList = (path: ColumnPath | null, oldIndex: number, newIndex: number) => {
    setBlocks((prev) => (path ? updateColumnList(prev, path, (col) => arrayMove(col, oldIndex, newIndex)) : arrayMove(prev, oldIndex, newIndex)));
  };

  const actions: ListActions = {
    selectedId,
    templateId,
    previewDark,
    previewMobile: previewMode === "mobile",
    onSelect: setSelectedId,
    onRemove: removeBlock,
    onDuplicate: duplicateBlock,
    onTextChange: (id, html) => updateBlock(id, { html }),
    onInsertBlockAfter: insertBlockAfter,
    onReorder: reorderList,
    onAddBlock: addBlockToList,
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id);
    const paletteType = paletteTypeFromDragId(activeId);
    if (paletteType) {
      setActiveDragLabel(PALETTE.find((p) => p.type === paletteType)?.label ?? null);
      return;
    }
    const presetId = presetIdFromDragId(activeId);
    setActiveDragLabel(presetId ? PRESETS.find((p) => p.id === presetId)?.label ?? null : null);
  };

  // Single DndContext for the whole tree (top-level canvas + every column) — dnd-kit's standard
  // multi-container pattern, which is what lets a block move between lists instead of only
  // reordering within the one it started in.
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragLabel(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    // Dragging a new block in from the palette, rather than moving/reordering an existing one.
    const paletteType = paletteTypeFromDragId(activeId);
    if (paletteType) {
      const parsedContainer = parseContainerId(overId);
      const overIsContainer = parsedContainer !== undefined;
      const toPath = overIsContainer ? parsedContainer : findContainerPath(blocks, overId);
      if (toPath === undefined) return;
      const newBlock = createBlock(paletteType);
      setBlocks((prev) => {
        const targetList = getListAt(prev, toPath);
        const targetIndex = overIsContainer ? targetList.length : targetList.findIndex((b) => b.id === overId);
        return insertIntoList(prev, toPath, newBlock, targetIndex === -1 ? targetList.length : targetIndex);
      });
      setSelectedId(newBlock.id);
      return;
    }

    // Dragging a preset in — same idea, but it builds one or more ready-made blocks, inserted
    // together at the drop point in order.
    const presetId = presetIdFromDragId(activeId);
    if (presetId) {
      const preset = PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      const newBlocks = preset.build();
      if (newBlocks.length === 0) return;
      const parsedContainer = parseContainerId(overId);
      const overIsContainer = parsedContainer !== undefined;
      const toPath = overIsContainer ? parsedContainer : findContainerPath(blocks, overId);
      if (toPath === undefined) return;
      setBlocks((prev) => {
        const targetList = getListAt(prev, toPath);
        const startIndex = overIsContainer ? targetList.length : targetList.findIndex((b) => b.id === overId);
        const baseIndex = startIndex === -1 ? targetList.length : startIndex;
        return newBlocks.reduce((acc, block, i) => insertIntoList(acc, toPath, block, baseIndex + i), prev);
      });
      setSelectedId(newBlocks[0].id);
      return;
    }

    if (activeId === overId) return;

    const fromPath = findContainerPath(blocks, activeId);
    if (fromPath === undefined) return;

    const parsedContainer = parseContainerId(overId);
    const overIsContainer = parsedContainer !== undefined;
    const toPath = overIsContainer ? parsedContainer : findContainerPath(blocks, overId);
    if (toPath === undefined) return;

    if (sameColumnPath(fromPath, toPath)) {
      if (overIsContainer) return; // dropped on empty space in its own list — nothing to reorder against
      const list = getListAt(blocks, fromPath);
      const oldIndex = list.findIndex((b) => b.id === activeId);
      const newIndex = list.findIndex((b) => b.id === overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      reorderList(fromPath, oldIndex, newIndex);
      return;
    }

    // Moving to a different list entirely — remove from the source, insert into the target.
    setBlocks((prev) => {
      const { result, removed } = removeBlockWithResult(prev, activeId);
      if (!removed) return prev;
      const targetList = getListAt(result, toPath);
      const targetIndex = overIsContainer ? targetList.length : targetList.findIndex((b) => b.id === overId);
      return insertIntoList(result, toPath, removed, targetIndex === -1 ? targetList.length : targetIndex);
    });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={collisionDetectionStrategy} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <div className="signature-builder flex h-full min-h-0">
      {/* Palette — collapsible so the canvas can go full-width while editing, not just viewing. */}
      {paletteCollapsed ? (
        <div className="shrink-0 border-r border-[var(--border)]/45 bg-surface p-2">
          <button
            onClick={() => setPaletteCollapsed(false)}
            title="Show block panel"
            className="rounded-lg p-2 text-text-lo transition-colors hover:bg-surface-2 hover:text-text-hi"
          >
            <Icon icon="solar:sidebar-minimalistic-broken" className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="w-56 shrink-0 overflow-y-auto border-r border-[var(--border)]/45 bg-surface p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-text-lo">Add block</p>
            <button
              onClick={() => setPaletteCollapsed(true)}
              title="Hide block panel"
              className="rounded p-1 text-text-lo transition-colors hover:bg-surface-2 hover:text-text-hi"
            >
              <Icon icon="solar:sidebar-minimalistic-broken" className="h-4 w-4" />
            </button>
          </div>
          <p className="mb-2 text-xs text-text-lo">Click to add, or drag onto the canvas — even directly into a column.</p>
          <div className="space-y-2">
            {PALETTE.map((p) => (
              <PaletteButton key={p.type} type={p.type} label={p.label} icon={p.icon} onClick={() => addBlock(p.type)} />
            ))}
          </div>

          <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-text-lo">Presets</p>
          <div className="space-y-2">
            {PRESETS.map((p) => (
              <PresetButton key={p.id} id={p.id} label={p.label} icon={p.icon} onClick={() => addPresetBlocks(p.build())} />
            ))}
          </div>
        </div>
      )}

      {/* Canvas. Editing width stays comfortable to work in regardless of canvasWidth — cramping
          the whole workspace down to a 600px signature width made dragging/clicking blocks
          harder for no real benefit, since canvasWidth is what the *exported* HTML actually gets
          capped to (blockSerializer.ts), not something the editing surface needs to enforce
          visually too. A dashed guide marks where the real signature width ends instead, so it's
          still visible without constraining the work area. */}
      <div className="flex-1 overflow-y-auto bg-surface-2/40 p-7 sm:p-9">
        <div className="mx-auto mb-3 flex w-full items-center justify-between gap-3" style={{ maxWidth: previewMode === "mobile" ? 390 : Math.max(canvasWidth, paletteCollapsed ? 1400 : 900) }}>
          <p className="text-xs font-medium text-text-lo">{previewMode === "mobile" ? "Mobile preview · columns stack" : "Desktop preview · email-safe canvas"}</p>
          <div className="inline-flex rounded-lg bg-surface p-1 shadow-sm">
            <button type="button" onClick={() => setPreviewMode("desktop")} className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${previewMode === "desktop" ? "bg-brand-500/12 text-brand-600" : "text-text-lo hover:text-text-hi"}`}><Icon icon="solar:monitor-broken" className="h-3.5 w-3.5" />Desktop</button>
            <button type="button" onClick={() => setPreviewMode("mobile")} className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${previewMode === "mobile" ? "bg-brand-500/12 text-brand-600" : "text-text-lo hover:text-text-hi"}`}><Icon icon="solar:smartphone-broken" className="h-3.5 w-3.5" />Mobile</button>
          </div>
        </div>
        <div className="mx-auto w-full transition-[max-width] duration-200" style={{ maxWidth: previewMode === "mobile" ? 390 : Math.max(canvasWidth, paletteCollapsed ? 1400 : 900) }}>
          <div className="relative rounded-2xl bg-surface p-6 shadow-[0_12px_35px_rgba(24,24,27,.05)]">
            {canvasWidth < 700 && (
              <div
                className="pointer-events-none absolute inset-y-0 border-r border-dashed border-brand-500/40"
                style={{ left: canvasWidth + 24 /* + the card's own left padding */ }}
                title={`Signature width: ${canvasWidth}px`}
              />
            )}
            <BlockList blocks={blocks} path={null} actions={actions} />
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="w-80 shrink-0 overflow-y-auto border-l border-[var(--border)]/45 bg-surface p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-lo">Settings</p>
        {!selected ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-surface-2/60 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-lo">Template</p>
              <Field label="Content width (px)">
                <input
                  type="number"
                  // Clamping on every keystroke (rather than on blur) fought typing itself — e.g.
                  // the first digit of "650" is briefly "6", which used to get force-clamped to
                  // 200 immediately, so the field could never settle on anything but its own
                  // min/max/default. Let it hold whatever's being typed and only clamp once
                  // typing is done, same as every other numeric field in this panel.
                  value={canvasWidth}
                  onChange={(e) => setCanvasWidth(Number(e.target.value) || 0)}
                  onBlur={() => setCanvasWidth((w) => Math.max(200, Math.min(1000, w || DEFAULT_CANVAS_WIDTH)))}
                  min={200}
                  max={1000}
                  className={inputClass}
                />
              </Field>
              <p className="mt-1.5 text-xs text-text-lo">
                The master width for this signature — every block is capped to fit inside it. 600px is the standard email-signature
                width; most inboxes crop or scroll anything wider.
              </p>
            </div>
            <p className="text-sm text-text-lo">Select a block to edit its settings.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {selected.type === "text" && (
              <div className="space-y-2">
                <p className="text-sm text-text-lo">Edit content here; the canvas stays as your clean, email-safe preview.</p>
                <RichTextEditor html={selected.html} onChange={(html) => updateBlock(selected.id, { html })} templateId={templateId} onInsertBlockAfter={(type) => insertBlockAfter(selected.id, type)} />
              </div>
            )}

            {selected.type === "image" && (
              <>
                <Field label="Image">
                  <div className="flex items-center gap-2">
                    {selected.src && selected.src !== "{{photo_url}}" && (
                      <img src={selected.src} alt="" className="h-10 w-10 rounded border border-app-border object-cover" />
                    )}
                    {selected.src === "{{photo_url}}" && (
                      <span className="flex h-10 w-10 items-center justify-center rounded border border-dashed border-app-border text-text-lo">
                        <Icon icon="solar:user-circle-broken" className="h-5 w-5" />
                      </span>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <button onClick={() => setPickerOpenFor(selected.id)} className="rounded-lg border border-app-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-hi hover:bg-surface-2">
                        {selected.src && selected.src !== "{{photo_url}}" ? "Change image" : "Choose image"}
                      </button>
                      <button
                        onClick={() => updateBlock(selected.id, { src: "{{photo_url}}" })}
                        disabled={selected.src === "{{photo_url}}"}
                        className="rounded-lg border border-app-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-hi hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {selected.src === "{{photo_url}}" ? "Using each staff member's photo ✓" : "Use each staff member's photo"}
                      </button>
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-text-lo">A static image is the same for everyone; each staff member's photo shows their own picture once the signature is sent.</p>
                </Field>
                <Field label="Dark mode image">
                  <div className="flex items-center gap-2">
                    {selected.darkSrc && (
                      <img src={selected.darkSrc} alt="" className="h-10 w-10 rounded border border-app-border object-cover" />
                    )}
                    <div className="flex flex-col gap-1.5">
                      <button onClick={() => setDarkPickerOpenFor(selected.id)} className="rounded-lg border border-app-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-hi hover:bg-surface-2">
                        {selected.darkSrc ? "Change dark image" : "Choose dark image"}
                      </button>
                      {selected.darkSrc && (
                        <button onClick={() => updateBlock(selected.id, { darkSrc: undefined })} className="rounded-lg border border-app-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-hi hover:bg-surface-2">
                          Remove dark image
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-text-lo">
                    Shown instead of the main image in dark mode. Works in Apple Mail, iOS Mail, Outlook.com, and Yahoo Mail.{" "}
                    <span className="font-medium">Gmail ignores this</span> — it always shows the main image.
                  </p>
                </Field>
                <Field label="Alt text">
                  <input value={selected.alt} onChange={(e) => updateBlock(selected.id, { alt: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Width (px)">
                  <input type="number" value={selected.width} onChange={(e) => updateBlock(selected.id, { width: Number(e.target.value) || 0 })} className={inputClass} />
                </Field>
                <Field label="Height (px)">
                  <input
                    type="number"
                    value={selected.height ?? ""}
                    onChange={(e) => updateBlock(selected.id, { height: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="Auto"
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-text-lo">
                    Leave blank to preserve the image's own aspect ratio. A set height crops to fill (not supported in Outlook desktop — it stretches instead).
                  </p>
                </Field>
                <Field label="Shape">
                  <select value={selected.shape || "square"} onChange={(e) => updateBlock(selected.id, { shape: e.target.value as ImageShape })} className={inputClass}>
                    <option value="square">Square</option>
                    <option value="rounded">Rounded corners</option>
                    <option value="circle">Circle</option>
                  </select>
                  <p className="mt-1 text-xs text-text-lo">Circle works best on a square photo (equal width and height) — otherwise it renders as a pill.</p>
                </Field>
                <Field label="Align">
                  <select value={selected.align} onChange={(e) => updateBlock(selected.id, { align: e.target.value as Align })} className={inputClass}>
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Left/Right padding (px)">
                    <input type="number" min="0" value={selected.paddingX || 0} onChange={(e) => updateBlock(selected.id, { paddingX: Number(e.target.value) || undefined })} className={inputClass} />
                  </Field>
                  <Field label="Top/Bottom padding (px)">
                    <input type="number" min="0" value={selected.paddingY || 0} onChange={(e) => updateBlock(selected.id, { paddingY: Number(e.target.value) || undefined })} className={inputClass} />
                  </Field>
                </div>
                <Field label="Link URL (tracked)">
                  <input
                    value={selected.linkUrl || ""}
                    onChange={(e) => updateBlock(selected.id, { linkUrl: e.target.value })}
                    placeholder="https://…"
                    className={inputClass}
                  />
                </Field>
                <Field label="Click label (optional)">
                  <input value={selected.linkLabel || ""} onChange={(e) => updateBlock(selected.id, { linkLabel: e.target.value })} className={inputClass} />
                </Field>
              </>
            )}

            {selected.type === "button" && (
              <>
                <Field label="Label">
                  <input value={selected.label} onChange={(e) => updateBlock(selected.id, { label: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Link URL (tracked)">
                  <input value={selected.url} onChange={(e) => updateBlock(selected.id, { url: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Background color">
                  <input type="color" value={selected.bgColor} onChange={(e) => updateBlock(selected.id, { bgColor: e.target.value })} className="h-9 w-full rounded-lg border border-app-border" />
                </Field>
                <Field label="Text color">
                  <input type="color" value={selected.textColor} onChange={(e) => updateBlock(selected.id, { textColor: e.target.value })} className="h-9 w-full rounded-lg border border-app-border" />
                </Field>
                <Field label="Align">
                  <select value={selected.align} onChange={(e) => updateBlock(selected.id, { align: e.target.value as Align })} className={inputClass}>
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </Field>
              </>
            )}

            {selected.type === "divider" && (
              <Field label="Color">
                <input type="color" value={selected.color} onChange={(e) => updateBlock(selected.id, { color: e.target.value })} className="h-9 w-full rounded-lg border border-app-border" />
              </Field>
            )}

            {selected.type === "spacer" && (
              <Field label="Height (px)">
                <input type="number" value={selected.height} onChange={(e) => updateBlock(selected.id, { height: Number(e.target.value) || 0 })} className={inputClass} />
              </Field>
            )}

            {selected.type === "social" && (
              <>
                <Field label="Icons">
                  <div className="space-y-2">
                    {selected.icons.map((icon, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <select
                          value={icon.icon}
                          onChange={(e) => {
                            const icons = [...selected.icons];
                            icons[idx] = { ...icons[idx], icon: e.target.value };
                            updateBlock(selected.id, { icons });
                          }}
                          className={inputClass}
                        >
                          {SOCIAL_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                        <input
                          value={icon.href}
                          onChange={(e) => {
                            const icons = [...selected.icons];
                            icons[idx] = { ...icons[idx], href: e.target.value };
                            updateBlock(selected.id, { icons });
                          }}
                          placeholder="https://…"
                          className={inputClass}
                        />
                        <button
                          onClick={() => updateBlock(selected.id, { icons: selected.icons.filter((_, i) => i !== idx) })}
                          className="text-text-lo hover:text-status-danger"
                        >
                          <Icon icon="solar:close-circle-broken" className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => updateBlock(selected.id, { icons: [...selected.icons, { icon: "linkedin", href: "#" }] })}
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      + Add icon
                    </button>
                  </div>
                </Field>
                <Field label="Align">
                  <select value={selected.align} onChange={(e) => updateBlock(selected.id, { align: e.target.value as Align })} className={inputClass}>
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </Field>
              </>
            )}

            {selected.type === "columns" && (
              <>
                <Field label="Number of columns">
                  <select
                    value={selected.columns.length}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      const columns = Array.from({ length: n }, (_, i) => selected.columns[i] || []);
                      const columnStyles = Array.from({ length: n }, (_, i) => selected.columnStyles[i] || {});
                      updateBlock(selected.id, { columns, columnStyles });
                    }}
                    className={inputClass}
                  >
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </Field>

                {selected.columns.map((_, idx) => {
                  const cs = selected.columnStyles[idx] || {};
                  const updateColumnStyle = (patch: Partial<ColumnStyle>) => {
                    const columnStyles = selected.columnStyles.map((s, i) => (i === idx ? { ...s, ...patch } : s));
                    updateBlock(selected.id, { columnStyles });
                  };
                  return (
                    <div key={idx} className="space-y-2 rounded-lg border border-app-border p-2.5">
                      <p className="text-xs font-medium text-text-hi">Column {idx + 1}</p>
                      <div className="flex flex-wrap gap-3">
                        {(["borderTop", "borderRight", "borderBottom", "borderLeft"] as const).map((side) => (
                          <label key={side} className="flex items-center gap-1 text-xs text-text-lo">
                            <input type="checkbox" checked={!!cs[side]} onChange={(e) => updateColumnStyle({ [side]: e.target.checked })} />
                            {side.replace("border", "")}
                          </label>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Border color">
                          <input type="color" value={cs.borderColor || "#e5e7eb"} onChange={(e) => updateColumnStyle({ borderColor: e.target.value })} className="h-8 w-full rounded-lg border border-app-border" />
                        </Field>
                        <Field label="Border width (px)">
                          <input type="number" min="1" value={cs.borderWidth || 2} onChange={(e) => updateColumnStyle({ borderWidth: Number(e.target.value) || 2 })} className={inputClass} />
                        </Field>
                        <Field label="Background">
                          <input type="color" value={cs.backgroundColor || "#ffffff"} onChange={(e) => updateColumnStyle({ backgroundColor: e.target.value })} className="h-8 w-full rounded-lg border border-app-border" />
                        </Field>
                      </div>
                      <Field label="Width (%)">
                        <input
                          type="number"
                          value={cs.width || ""}
                          onChange={(e) => updateColumnStyle({ width: e.target.value ? Number(e.target.value) : undefined })}
                          placeholder="Equal"
                          min={1}
                          max={99}
                          className={inputClass}
                        />
                        <p className="mt-1 text-xs text-text-lo">Leave blank for equal widths. Set one column and the rest fill the remainder.</p>
                      </Field>
                      <Field label="Padding (px)">
                        <input type="number" value={cs.padding || 0} onChange={(e) => updateColumnStyle({ padding: Number(e.target.value) || 0 })} className={inputClass} />
                      </Field>
                    </div>
                  );
                })}
              </>
            )}

            {selected.type === "html" && (
              <Field label="Raw HTML">
                <textarea value={selected.html} onChange={(e) => updateBlock(selected.id, { html: e.target.value })} rows={12} className={`${inputClass} font-mono text-xs`} />
              </Field>
            )}

            <button onClick={() => setSelectedId(null)} className="text-xs text-text-lo hover:text-text-hi">
              Done
            </button>
          </div>
        )}
      </div>

      <MediaPicker
        isOpen={!!pickerOpenFor}
        onClose={() => setPickerOpenFor(null)}
        onSelect={(url) => {
          if (pickerOpenFor) updateBlock(pickerOpenFor, { src: url });
          setPickerOpenFor(null);
        }}
      />
      <MediaPicker
        isOpen={!!darkPickerOpenFor}
        onClose={() => setDarkPickerOpenFor(null)}
        onSelect={(url) => {
          if (darkPickerOpenFor) updateBlock(darkPickerOpenFor, { darkSrc: url });
          setDarkPickerOpenFor(null);
        }}
      />

      <DragOverlay>
        {activeDragLabel && (
          <div className="flex items-center gap-2 rounded-lg border border-brand-500 bg-surface px-3 py-2 text-sm font-medium text-text-hi shadow-lg">
            <Icon icon="solar:add-circle-broken" className="h-4 w-4 text-brand-600" />
            {activeDragLabel}
          </div>
        )}
      </DragOverlay>
    </div>
    </DndContext>
  );
});

export default BlockEditor;

