import type { Block } from "./signoffBlocks";
import { computeColumnWidths, imageBorderRadius } from "./signoffBlocks";
import {
  buildTrackedLinkHref,
  normalizeUrl,
  SIGNATURE_LINK_BASE_URL,
} from "./signoffTrackedLink";

// SIGNATURE_LINK_BASE_URL, not NEXT_PUBLIC_APP_URL — this gets baked into stored template html the
// moment a social row is added, from whichever environment happened to be editing (see
// trackedLink.ts's comment on the same gotcha for tracked links).
const SOCIAL_ICON = (icon: string) =>
  `${SIGNATURE_LINK_BASE_URL}/assets/icons/social/${icon}.png`;

const ALIGN_TD = (align: "left" | "center" | "right") =>
  align === "left" ? "" : `text-align:${align};`;

/** If `html` is a single merge tag and nothing else (ignoring surrounding tags/whitespace, e.g.
 * `createContactRow`'s `<p>{{mobile}}</p>`), returns that tag's name — otherwise null. Used to
 * mark a "columns" row built around exactly one per-staff field, so renderSignatureHtml can drop
 * the whole row (icon + spacer included) for staff it doesn't apply to, instead of shipping empty
 * icon/table markup to everyone just because one field was left blank. */
function soleMergeTag(html: string): string | null {
  const stripped = html.replace(/<[^>]*>/g, "").trim();
  const m = /^\{\{\s*([a-z_]+)\s*\}\}$/i.exec(stripped);
  return m ? m[1].toLowerCase() : null;
}

/** Wraps `inner` in a tracked-click href, if `templateId` + `linkUrl` are both present and valid. Falls back to a plain (untracked) link, then to no link at all. */
function trackedOrPlainHref(
  templateId: string | undefined,
  linkUrl: string | undefined,
  linkLabel: string | undefined,
): string | null {
  if (!linkUrl?.trim()) return null;
  let normalized: string;
  try {
    normalized = normalizeUrl(linkUrl);
  } catch {
    return null;
  }
  return templateId
    ? buildTrackedLinkHref(templateId, normalized, linkLabel || "")
    : normalized;
}

