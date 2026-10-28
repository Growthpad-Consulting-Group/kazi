import sanitizeHtml from "sanitize-html";

const MERGE_TAGS = ["full_name", "email", "role_title", "department", "phone", "mobile", "photo_url"] as const;
const markerFor = (tag: string) => `https://kazi.invalid/merge/${tag}`;

/**
 * Email signatures need table-based HTML and inline styles, but never scripts,
 * event handlers, embeds, forms, or arbitrary URL protocols. Preserve known
 * merge tags through sanitisation so per-staff values still work after saving.
 */
export function sanitizeSignatureHtml(html: string) {
  let prepared = html;
  for (const tag of MERGE_TAGS) {
    prepared = prepared.replaceAll(`{{${tag}}}`, markerFor(tag));
  }

  const safe = sanitizeHtml(prepared, {
    allowedTags: ["a", "b", "br", "div", "em", "h1", "h2", "h3", "h4", "i", "img", "li", "ol", "p", "span", "strong", "table", "tbody", "td", "th", "thead", "tr", "ul"],
    allowedAttributes: {
      "*": ["align", "class", "height", "style", "width"],
      a: ["href", "name", "target", "title"],
      img: ["alt", "height", "src", "title", "width"],
      table: ["border", "cellpadding", "cellspacing", "role"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel", "cid", "data"],
    allowedSchemesByTag: { img: ["http", "https", "cid", "data"] },
    allowedStyles: {
      "*": {
        "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i, /^transparent$/i],
        "border": [/^[\w\s#().,%/-]+$/],
        "border-radius": [/^[\d.]+(px|%|em|rem)$/],
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i],
        display: [/^(block|inline|inline-block|none|table|table-cell)$/],
        "font-family": [/^[\w\s,\-"']+$/],
        "font-size": [/^[\d.]+(px|em|rem|pt|%)$/],
        "font-weight": [/^(normal|bold|[1-9]00)$/],
        height: [/^[\d.]+(px|%|em|rem)$/],
        "line-height": [/^[\d.]+(px|em|rem|%)?$/],
        margin: [/^[\d.\s%a-z]+$/i],
        "max-width": [/^[\d.]+(px|%)$/],
        "min-width": [/^[\d.]+(px|%)$/],
        "object-fit": [/^(cover|contain|fill)$/],
        overflow: [/^(hidden|visible)$/],
        padding: [/^[\d.\s%a-z]+$/i],
        "text-align": [/^(left|center|right)$/],
        "text-decoration": [/^(none|underline)$/],
        "vertical-align": [/^(top|middle|bottom)$/],
        width: [/^[\d.]+(px|%)$/],
      },
    },
  });

  return MERGE_TAGS.reduce((value, tag) => value.replaceAll(markerFor(tag), `{{${tag}}}`), safe);
}
