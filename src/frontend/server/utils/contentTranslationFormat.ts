import { createHash } from "node:crypto";
import { parseDocument, ElementType, Parser } from "htmlparser2";
import renderHtml from "dom-serializer";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toMarkdown } from "mdast-util-to-markdown";
import { gfmFromMarkdown, gfmToMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import type { Nodes } from "mdast";
import type { TranslationSegment } from "./contentTranslation";

export type TranslationDocument = {
  texts: readonly string[];
  render: (lookup: (text: string) => string | undefined) => string | undefined;
};
const excludedHtml = new Set(["script", "style", "code", "pre", "svg", "math", "template", "iframe", "noscript"]);
const sentenceSegmenter = new Intl.Segmenter("de", { granularity: "sentence" });
const wordSegmenter = new Intl.Segmenter("de", { granularity: "word" });
const protectedPattern =
  /\[\[\[[\s\S]*?\]\]\]|\{\{[\s\S]*?\}\}|\$\{[^}]*\}|%\([^)]+\)[sd]|%[sd]|(?<![\w/]):[A-Za-z][A-Za-z0-9_]*\b/g;

/** Only natural-language text leaves are sent to DeepL. Markup, destinations, code,
 * placeholders and submitted values remain local, so provider output cannot rewrite them.
 */
