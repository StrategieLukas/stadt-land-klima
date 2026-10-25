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
          class="mt-2 text-gray-500"
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

        <p v-if="fieldDefinitions.length === 0" class="text-sm text-gray-500">
          {{ $t("form_block.empty_fields") }}
        </p>

        <div v-if="!isEditing" class="space-y-2">
          <!-- Math challenge -->
          <label class="block text-sm font-medium text-gray-700">
            {{ $t("captcha.question", { ":first": mathChallenge.num1, ":second": mathChallenge.num2 }) }}
            <span class="text-red-500">*</span>
          </label>
          <input
            v-model="mathChallengeAnswer"
            type="text"
            inputmode="numeric"
            pattern="[0-9]+"
            class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-xs focus:border-green focus:ring-2 focus:ring-green focus:outline-hidden"
          />
          <p v-if="mathChallengeError" class="text-xs text-red-500">{{ mathChallengeError }}</p>

          <!-- Altcha CAPTCHA -->
          <label class="block text-sm font-medium text-gray-700">
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
              <div class="flex h-16 items-center justify-center rounded-md border border-gray-200 bg-gray-50">
                <span class="text-xs text-gray-400">{{ $t("captcha.loading") }}</span>
              </div>
            </template>
          </ClientOnly>
          <p v-if="captchaError" class="text-xs text-red-500">{{ captchaError }}</p>
        </div>

        <p v-if="submitError" class="text-sm text-red-600">{{ submitError }}</p>

        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-xs text-gray-400">{{ $t("generic.privacy.disclaimer") }}</p>
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
          class="min-h-4 text-xs text-gray-400"
          v-text="props.successMessage"
        />
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { clientFailure } from "../../../shared/securityLog";

import { FORM_SCOPE } from "~/shared/formScope";
import { GenericFormRequestSchema } from "~/shared/contracts/submissions";
import { displayScalar } from "~/shared/visualization";
import { captchaEventData } from "~/shared/requestError";

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
const formScope = inject(FORM_SCOPE);

const isEditing = import.meta.blokkliEditing;

const { options, uuid } = defineBlokkli({
  bundle: "form",
  propsFieldMapping: {
    fields: { name: "fields", type: "field" },
    title: { name: "title", type: "editable" },
    description: { name: "description", type: "editable" },
    successMessage: { name: "successMessage", type: "editable" },
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

const { mathChallenge, mathChallengeAnswer, mathChallengeError, loadMathChallenge, validateMathChallenge } =
  useMathChallenge("form");

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
  await loadMathChallenge();
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
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean);

    values[field.name] = allValues.length > 1 ? allValues : allValues[0] || "";
  }

  return values;
}

async function submitForm() {
  submitError.value = "";
  captchaError.value = "";
  mathChallengeError.value = "";

  if (isEditing || submissionState.value === "submitting") return;

  if (!validateMathChallenge()) return;

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
        formUuid: uuid,
        entityType: formScope?.value.entityType,
        entityUuid: formScope?.value.entityUuid,
        formKey: formKey.value,
        formTitle: props.title?.trim() || $t("form_block.default_title"),
        pagePath: route.fullPath,
        notificationEmail: String(options.value.notificationEmail || "").trim(),
        sendCopy: options.value.sendCopy !== false,
        fields: fieldDefinitions.value,
        values: collectValues(new FormData(formRef.value)),
        altcha: payload,
        mathChallenge: { token: mathChallenge.value.token, answer: mathChallengeAnswer.value },
      }),
    });
    submissionState.value = "success";
  } catch (error) {
    clientFailure("app.components.Blokkli.Form.index.submitForm.failed", error);
    submissionState.value = "idle";
    submitError.value = $t("form_block.submit.error");
  }
}
</script>
