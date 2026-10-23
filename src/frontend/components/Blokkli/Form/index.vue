<template>
  <section :id="'block-' + uuid" class="blokkli-block-form" :class="wrapperClass">
    <div class="mx-auto max-w-3xl">
      <div v-if="props.title || props.description || isEditing" class="mb-6">
        <h2
          v-if="props.title || isEditing"
          v-blokkli-editable:title
          class="font-heading text-2xl font-bold text-gray"
          v-text="props.title"
        />
        <p
          v-if="props.description || isEditing"
          v-blokkli-editable:description
          class="text-gray-500 mt-2"
          v-text="props.description"
        />
      </div>

      <div v-if="submissionState === 'success'" class="alert border-green bg-rating-3-light text-green shadow-list">
        <span>{{ successText }}</span>
      </div>

      <form v-else ref="formRef" class="space-y-5" @submit.prevent="submitForm">
        <BlokkliField
          v-if="fieldDefinitions.length > 0 || isEditing"
          name="fields"
          :list="props.fields || []"
          tag="div"
          class="grid grid-cols-1 gap-4 sm:grid-cols-12"
        />

        <p v-if="fieldDefinitions.length === 0" class="text-gray-500 text-sm">
          {{ $t("form_block.empty_fields") }}
        </p>

        <div v-if="!isEditing" class="space-y-2">
          <label class="text-gray-700 block text-sm font-medium">
            {{ $t("captcha.title") }} <span class="text-red-500">*</span>
          </label>
          <ClientOnly>
            <altcha-widget
              ref="altchaRef"
              challenge="/api/altcha?purpose=form"
              hidefooter
              :language="$locale.startsWith('en') ? 'en' : 'de'"
              style="--altcha-border-radius: 6px; --altcha-color-border: #d1d5db; width: 100%"
            />
            <template #fallback>
              <div class="border-gray-200 bg-gray-50 flex h-16 items-center justify-center rounded-md border">
                <span class="text-gray-400 text-xs">{{ $t("captcha.loading") }}</span>
              </div>
            </template>
          </ClientOnly>
          <p v-if="captchaError" class="text-red-500 text-xs">{{ captchaError }}</p>
        </div>

        <p v-if="submitError" class="text-red-600 text-sm">{{ submitError }}</p>

        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-gray-400 text-xs">{{ $t("generic.privacy.disclaimer") }}</p>
          <button
            type="submit"
            class="btn bg-green px-6 font-semibold text-white hover:bg-green hover:opacity-90"
            :disabled="submissionState === 'submitting' || isEditing || fieldDefinitions.length === 0"
          >
            <span v-if="submissionState === 'submitting'">{{ $t("form_block.submit.loading") }}</span>
            <span v-else>{{ submitLabel }}</span>
          </button>
        </div>

        <p
          v-if="isEditing"
          v-blokkli-editable:successMessage
          class="text-gray-400 min-h-4 text-xs"
          v-text="props.successMessage"
        />
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { GenericFormRequestSchema } from "~/shared/contracts/submissions";
import { displayScalar } from '~/shared/visualization';
import { captchaEventData } from '~/shared/requestError';

import type { FieldListItem } from "#blokkli/types";

type SubmittedFieldType = "text" | "email" | "textarea" | "select" | "checkbox";

type SubmittedFieldDefinition = {
  name: string;
  label: string;
  type: SubmittedFieldType;
  required: boolean;
};

const FIELD_TYPES = new Set<SubmittedFieldType>(["text", "email", "textarea", "select", "checkbox"]);

const props = defineProps<{
  title?: string | undefined;
  description?: string | undefined;
  successMessage?: string | undefined;
  fields?: FieldListItem[] | undefined;
}>();

const { $t, $locale } = useNuxtApp();
const route = useRoute();

const isEditing = import.meta.blokkliEditing

const { options, uuid } = defineBlokkli({
  bundle: "form",
  propsFieldMapping: {
    fields: { name: 'fields', type: 'field' },
    title: { name: 'title', type: 'editable' },
    description: { name: 'description', type: 'editable' },
    successMessage: { name: 'successMessage', type: 'editable' },
  },
  options: {
    formKey: {
      type: "text",
      label: "Formular-Schlüssel",
      default: "",
      group: "Versand",
    },
    notificationEmail: {
      type: "text",
      label: "Empfänger-E-Mail",
      default: "",
      group: "Versand",
    },
    sendCopy: {
      type: "checkbox",
      label: "Kopie an Formularabsender:in senden",
      default: true,
      group: "Versand",
    },
    submitLabel: {
      type: "text",
      label: "Button-Text",
      default: "",
      group: "Darstellung",
    },
    background: {
      type: "radios",
      label: "Hintergrund",
      default: "white",
      group: "Darstellung",
      options: {
        white: "Weiß",
        light: "Hellblau",
        green: "Hellgrün",
      },
    },
  },
  editor: {
    addBehaviour: "no-form",
    editTitle: (el) => {
      return el.textContent?.trim() || "Formular";
    },
    mockProps: () => {
      return { title: "Kontaktformular", description: "", successMessage: "", fields: [] };
    },
  },
});

