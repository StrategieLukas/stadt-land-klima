<template>
  <div :id="'block-' + uuid" class="blokkli-block-citation">
    <!-- Blockquote style -->
    <component
      :is="linkTag"
      v-bind="linkAttrs"
      v-if="options.style === 'blockquote'"
      class="relative block py-2 pl-6 no-underline"
      :class="borderLeftClass"
    >
      <Icon icon="mdi:format-quote-open" class="mb-2 h-8 w-8 opacity-30" :class="accentTextClass" />
      <p v-blokkli-editable:quote class="mb-3 text-lg leading-relaxed italic" v-text="props.quote" />
      <footer>
        <cite
          v-if="props.attribution || isEditing"
          v-blokkli-editable:attribution
          class="block text-sm font-semibold not-italic"
          v-text="props.attribution"
        />
        <span v-if="options.author" class="block text-sm opacity-80" v-text="options.author" />
        <span
          v-if="props.source || isEditing"
          v-blokkli-editable:source
          class="block text-sm opacity-70"
          v-text="props.source"
        />
      </footer>
    </component>

    <!-- Card style -->
    <component
      :is="linkTag"
      v-bind="linkAttrs"
      v-else-if="options.style === 'card'"
      class="block rounded-xl border-t-4 bg-white p-6 no-underline shadow-md"
      :class="accentBorderTopClass"
    >
      <Icon icon="mdi:format-quote-open" class="mb-3 h-8 w-8 opacity-40" :class="accentTextClass" />
      <p v-blokkli-editable:quote class="mb-4 text-base leading-relaxed italic" v-text="props.quote" />
      <div class="mt-4 flex items-center gap-3 border-t border-gray-100 pt-4">
        <div v-blokkli-droppable:imageId class="shrink-0">
          <SmartImg
            v-if="props.imageId"
            :asset-id="props.imageId"
            alt=""
            img-class="w-12 h-12 rounded-full object-cover"
            :width="100"
            :height="100"
            :quality="80"
            fit="cover"
          />
          <div
            v-else-if="isEditing"
            class="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-gray-100 text-xs text-gray-400"
          >
            Foto
          </div>
        </div>
        <div>
          <cite
            v-if="props.attribution || isEditing"
            v-blokkli-editable:attribution
            class="block text-sm font-semibold not-italic"
            v-text="props.attribution"
          />
          <span v-if="options.author" class="block text-sm opacity-80" v-text="options.author" />
          <span
            v-if="props.source || isEditing"
            v-blokkli-editable:source
            class="text-sm opacity-70"
            v-text="props.source"
          />
        </div>
      </div>
    </component>

    <!-- Pull-quote style -->
    <component :is="linkTag" v-bind="linkAttrs" v-else class="block px-6 py-8 text-center no-underline">
      <Icon icon="mdi:format-quote-open" class="mx-auto mb-3 h-12 w-12 opacity-20" :class="accentTextClass" />
      <p
        v-blokkli-editable:quote
        class="mb-2 text-2xl leading-snug font-semibold md:text-3xl"
        :class="accentTextClass"
        v-text="props.quote"
      />
      <Icon icon="mdi:format-quote-close" class="mx-auto mt-3 h-12 w-12 opacity-20" :class="accentTextClass" />
      <div class="mt-5">
        <cite
          v-if="props.attribution || isEditing"
          v-blokkli-editable:attribution
          class="block text-sm font-semibold not-italic"
          v-text="props.attribution"
        />
        <span v-if="options.author" class="block text-sm opacity-80" v-text="options.author" />
        <span
          v-if="props.source || isEditing"
          v-blokkli-editable:source
          class="text-sm opacity-70"
          v-text="props.source"
        />
      </div>
    </component>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { resolveComponent } from "vue";

const isEditing = import.meta.blokkliEditing;

const { options, uuid } = defineBlokkli({
  bundle: "citation",
  propsFieldMapping: {
    quote: { name: "quote", type: "editable" },
    attribution: { name: "attribution", type: "editable" },
    source: { name: "source", type: "editable" },
    imageId: { name: "imageId", type: "droppable" },
  },
  options: {
    style: {
      type: "radios",
      label: "Stil",
      default: "blockquote",
      options: {
        blockquote: "Zitat (links)",
        card: "Karte",
        pull: "Pull-Quote",
      },
    },
    accentColor: {
      type: "radios",
      label: "Akzentfarbe",
      default: "green",
      displayAs: "colors",
      options: {
        green: { label: "Grün", hex: "#1da64a" },
        blue: { label: "Blau", hex: "#16bae7" },
        dark: { label: "Dunkelblau", hex: "#006e94" },
        orange: { label: "Orange", hex: "#f39200" },
      },
    },
    linkType: {
      type: "radios",
      label: "Link-Typ",
      default: "none",
      options: {
        none: "Kein",
        internal: "Intern",
        external: "Extern",
      },
    },
    link: {
      type: "text",
      label: "Link (Slug oder URL)",
      default: "",
      inputType: "text",
    },
    author: {
      type: "text",
      label: "Rolle / Titel (z.B. Bürgermeisterin)",
      default: "",
      inputType: "text",
    },
  },
  editor: {
    addBehaviour: "editable:quote",
    editTitle: (el) => el.textContent?.trim().slice(0, 40) || "Zitat",
    mockProps: () => {
      return { quote: "Zitat hier eingeben...", attribution: "Name", source: "Quelle / Organisation", imageId: "" };
    },
  },
});

const props = defineProps<{
  quote?: string | undefined;
  attribution?: string | undefined;
  source?: string | undefined;
  imageId?: string | undefined;
}>();

const linkTag = computed(() => {
  if (isEditing) return "div";
  if (options.value.linkType === "external") return "a";
  if (options.value.linkType === "internal") return resolveComponent("NuxtLink");
  return options.value.style === "blockquote" ? "blockquote" : "div";
});

const linkAttrs = computed(() => {
  if (isEditing || options.value.linkType === "none") return {};
  const lv = options.value.link || "#";
  if (options.value.linkType === "external") {
    return { href: lv, target: "_blank", rel: "noopener noreferrer" };
  }
  return { to: "/" + lv.replace(/^\//, "") };
});

const accentTextClass = computed(() => {
  const map: Record<string, string> = {
    green: "text-ff-green",
    blue: "text-light-blue",
    dark: "text-stats-dark",
    orange: "text-orange",
  };
  return map[options.value.accentColor] || "text-ff-green";
});

const borderLeftClass = computed(() => {
  const map: Record<string, string> = {
    green: "border-l-4 border-ff-green",
    blue: "border-l-4 border-light-blue",
    dark: "border-l-4 border-stats-dark",
    orange: "border-l-4 border-orange",
  };
  return map[options.value.accentColor] || "border-l-4 border-ff-green";
});

const accentBorderTopClass = computed(() => {
  const map: Record<string, string> = {
    green: "border-ff-green",
    blue: "border-light-blue",
    dark: "border-stats-dark",
    orange: "border-orange",
  };
  return map[options.value.accentColor] || "border-ff-green";
});
</script>

<style scoped>
.blokkli-block-citation {
  width: 100%;
  margin: 1rem 0;
}
</style>
