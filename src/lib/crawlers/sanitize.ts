import sanitizeHtml from "sanitize-html";

const DESCRIPTION_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "ul",
    "ol",
    "li",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "a",
    "h1",
    "h2",
    "h3",
    "h4",
    "blockquote",
    "code",
    "pre",
    "span",
    "div",
    "hr",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ],
  allowedAttributes: {
    a: ["href", "rel", "target"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    a: transformAnchor,
  },
};

const MAX_HTML = 200_000;

function transformAnchor(_tagName: string, attribs: sanitizeHtml.Attributes): sanitizeHtml.Tag {
  const href = attribs.href ?? "";
  let safe = "";
  try {
    const url = new URL(href, "https://jobs.ashbyhq.com");
    if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:") {
      safe = url.protocol === "mailto:" ? href : url.toString();
    }
  } catch {
    safe = "";
  }
  if (!safe) return { tagName: "span", attribs: {} };
  return {
    tagName: "a",
    attribs: {
      href: safe,
      rel: "noopener noreferrer nofollow",
      target: "_blank",
    },
  };
}

export function sanitizeDescription(html: string | null | undefined): string | null {
  if (!html) return null;
  const cleaned = sanitizeHtml(html.slice(0, MAX_HTML), DESCRIPTION_OPTIONS).trim();
  return cleaned.length > 0 ? cleaned : null;
}

export function htmlToText(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > 0 ? text.slice(0, MAX_HTML) : null;
}

export function plainText(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return text.length > 0 ? text.slice(0, MAX_HTML) : null;
}