function serializeBlock(block: Block, templateId?: string): string {
  switch (block.type) {
    case "text":
      return `<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;">${block.html}</td></tr>`;

    case "image": {
      // object-fit crops to the given height while filling the width — supported by Gmail,
      // Apple Mail, and mobile clients, but not Outlook desktop (its Word-based renderer just
      // stretches/distorts instead of cropping). No workaround for that short of shipping a
      // pre-cropped image; a known, unavoidable email-client gap, not a bug here.
      const actualHeight =
        block.height || (block.shape === "circle" ? block.width : undefined);
      const heightStyle = actualHeight
        ? `height:${actualHeight}px;object-fit:cover;`
        : "";
      // Outlook desktop's Word-based renderer ignores border-radius on <img> same as it ignores
      // object-fit above — Gmail/Apple Mail/mobile clients render it fine. Same accepted gap.
      const radius = imageBorderRadius(block.shape);
      const sizeAttrs = `width="${block.width}" ${actualHeight ? `height="${actualHeight}"` : ""}`;
      const sizeStyle = `display:block;width:${block.width}px;max-width:100%;${heightStyle}border-radius:${radius};border:0;`;

      const wrapRadius = (imgTag: string) =>
        radius === "0"
          ? imgTag
          : `<span style="display:inline-block;overflow:hidden;border-radius:${radius};width:${block.width}px;${actualHeight ? `height:${actualHeight}px;` : ""}line-height:0;">${imgTag}</span>`;

      const href = trackedOrPlainHref(
        templateId,
        block.linkUrl,
        block.linkLabel,
      );
      const anchorStyle = `display:block;width:${block.width}px;max-width:100%;${block.height ? `height:${block.height}px;` : ""}`;

      const paddingStyle =
        block.paddingY || block.paddingX
          ? `padding:${block.paddingY || 0}px ${block.paddingX || 0}px;`
          : "";

      if (block.darkSrc) {
        // Dark-mode image swap: show darkSrc in dark mode, src in light mode.
        // Works in Apple Mail, iOS Mail, Outlook.com, Yahoo Mail. Gmail ignores @media entirely
        // and falls back to the light image — no workaround exists for Gmail.
        const lightImg = `<img src="${block.src}" alt="${block.alt}" ${sizeAttrs} class="img-light" style="${sizeStyle}" />`;
        const darkImg = `<img src="${block.darkSrc}" alt="${block.alt}" ${sizeAttrs} class="img-dark" style="${sizeStyle}display:none;" />`;
        // Gmail's sanitizer strips border-radius off a raw <img>; wrap for rounded/circle shapes.
        const lightWrapped = wrapRadius(lightImg);
        const darkWrapped = wrapRadius(darkImg);
        const lightContent = href
          ? `<a href="${href}" style="${anchorStyle}">${lightWrapped}</a>`
          : lightWrapped;
        const darkContent = href
          ? `<a href="${href}" style="${anchorStyle}">${darkWrapped}</a>`
          : darkWrapped;
        // The <style> block must be inline (not in <head>) because most email clients strip <head>.
        // Gmail ignores <style> in the body too, so this gracefully degrades to the light image.
        const styleTag = `<style>.img-dark{display:none!important;}@media(prefers-color-scheme:dark){.img-light{display:none!important;}.img-dark{display:block!important;}}</style>`;
        return `<tr><td style="${paddingStyle}${ALIGN_TD(block.align)}">${styleTag}${lightContent}${darkContent}</td></tr>`;
      }

      const img = `<img src="${block.src}" alt="${block.alt}" ${sizeAttrs} style="${sizeStyle}" />`;
      // Gmail's own signature-settings sanitizer (a different code path than how it renders a
      // *received* message body) is known to strip border-radius off a raw <img> — it survives
      // more reliably on a wrapping element, so a rounded/circle image also gets clipped via an
      // overflow:hidden span with the same radius, not just the <img>'s own style.
      const wrappedImg = wrapRadius(img);
      // The anchor needs its own explicit size matching the image — without one, wrapping a
      // block-level <img> in a bare <a> makes most mail clients block-ify the anchor too, and it
      // then stretches to fill the <td> (which itself expands to the table's width:100%), so the
      // clickable area extends well past the visible image into any empty space beside it.
      const content = href
        ? `<a href="${href}" style="${anchorStyle}">${wrappedImg}</a>`
        : wrappedImg;
      return `<tr><td style="${paddingStyle}${ALIGN_TD(block.align)}">${content}</td></tr>`;
    }

    case "button": {
      const href =
        trackedOrPlainHref(templateId, block.url, block.label) || "#";
      return `<tr><td style="${ALIGN_TD(block.align)}">
        <table cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:${block.bgColor};border-radius:6px;padding:10px 20px;">
          <a href="${href}" style="color:${block.textColor};font-size:13px;font-weight:bold;text-decoration:none;">${block.label}</a>
        </td></tr></table>
      </td></tr>`;
    }

    case "divider":
      return `<tr><td style="padding:8px 0;"><div style="border-top:1px solid ${block.color};line-height:0;font-size:0;">&nbsp;</div></td></tr>`;

    case "spacer":
      return `<tr><td style="height:${block.height}px;line-height:${block.height}px;font-size:0;">&nbsp;</td></tr>`;

    case "social": {
      if (block.icons.length === 0) return "";
      const iconsHtml = block.icons
        .map(
          (i, idx) =>
            `<td style="${idx > 0 ? "padding-left:8px;" : ""}"><a href="${i.href}"><img src="${SOCIAL_ICON(i.icon)}" width="20" height="20" alt="${i.icon}" style="display:block;" /></a></td>`,
        )
        .join("");
      return `<tr><td style="${ALIGN_TD(block.align)}"><table cellpadding="0" cellspacing="0" border="0" style="${block.align === "center" ? "margin:0 auto;" : block.align === "right" ? "margin-left:auto;" : ""}"><tr>${iconsHtml}</tr></table></td></tr>`;
    }

    case "columns": {
      const widths = computeColumnWidths(block.columnStyles);
      const tds = block.columns
        .map((col, idx) => {
          const cs = block.columnStyles[idx] || {};
          const borderColor = cs.borderColor || "#e5e7eb";
          const borderWidth = cs.borderWidth || 2;
          const style = [
            "vertical-align:top",
            `width:${widths[idx]}%`,
            idx < block.columns.length - 1 ? "padding-right:12px" : "",
            cs.padding ? `padding:${cs.padding}px` : "",
            cs.backgroundColor ? `background-color:${cs.backgroundColor}` : "",
            cs.borderTop
              ? `border-top:${borderWidth}px solid ${borderColor}`
              : "",
            cs.borderRight
              ? `border-right:${borderWidth}px solid ${borderColor}`
              : "",
            cs.borderBottom
              ? `border-bottom:${borderWidth}px solid ${borderColor}`
              : "",
            cs.borderLeft
              ? `border-left:${borderWidth}px solid ${borderColor}`
              : "",
          ]
            .filter(Boolean)
            .join(";");
          return `<td style="${style};"><table cellpadding="0" cellspacing="0" border="0" width="100%">${col.map((b) => serializeBlock(b, templateId)).join("")}</table></td>`;
        })
        .join("");
      // A row built around exactly one per-staff field (e.g. createContactRow's icon+{{mobile}}
      // pair) gets tagged so renderSignatureHtml can drop the entire row for staff that field is
      // blank for, rather than paying for the icon/table markup on every signature regardless.
      const soleTags = block.columns
        .flatMap((col) =>
          col.filter(
            (b): b is Extract<Block, { type: "text" }> => b.type === "text",
          ),
        )
        .map((b) => soleMergeTag(b.html))
        .filter((t): t is string => !!t);
      const marker =
        soleTags.length === 1 ? ` data-mt-row="${soleTags[0]}"` : "";
      return `<tr${marker}><td><table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>${tds}</tr></table></td></tr>`;
    }

    case "html":
      // Passed through verbatim — this is the escape hatch for legacy/advanced content.
      return block.html;
  }
}

