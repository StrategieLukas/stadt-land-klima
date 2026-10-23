<template>
  <figure :id="'block-' + uuid" class="blokkli-block-image" :class="[sizeClass]">
    <!-- Conditional link wrapper -->
    <component :is="linkTag" v-bind="linkAttrs" :class="options.linkType !== 'none' && !isEditing ? 'block' : ''">
      <!-- v-blokkli-droppable:imageId enables drag-and-drop and media library selection -->
      <div v-blokkli-droppable:imageId class="relative">
        <SmartImg
          v-if="props.imageId"
          :asset-id="props.imageId"
          :alt="props.alt || ''"
          img-class="w-full h-auto rounded"
          :width="1200"
          :quality="80"
          fit="contain"
        />
        <!-- Placeholder shown when no image is selected -->
        <div
          v-else
          class="bg-gray-100 border-gray-300 text-gray-400 flex min-h-[12rem] items-center justify-center rounded border-2 border-dashed"
        >
          <span class="text-sm">Bild aus Medienbibliothek auswählen oder hierher ziehen</span>
        </div>
      </div>
    </component>
    <figcaption
      v-if="props.caption || isEditing"
      v-blokkli-editable:caption
      class="mt-2 text-center text-sm italic text-gray"
      v-text="props.caption"
    />
  </figure>
</template>

<script setup lang="ts">
import { resolveComponent } from "vue";
import { resolveBlokkliInternalLink } from "~/utils/blokkliLinks";

const isEditing = import.meta.blokkliEditing;

const { options, uuid } = defineBlokkli({
  bundle: "image",
  propsFieldMapping: {
    caption: { name: "caption", type: "editable" },
    imageId: { name: "imageId", type: "droppable" },
  },
  options: {
    size: {
      type: "radios",
      label: "Größe",
      default: "full",
      options: {
        small: "Klein (25%)",
        medium: "Mittel (50%)",
        large: "Groß (75%)",
        full: "Volle Breite",
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
  },
  editor: {
    addBehaviour: "no-form",
    editTitle: () => "Bild",
    mockProps: () => {
      return { imageId: "", alt: "", caption: "" };
    },
  },
});

const props = defineProps<{
  imageId?: string | undefined;
  alt?: string | undefined;
  caption?: string | undefined;
}>();

const sizeClass = computed(() => {
  const map: Record<string, string> = {
    small: "max-w-xs mx-auto",
    medium: "max-w-md mx-auto",
    large: "max-w-3xl mx-auto",
    full: "max-w-full",
  };
  return map[options.value.size] || "max-w-full";
});

const linkTag = computed(() => {
  if (isEditing) return "div";
  if (options.value.linkType === "external") return "a";
  if (options.value.linkType === "internal") return resolveComponent("NuxtLink");
  return "div";
});

const linkAttrs = computed(() => {
  if (isEditing || options.value.linkType === "none") return {};
  const lv = options.value.link || "#";
  if (options.value.linkType === "external") {
    return { href: lv, target: "_blank", rel: "noopener noreferrer" };
  }
  return { to: resolveBlokkliInternalLink(lv) };
});
</script>

<style scoped>
.blokkli-block-image {
  margin: 1rem 0;
}

.blokkli-block-image img {
  display: block;
}
</style>