const formRef = ref<HTMLFormElement | null>(null);
const altchaRef = ref<(HTMLElement & { value?: string | undefined }) | null>(null);
const altchaPayload = ref("");
const captchaError = ref("");
const submitError = ref("");
const submissionState = ref<"idle" | "submitting" | "success">("idle");

const background = computed(() => String(options.value.background || "white"));

const wrapperClass = computed(() => {
  const map: Record<string, string> = {
    white: "bg-white px-4 py-8 sm:px-6",
    light: "bg-very-light-blue px-4 py-8 sm:px-6",
    green: "bg-rating-4-very-light px-4 py-8 sm:px-6",
  };
  return map[background.value] || map.white;
});

const submitLabel = computed(() => String(options.value.submitLabel || "").trim() || $t("form_block.submit"));
const successText = computed(() => props.successMessage?.trim() || $t("form_block.submit.success"));

const formKey = computed(() => {
  const configured = String(options.value.formKey || "").trim();
  return configured || uuid;
});

const fieldDefinitions = computed<SubmittedFieldDefinition[]>(() => {
  return (props.fields || [])
    .filter((field) => field.bundle === "form_field")
    .map((field) => {
      const fieldOptions = (field.options || {}) as Record<string, unknown>;
      const typeCandidate = displayScalar(fieldOptions.fieldType, "text") as SubmittedFieldType;
      const type = FIELD_TYPES.has(typeCandidate) ? typeCandidate : "text";
      const label = getLabelText(field.props?.label);
      return {
        name: normalizeFieldName(displayScalar(fieldOptions.fieldName)) || fallbackFieldName(field.uuid),
        label: label || $t("form_block.field.default_label"),
        type,
        required: fieldOptions.required === true,
      };
    });
});

function normalizeFieldName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function fallbackFieldName(fieldUuid: string) {
  return `field_${fieldUuid.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`;
}

function getLabelText(labelBlocks: unknown) {
  if (!Array.isArray(labelBlocks)) return "";
  return labelBlocks
    .filter((block): block is FieldListItem => Boolean(block && typeof block === "object"))
    .map((block) => {
      const text = displayScalar((block.props as Record<string, unknown>)?.text).trim();
      return text;
    })
    .filter(Boolean)
    .join(" ");
}

function onAltchaStateChange(e: Event) {
  const { state, payload } = captchaEventData(e);
  if (state === "verified" && payload) {
    altchaPayload.value = payload;
    captchaError.value = "";
  } else {
    altchaPayload.value = "";
  }
}

onMounted(async () => {
  await nextTick();
  await nextTick();
  altchaRef.value?.addEventListener("statechange", onAltchaStateChange);
});

onUnmounted(() => {
  altchaRef.value?.removeEventListener("statechange", onAltchaStateChange);
});

function collectValues(formData: FormData) {
  const values: Record<string, string | string[] | boolean> = {};

  for (const field of fieldDefinitions.value) {
    if (field.type === "checkbox") {
      values[field.name] = formData.has(field.name);
      continue;
    }

    const allValues = formData
      .getAll(field.name)
      .map((value) => typeof value === "string" ? value.trim() : "")
      .filter(Boolean);

    values[field.name] = allValues.length > 1 ? allValues : allValues[0] || "";
  }

  return values;
}

async function submitForm() {
  submitError.value = "";
  captchaError.value = "";

  if (isEditing || submissionState.value === "submitting") return;

  const payload = altchaPayload.value || altchaRef.value?.value;
  if (!payload) {
    captchaError.value = $t("captcha.required");
    return;
  }

  if (!formRef.value || fieldDefinitions.value.length === 0) {
    submitError.value = $t("form_block.submit.error");
    return;
  }

  submissionState.value = "submitting";

  try {
    await $fetch("/api/submit-form-response", {
      method: "POST",
      body: GenericFormRequestSchema.parse({
        formKey: formKey.value,
        formTitle: props.title?.trim() || $t("form_block.default_title"),
        pagePath: route.fullPath,
        notificationEmail: String(options.value.notificationEmail || "").trim(),
        sendCopy: options.value.sendCopy !== false,
        fields: fieldDefinitions.value,
        values: collectValues(new FormData(formRef.value)),
        altcha: payload,
      }),
    });
    submissionState.value = "success";
  } catch (err) {
    console.warn("[form-block] submit failed:", err);
    submissionState.value = "idle";
    submitError.value = $t("form_block.submit.error");
  }
}
</script>