export function prepareTranslationDocument(segment: TranslationSegment): TranslationDocument {
  const source = segment.text;
  const prefix = `SLKPROTECTED${createHash("sha256").update(source).digest("hex").slice(0, 16)}X`;
  const protectedValues: string[] = [];
  const protectedSource = source.replace(protectedPattern, (value) => `${prefix}${protectedValues.push(value) - 1}END`);
  const tokenPattern = new RegExp(`${prefix}\\d+END`, "g");
  const localPattern = new RegExp(
    `${prefix}\\d+END|https?:\\/\\/[^\\s<>"'\x60]+|[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}`,
    "g",
  );
  const restore = (value: string) =>
    value.replace(tokenPattern, (token) => protectedValues[Number(token.slice(prefix.length, -3))] ?? token);
  const texts = new Set<string>();
  const targets: { parts: (string | { text: string })[]; set: (value: string) => void }[] = [];

  function select(value: string, set: (value: string) => void) {
    const parts: (string | { text: string })[] = [];
    let offset = 0;
    const addText = (raw: string) => {
      // Stable sentences avoid re-billing an entire paragraph for a one-sentence edit.
      const paragraphs = raw.split(/(\n\s*\n)/);
      for (const paragraph of paragraphs) {
        for (const sentence of sentenceSegmenter.segment(paragraph)) {
          if (Array.from(sentence.segment).length <= 2000) addUnit(sentence.segment);
          else {
            let chunk = "";
            for (const word of wordSegmenter.segment(sentence.segment)) {
              if (Array.from(word.segment).length > 2000) throw new Error("Translation word exceeds unit limit");
              if (Array.from(chunk + word.segment).length > 2000) {
                addUnit(chunk);
                chunk = "";
              }
              chunk += word.segment;
            }
            addUnit(chunk);
          }
        }
      }
    };
    function addUnit(raw: string) {
      const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw)!;
      const text = match[2]!;
      if (!/\p{L}/u.test(text)) {
        parts.push(raw);
        return;
      }
      parts.push(match[1]!, { text }, match[3]!);
      texts.add(text);
    }
    for (const match of value.matchAll(localPattern)) {
      addText(value.slice(offset, match.index));
      parts.push(match[0]);
      offset = match.index + match[0].length;
    }
    addText(value.slice(offset));
    targets.push({ parts, set });
  }
  function html(value: string): () => string {
    const tree = parseDocument(value, { decodeEntities: true });
    type HtmlNode = (typeof tree.children)[number];
    function visit(node: HtmlNode, excluded = false) {
      if ("name" in node && "attribs" in node) {
        excluded ||=
          excludedHtml.has(node.name.toLowerCase()) ||
          (node.attribs.translate ?? "").toLowerCase() === "no" ||
          (node.attribs.class ?? "").split(/\s+/).includes("notranslate");
        if (!excluded)
          for (const attribute of ["alt", "title"]) {
            const value = node.attribs[attribute];
            if (value)
              select(value, (translated) => {
                node.attribs[attribute] = translated;
              });
          }
      }
      if (node.type === ElementType.Text && !excluded)
        select(node.data, (translated) => {
          node.data = translated;
        });
      if ("children" in node) for (const child of node.children) visit(child, excluded);
    }
    for (const node of tree.children) visit(node);
    return () => renderHtml(tree, { encodeEntities: "utf8" });
  }
  let serialize: () => string;
  if (segment.format === "html") serialize = html(protectedSource);
  else if (segment.format === "markdown") {
    const tree = fromMarkdown(protectedSource, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
    const inlineStack: { name: string; excluded: boolean }[] = [];
    const inlineExcluded = () => inlineStack.at(-1)?.excluded === true;
    const inlineParser = new Parser({
      onopentag(name, attributes) {
        inlineStack.push({
          name,
          excluded:
            inlineExcluded() ||
            excludedHtml.has(name) ||
            (attributes.translate ?? "").toLowerCase() === "no" ||
            (attributes.class ?? "").split(/\s+/).includes("notranslate"),
        });
      },
      onclosetag(name) {
        for (let index = inlineStack.length - 1; index >= 0; index--) {
          if (inlineStack[index]!.name === name) {
            inlineStack.splice(index);
            break;
          }
        }
      },
    });
    const inlineParents = new Set([
      "paragraph",
      "heading",
      "emphasis",
      "strong",
      "link",
      "linkReference",
      "tableCell",
      "delete",
    ]);
    function visit(node: Nodes, parentType = "root") {
      if (node.type === "html") {
        if (inlineParents.has(parentType)) {
          const excluded = inlineExcluded();
          inlineParser.write(node.value);
          // Inline opening/closing tags are separate mdast nodes. Preserve those boundaries;
          // parsing an opening tag as a complete document would invent a closing tag.
          if (
            !excluded &&
            !inlineExcluded() &&
            /^\s*<[a-z]/i.test(node.value) &&
            /\b(?:alt|title)\s*=/i.test(node.value)
          ) {
            const sourceTag = node.value;
            const name = /^\s*<([a-z][\w:-]*)/i.exec(sourceTag)?.[1]?.toLowerCase();
            const render = html(sourceTag);
            htmlCommits.push(() => {
              const rendered = render();
              const closing = `</${name}>`;
              node.value =
                name && !new RegExp(`</${name}\\s*>`, "i").test(sourceTag) && rendered.endsWith(closing)
                  ? rendered.slice(0, -closing.length)
                  : rendered;
            });
          }
        } else {
          const render = html(node.value);
          htmlCommits.push(() => {
            node.value = render();
          });
        }
        return;
      }
      if (inlineExcluded()) {
        if ("children" in node) for (const child of node.children) visit(child, node.type);
        return;
      }
      if (node.type === "text")
        select(node.value, (translated) => {
          node.value = translated;
        });
      else if (node.type === "image" || node.type === "imageReference") {
        if (node.alt)
          select(node.alt, (translated) => {
            node.alt = translated;
          });
        if (node.type === "image" && node.title)
          select(node.title, (translated) => {
            node.title = translated;
          });
      } else if (node.type === "link" || node.type === "definition") {
        if (node.title)
          select(node.title, (translated) => {
            node.title = translated;
          });
      }
      if ("children" in node) for (const child of node.children) visit(child, node.type);
    }
    const htmlCommits: (() => void)[] = [];
    visit(tree);
    serialize = () => {
      for (const commit of htmlCommits) commit();
      return toMarkdown(tree, { bullet: "-", fences: true, extensions: [gfmToMarkdown()] });
    };
  } else {
    let value = protectedSource;
    select(value, (translated) => {
      value = translated;
    });
    serialize = () => value;
  }
  return {
    texts: [...texts],
    render(lookup) {
      if (!texts.size) return source;
      const translated = new Map<string, string>();
      for (const text of texts) {
        const value = lookup(text);
        if (value === undefined) return undefined;
        // This is text, never markup. HTML/Markdown serializers escape provider syntax.
        if (
          !value.trim() ||
          value.length > 10_000 ||
          value.includes(prefix) ||
          /\[\[\[|\{\{|\$\{|https?:\/\//.test(value)
        )
          throw new Error("Invalid translated text");
        translated.set(text, value.trim());
      }
      for (const target of targets)
        target.set(target.parts.map((part) => (typeof part === "string" ? part : translated.get(part.text)!)).join(""));
      return restore(serialize());
    },
  };
}
