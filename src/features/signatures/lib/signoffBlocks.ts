/**
 * The block-tree schema backing the custom drag-and-drop signature editor (replaces GrapesJS).
 * Stored in `signature_templates.blocks` (jsonb); `html` remains the rendered/sent source of
 * truth, regenerated from this tree via `serializeBlocks()` (see blockSerializer.ts).
 */

export type Align = "left" | "center" | "right";

export interface TextBlock {
  id: string;
  type: "text";
  html: string; // rich-text HTML, may contain {{merge_tags}}
}

export type ImageShape = "square" | "rounded" | "circle";

export interface ImageBlock {
  id: string;
  type: "image";
  src: string;
  darkSrc?: string; // alternate image shown in dark mode (Apple Mail, iOS Mail, Outlook.com — not Gmail)
  alt: string;
  width: number; // px
  height?: number; // px — unset means auto (preserve source aspect ratio)
  shape?: ImageShape; // unset behaves as "square"
  align: Align;
  paddingX?: number; // px — left/right spacing around the image
  paddingY?: number; // px — top/bottom spacing around the image
  linkUrl?: string;
  linkLabel?: string;
}

export interface ButtonBlock {
  id: string;
  type: "button";
  label: string;
  url: string;
  bgColor: string;
  textColor: string;
  align: Align;
}

export interface DividerBlock {
  id: string;
  type: "divider";
  color: string;
}

export interface SpacerBlock {
  id: string;
  type: "spacer";
  height: number; // px
}

export interface SocialIcon {
  icon: string; // e.g. "linkedin" — matches public/assets/icons/social/<icon>.png
  href: string;
}

export interface SocialBlock {
  id: string;
  type: "social";
  icons: SocialIcon[];
  align: Align;
}

export interface ColumnStyle {
  borderTop?: boolean;
  borderRight?: boolean;
  borderBottom?: boolean;
  borderLeft?: boolean;
  borderColor?: string;
  borderWidth?: number; // px width of borders (default 2)
  padding?: number;
  backgroundColor?: string;
  width?: number; // percentage (1–99); unset = equal split
}

export interface ColumnsBlock {
  id: string;
  type: "columns";
  columns: Block[][];
  // Index-aligned with `columns` — one style config per column (border sides, color, padding,
  // background). A vertical divider between columns, e.g., is just a left border on column 2+.
  columnStyles: ColumnStyle[];
}

/** Resolves each column's actual width percentage, so "set one column, the rest fill the
 * remainder" is an explicit calculation rather than left to whatever CSS/table layout happens to
 * do by default. Columns without an explicit `width` split whatever's left over equally; if the
 * explicit widths already add up to 100% or more, the rest just get 0 (an honest reflection of
 * there being no room left, rather than silently overflowing past 100%). Shared by the editor's
 * live preview and blockSerializer's HTML output so they never disagree with each other. */
export function computeColumnWidths(styles: ColumnStyle[]): number[] {
  const explicit = styles.reduce((sum, s) => sum + (s.width && s.width > 0 ? s.width : 0), 0);
  const unsetCount = styles.filter((s) => !s.width || s.width <= 0).length;
  const share = unsetCount > 0 ? Math.max(0, 100 - explicit) / unsetCount : 0;
  return styles.map((s) => (s.width && s.width > 0 ? s.width : share));
}

/** Legacy/advanced-escape-hatch block — raw HTML passed through as-is. Every template that
 * predates this editor (or has no `blocks` yet) is represented as a single block of this type,
 * wrapping its existing `html` column, so nothing is lost or forced to convert. */
export interface HtmlBlock {
  id: string;
  type: "html";
  html: string;
}

export type Block = TextBlock | ImageBlock | ButtonBlock | DividerBlock | SpacerBlock | SocialBlock | ColumnsBlock | HtmlBlock;

/** CSS border-radius for an image's `shape` — shared between the editor's live preview and
 * blockSerializer's HTML output so they never drift. A large fixed px value (rather than 50%)
 * for "circle" still renders as a full circle on a square image and degrades to a pill shape on
 * a non-square one, rather than an ellipse, which reads better if width/height aren't equal. */
export function imageBorderRadius(shape: ImageShape | undefined): string {
  if (shape === "circle") return "9999px";
  if (shape === "rounded") return "8px";
  return "0";
}

export function newBlockId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export function createBlock(type: Block["type"]): Block {
  const id = newBlockId();
  switch (type) {
    case "text":
      return { id, type, html: "<p>New text block — click to edit.</p>" };
    case "image":
      return { id, type, src: "", alt: "", width: 300, align: "left" };
    case "button":
      return { id, type, label: "Click here", url: "https://", bgColor: "#f05d23", textColor: "#ffffff", align: "left" };
    case "divider":
      return { id, type, color: "#e5e7eb" };
    case "spacer":
      return { id, type, height: 16 };
    case "social":
      return { id, type, icons: [], align: "left" };
    case "columns":
      return { id, type, columns: [[], []], columnStyles: [{}, {}] };
    case "html":
      return { id, type, html: "" };
  }
}

/** Wraps existing raw HTML as a single-block tree — the fallback for any template that has no
 * `blocks` yet (every template as of this editor's introduction). */
export function wrapLegacyHtml(html: string): Block[] {
  return [{ id: newBlockId(), type: "html", html }];
}

/** Identifies one column inside a specific `columns` block — the addressing scheme for
 * operations (add/reorder) that need to know *which* list they're acting on, since a `columns`
 * block can be nested arbitrarily deep alongside plain top-level blocks. */
