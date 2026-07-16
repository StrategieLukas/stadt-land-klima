<template>
  <div :id="'block-' + uuid" class="blokkli-block-form-field" :class="widthClass">
    <div v-if="fieldType === 'checkbox'" class="flex items-start gap-3">
      <input
        :id="inputId"
        :name="inputName"
        type="checkbox"
        value="yes"
        class="border-gray-300 checkbox checkbox-sm mt-1 shrink-0"
        :required="isRequired"
        :disabled="isEditing"
      />
      <label :for="inputId" class="text-gray-700 min-w-0 text-sm">
        <span class="inline-flex min-w-0 items-start gap-1">
          <span class="min-w-0">
            <BlokkliField v-if="hasLabelBlocks || isEditing" name="label" :list="props.label || []" tag="span" />
            <span v-if="!hasLabelBlocks && isEditing" class="text-gray-400">
              {{ $t("form_block.field.label_placeholder") }}
            </span>
          </span>
          <span v-if="isRequired" class="text-red-500">*</span>
        </span>
      </label>
    </div>

    <template v-else>
      <label :for="inputId" class="text-gray-700 mb-1 block text-sm font-medium">
        <span class="inline-flex min-w-0 items-start gap-1">
          <span class="min-w-0">
            <BlokkliField v-if="hasLabelBlocks || isEditing" name="label" :list="props.label || []" tag="span" />
            <span v-if="!hasLabelBlocks && isEditing" class="text-gray-400">
              {{ $t("form_block.field.label_placeholder") }}
            </span>
          </span>
          <span v-if="isRequired" class="text-red-500">*</span>
        </span>
      </label>

      <textarea
        v-if="fieldType === 'textarea'"
        :id="inputId"
        :name="inputName"
        rows="5"
        maxlength="5000"
        class="textarea textarea-bordered w-full"
        :placeholder="placeholder"
        :required="isRequired"
        :disabled="isEditing"
      />

      <select
        v-else-if="fieldType === 'select'"
        :id="inputId"
        :name="inputName"
        class="select select-bordered w-full"
        :required="isRequired"
        :disabled="isEditing"
      >
        <option value="">{{ $t("form_block.select_placeholder") }}</option>
        <option v-for="choice in choices" :key="choice" :value="choice">{{ choice }}</option>
      </select>

      <input
        v-else
        :id="inputId"
        :name="inputName"
        :type="fieldType === 'email' ? 'email' : 'text'"
        maxlength="5000"
        class="input input-bordered w-full"
        :placeholder="placeholder"
        :required="isRequired"
        :autocomplete="autocomplete || undefined"
        :disabled="isEditing"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { FieldListItem } from "#blokkli/types";

const props = defineProps<{
  label?: FieldListItem[];
}>();

const { $t } = useNuxtApp();

const { options, isEditing, uuid } = defineBlokkli({
  bundle: "form_field",
  options: {
    fieldType: {
      type: "radios",
      label: "Feldtyp",
      default: "text",
      options: {
        text: "Text",
        email: "E-Mail",
        textarea: "Mehrzeiliger Text",
        select: "Auswahl",
        checkbox: "Checkbox",
      },
    },
    required: {
      type: "checkbox",
      label: "Pflichtfeld",
      default: false,
    },
    fieldName: {
      type: "text",
      label: "Technischer Feldname",
      default: "",
    },
    placeholder: {
      type: "text",
      label: "Platzhalter",
      default: "",
    },
    choices: {
      type: "text",
      label: "Auswahloptionen (eine pro Zeile)",
      default: "",
    },
    autocomplete: {
      type: "text",
      label: "Autocomplete",
      default: "",
    },
    width: {
      type: "radios",
      label: "Breite",
      default: "full",
      options: {
        full: "Voll",
        half: "Halb",
      },
    },
  },
  editor: {
    addBehaviour: "no-form",
    editTitle: (el) => {
      return el.textContent?.trim() || "Formularfeld";
    },
    mockProps: () => {
      return { label: [] };
    },
  },
});

const fieldType = computed(() => {
  const value = String((options.value as any)?.fieldType || "text");
  return ["text", "email", "textarea", "select", "checkbox"].includes(value) ? value : "text";
});

const isRequired = computed(() => (options.value as any)?.required === true);
const placeholder = computed(() => String((options.value as any)?.placeholder || ""));
const autocomplete = computed(() => String((options.value as any)?.autocomplete || "").trim());
const hasLabelBlocks = computed(() => Array.isArray(props.label) && props.label.length > 0);

const choices = computed(() => {
  return String((options.value as any)?.choices || "")
    .split(/\r?\n/)
    .map((choice) => choice.trim())
    .filter(Boolean);
});

const inputName = computed(() => {
  const configured = normalizeFieldName(String((options.value as any)?.fieldName || ""));
  return configured || `field_${uuid.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`;
});

const inputId = computed(() => `form-field-${inputName.value}-${uuid}`);

const widthClass = computed(() => ((options.value as any)?.width === "half" ? "sm:col-span-6" : "sm:col-span-12"));

function normalizeFieldName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}
</script>
