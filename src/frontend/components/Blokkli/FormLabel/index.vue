<template>
  <span :id="'block-' + uuid" class="blokkli-block-form-label block">
    <span v-blokkli-editable:text class="block" v-text="props.text" />
    <span
      v-if="props.description || isEditing"
      v-blokkli-editable:description
      class="text-gray-500 mt-1 block text-xs font-normal"
      v-text="props.description"
    />
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  text?: string;
  description?: string;
}>();

const isEditing = import.meta.blokkliEditing

const { uuid } = defineBlokkli({
  bundle: "form_label",
  propsFieldMapping: {
    text: { name: 'text', type: 'editable' },
    description: { name: 'description', type: 'editable' },
  },
  editor: {
    addBehaviour: "editable:text",
    editTitle: (el) => {
      return el.textContent?.trim() || "Beschriftung";
    },
    mockProps: () => {
      return { text: "Feldbeschriftung", description: "" };
    },
  },
});
</script>