export interface ColumnPath {
  columnsId: string;
  colIndex: number;
}

/** Depth-first search for a block by id, descending into any `columns` block's columns. */
export function findBlockById(blocks: Block[], id: string): Block | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    if (b.type === "columns") {
      for (const col of b.columns) {
        const found = findBlockById(col, id);
        if (found) return found;
      }
    }
  }
  return null;
}

/** Patches a block by id, wherever it lives in the tree. */
export function updateBlockById(blocks: Block[], id: string, patch: Partial<Block>): Block[] {
  return blocks.map((b) => {
    if (b.id === id) return { ...b, ...patch } as Block;
    if (b.type === "columns") return { ...b, columns: b.columns.map((col) => updateBlockById(col, id, patch)) };
    return b;
  });
}

/** Removes a block by id, wherever it lives in the tree. */
export function removeBlockById(blocks: Block[], id: string): Block[] {
  return blocks
    .filter((b) => b.id !== id)
    .map((b) => (b.type === "columns" ? { ...b, columns: b.columns.map((col) => removeBlockById(col, id)) } : b));
}

/** Splices `newBlock` right after the block with id `afterId`, wherever it lives in the tree.
 * `inserted` tells the caller whether `afterId` was actually found (so it can fall back to
 * appending at the top level otherwise). */
export function insertAfterId(blocks: Block[], afterId: string, newBlock: Block): { result: Block[]; inserted: boolean } {
  let inserted = false;
  const result = blocks.flatMap((b): Block[] => {
    if (b.id === afterId) {
      inserted = true;
      return [b, newBlock];
    }
    if (b.type === "columns") {
      const columns = b.columns.map((col) => {
        const r = insertAfterId(col, afterId, newBlock);
        if (r.inserted) inserted = true;
        return r.result;
      });
      return [{ ...b, columns }];
    }
    return [b];
  });
  return { result, inserted };
}

/** Applies `fn` to the block list at `path` (one specific column of one specific `columns`
 * block), wherever that block lives in the tree — used for reordering within, or adding into, a
 * single column. */
export function updateColumnList(blocks: Block[], path: ColumnPath, fn: (col: Block[]) => Block[]): Block[] {
  return blocks.map((b) => {
    if (b.id === path.columnsId && b.type === "columns") {
      const columns = b.columns.map((col, i) => (i === path.colIndex ? fn(col) : col));
      return { ...b, columns };
    }
    if (b.type === "columns") return { ...b, columns: b.columns.map((col) => updateColumnList(col, path, fn)) };
    return b;
  });
}

/** Reads the block list at `path` — the top level (`path: null`) or one specific column. */
export function getListAt(blocks: Block[], path: ColumnPath | null): Block[] {
  if (!path) return blocks;
  const owner = findBlockById(blocks, path.columnsId);
  return owner?.type === "columns" ? owner.columns[path.colIndex] || [] : [];
}

/** Finds which list a block id lives in — `null` for the top level, a `ColumnPath` for a
 * column, or `undefined` if the id isn't a block anywhere in the tree. Needed for cross-column
 * dragging, where the drop target's container isn't known ahead of time. */
export function findContainerPath(blocks: Block[], id: string, path: ColumnPath | null = null): ColumnPath | null | undefined {
  for (const b of blocks) {
    if (b.id === id) return path;
    if (b.type === "columns") {
      for (let i = 0; i < b.columns.length; i++) {
        const found = findContainerPath(b.columns[i], id, { columnsId: b.id, colIndex: i });
        if (found !== undefined) return found;
      }
    }
  }
  return undefined;
}

/** Like `removeBlockById`, but also hands back the removed block so it can be re-inserted
 * elsewhere (cross-column drag, essentially "cut"). */
export function removeBlockWithResult(blocks: Block[], id: string): { result: Block[]; removed: Block | null } {
  let removed: Block | null = null;
  const result = blocks
    .filter((b) => {
      if (b.id === id) {
        removed = b;
        return false;
      }
      return true;
    })
    .map((b) => {
      if (removed || b.type !== "columns") return b;
      const columns = b.columns.map((col) => {
        const r = removeBlockWithResult(col, id);
        if (r.removed) removed = r.removed;
        return r.result;
      });
      return { ...b, columns };
    });
  return { result, removed };
}

/** Inserts `block` at `index` in the list at `path` (top level or a specific column) —
 * `index` beyond the list's length appends. The "paste" half of a cross-column move. */
export function insertIntoList(blocks: Block[], path: ColumnPath | null, block: Block, index: number): Block[] {
  const insertAt = (list: Block[]) => {
    const next = [...list];
    next.splice(Math.min(index, next.length), 0, block);
    return next;
  };
  if (!path) return insertAt(blocks);
  return updateColumnList(blocks, path, insertAt);
}

function sameColumnPath(a: ColumnPath | null, b: ColumnPath | null): boolean {
  if (a === null || b === null) return a === b;
  return a.columnsId === b.columnsId && a.colIndex === b.colIndex;
}

export { sameColumnPath };

/** Deep-clones a block with fresh ids throughout (including anything nested inside a `columns`
 * block), so the clone and the original never share identity. */
export function cloneBlockWithNewIds(block: Block): Block {
  if (block.type === "columns") {
    return { ...block, id: newBlockId(), columns: block.columns.map((col) => col.map(cloneBlockWithNewIds)) };
  }
  return { ...block, id: newBlockId() };
}

