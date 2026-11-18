<template>
  <div v-if="hasImageButtons"><RenderedContent /></div>
  <div v-else v-html="sanitizeHtml(html)" />
</template>

<script setup lang="ts">
import { computed, createTextVNode, Fragment, h, type VNodeChild } from "vue";
import { DomUtils, ElementType, parseDocument } from "htmlparser2";
import CanonicalButton from "~/components/CanonicalButton.vue";
import { legacyImageButton, type CmsHtmlNode } from "~/utils/legacyImageButtons";
import { sanitizeHtml } from "~/utils/sanitizeHtml";

const props = defineProps<{ html?: string | null | undefined }>();
const { $t } = useNuxtApp();
const config = useRuntimeConfig();
// Detection never renders input. Both output paths sanitize independently; only
// candidate documents need the additional parsed tree for component rendering.
const document = computed(() => parseDocument(props.html || ""));
const safeDocument = computed(() => parseDocument(sanitizeHtml(props.html)));
const hasImageButtons = computed(() =>
  DomUtils.getElementsByTagName("a", document.value.children, true).some((node) =>
    legacyImageButton(node, config.public.clientDirectusUrl),
  ),
);

function renderNode(node: CmsHtmlNode): VNodeChild {
  if (node.type === ElementType.Text) return createTextVNode(node.data);
  if (node.type !== ElementType.Tag) return null;
  const button = legacyImageButton(node, config.public.clientDirectusUrl);
  if (button) {
    const label = $t(button.labelKey);
    const attrs = Object.fromEntries(
      Object.entries(node.attribs).filter(
        ([key]) =>
          ["id", "name", "download", "target", "rel"].includes(key) ||
          key.startsWith("data-") ||
          key.startsWith("aria-"),
      ),
    );
    if (attrs["aria-label"]) attrs["aria-label"] = label;
    return h(CanonicalButton, {
      ...attrs,
      href: node.attribs.href,
      ...(node.attribs.title ? { title: label } : {}),
      label,
      iconSlug: button.iconSlug,
      color: "green",
      wrapLabel: true,
      class: "not-prose",
      external: node.attribs.target === "_blank",
    });
  }
  const children: VNodeChild[] = [];
  // Browsers insert tbody for legacy tables with direct tr children. Emit the
  // same structure on the server and client to keep hydration deterministic.
  let rows: VNodeChild[] = [];
  const flushRows = () => {
    if (rows.length) children.push(h("tbody", null, rows));
    rows = [];
  };
  for (const child of node.children) {
    if (
      node.name === "table" &&
      ((child.type === ElementType.Tag && child.name === "tr") ||
        (rows.length > 0 && child.type === ElementType.Text && !child.data.trim()))
    )
      rows.push(renderNode(child));
    else {
      flushRows();
      children.push(renderNode(child));
    }
  }
  flushRows();
  return h(node.name, node.attribs, children);
}
function RenderedContent() {
  return h(Fragment, null, safeDocument.value.children.map(renderNode));
}
</script>
