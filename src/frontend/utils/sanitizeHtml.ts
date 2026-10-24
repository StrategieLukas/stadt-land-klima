import sanitize from "sanitize-html";
import { decodeHTML } from "entities";

/** The same parser and allowlist run during SSR and in the browser. */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return "";
  return sanitize(dirty, {
    allowedTags: [...sanitize.defaults.allowedTags, "img", "figure", "figcaption"],
    allowedAttributes: {
      "*": ["class", "id", "role", "aria-*", "data-*", "style"],
      a: ["href", "name", "target", "rel", "download", "title"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
    },
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^[a-z]+$/i],
        "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^[a-z]+$/i],
        "text-align": [/^(left|right|center|justify)$/],
        "font-weight": [/^(normal|bold|[1-9]00)$/],
        "font-style": [/^(normal|italic)$/],
        "text-decoration": [/^(none|underline|line-through)$/],
      },
    },
    allowedSchemes: ["https", "http", "mailto", "tel"],
    allowProtocolRelative: false,
    nonTextTags: ["script", "style", "textarea", "option", "xmp", "iframe", "object", "embed"],
    transformTags: {
      a: (_tag, attributes) => ({
        tagName: "a",
        attribs: {
          ...attributes,
          ...(attributes.target === "_blank" ? { rel: "noopener noreferrer" } : {}),
        },
      }),
    },
  });
}

/**
 * Sanitizes a short text value that may contain HTML entities or markdown-rendered
 * content. Strips all tags and returns plain text.
 */
export function sanitizeText(dirty: string | null | undefined): string {
  if (!dirty) return "";
  return decodeHTML(sanitize(sanitizeHtml(dirty), { allowedTags: [], allowedAttributes: {} }));
}

/** Static navigation icons: geometry only; no animation, links, external resources or foreign HTML. */
export function sanitizeSvg(dirty: string | null | undefined): string {
  if (!dirty) return "";
  return sanitize(dirty, {
    allowedTags: ["svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "title", "desc"],
    allowedAttributes: {
      "*": [
        "xmlns",
        "viewBox",
        "width",
        "height",
        "d",
        "fill",
        "fill-rule",
        "clip-rule",
        "stroke",
        "stroke-width",
        "stroke-linecap",
        "stroke-linejoin",
        "stroke-miterlimit",
        "opacity",
        "fill-opacity",
        "stroke-opacity",
        "transform",
        "x",
        "y",
        "x1",
        "y1",
        "x2",
        "y2",
        "cx",
        "cy",
        "r",
        "rx",
        "ry",
        "points",
        "class",
        "role",
        "aria-hidden",
        "aria-label",
        "focusable",
      ],
    },
    parser: { lowerCaseAttributeNames: false },
    transformTags: {
      "*": (tagName, attributes) => {
        for (const key of ["fill", "stroke"]) {
          const value = attributes[key];
          if (value && !/^(?:none|currentColor|transparent|[a-z]+|#[a-f0-9]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(value))
            delete attributes[key];
        }
        return { tagName, attribs: attributes };
      },
    },
    nonTextTags: ["script", "style", "foreignObject"],
  });
}