/** The canvas/export width when a template hasn't set its own — a real signature width, not the
 * wide canvas shown while editing. Shared with BlockEditor's live preview so they always agree. */
export const DEFAULT_CANVAS_WIDTH = 600;

/**
 * Renders a block tree into inline-styled, table-based HTML — the only layout rules email
 * clients actually respect (Outlook renders with Word's engine: no flexbox/grid, no external
 * stylesheets). This becomes the new `html` column value, the same role GrapesJS's
 * `editor.getHtml()` played before. `canvasWidth` is the "master" width nothing inside is meant
 * to exceed — set as a real pixel width on the outer table (not just 100%, which would let the
 * signature stretch to whatever width the recipient's mail client gives it).
 */
export function serializeBlocks(
  blocks: Block[],
  templateId?: string,
  canvasWidth: number = DEFAULT_CANVAS_WIDTH,
): string {
  // A lone "html" block (the legacy-template case) needs no outer wrapping table — it's
  // typically already a complete `<table>...</table>` document on its own.
  if (blocks.length === 1 && blocks[0].type === "html") {
    return blocks[0].html;
  }

  const rows = blocks.map((b) => serializeBlock(b, templateId)).join("\n");
  return `<table cellpadding="0" cellspacing="0" border="0" width="${canvasWidth}" style="width:${canvasWidth}px;max-width:100%;">\n${rows}\n</table>`;
}
