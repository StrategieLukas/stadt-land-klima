<template>
  <div class="mx-auto max-w-3xl px-4 py-8">
    <NuxtLink to="/projects" class="mb-6 inline-block text-sm font-semibold text-light-blue hover:underline">
      ← {{ $t("projects.submit.back") }}
    </NuxtLink>

    <div class="mb-6">
      <h1 class="font-heading text-h1 font-bold text-green">{{ $t("projects.submit.title") }}</h1>
      <p class="text-gray-600 mt-2">{{ $t("projects.submit.intro") }}</p>
    </div>

    <div v-if="successMessage" class="alert border-green bg-rating-3-light text-green shadow-list">
      <div>
        <h2 class="font-heading text-h3 font-bold">{{ $t("projects.submit.success.title") }}</h2>
        <p>{{ successMessage }}</p>
      </div>
    </div>

    <form v-else class="space-y-6 rounded-sm bg-white p-4 shadow-list sm:p-8" @submit.prevent="submitArticle">
      <section class="space-y-4">
        <h2 class="text-gray-800 font-heading text-h3 font-bold">{{ $t("projects.submit.section.project") }}</h2>

        <div>
          <label for="project-title" class="text-gray-700 mb-1 block text-sm font-medium">
            {{ $t("projects.submit.field.title") }} <span class="text-red-500">*</span>
          </label>
          <input
            id="project-title"
            v-model="form.title"
            type="text"
            maxlength="180"
            required
            class="input input-bordered w-full"
          />
        </div>

        <div>
          <label for="project-subtitle" class="text-gray-700 mb-1 block text-sm font-medium">
            {{ $t("projects.submit.field.subtitle") }}
          </label>
          <input
            id="project-subtitle"
            v-model="form.subtitle"
            type="text"
            maxlength="255"
            class="input input-bordered w-full"
          />
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label for="project-municipality" class="text-gray-700 mb-1 block text-sm font-medium">
              {{ $t("projects.submit.field.municipality") }} <span class="text-red-500">*</span>
            </label>
            <input
              id="project-municipality"
              v-model="form.municipalityName"
              type="text"
              maxlength="120"
              required
              class="input input-bordered w-full"
            />
          </div>

          <div>
            <label for="project-state" class="text-gray-700 mb-1 block text-sm font-medium">
              {{ $t("projects.submit.field.state") }}
            </label>
            <select id="project-state" v-model="form.state" class="select select-bordered w-full">
              <option value="">{{ $t("generic.form.please_select") }}</option>
              <option v-for="state in stateOptions" :key="state" :value="state">{{ state }}</option>
            </select>
          </div>
        </div>

        <fieldset>
          <legend class="text-gray-700 mb-2 block text-sm font-medium">
            {{ $t("projects.submit.field.sectors") }} <span class="text-red-500">*</span>
          </legend>
          <div class="grid grid-cols-1 gap-2 xs:grid-cols-2 sm:grid-cols-3">
            <label v-for="sector in sectorOptions" :key="sector.value" class="flex items-center gap-2 text-sm">
              <input
                v-model="form.sectors"
                type="checkbox"
                class="border-gray-300 checkbox checkbox-sm"
                :value="sector.value"
              />
              <span>{{ sector.label }}</span>
            </label>
          </div>
        </fieldset>

        <div>
          <label for="project-abstract" class="text-gray-700 mb-1 block text-sm font-medium">
            {{ $t("projects.submit.field.abstract") }} <span class="text-red-500">*</span>
          </label>
          <textarea
            id="project-abstract"
            v-model="form.abstract"
            rows="4"
            maxlength="1500"
            required
            class="textarea textarea-bordered w-full"
          />
        </div>

        <div>
          <label for="project-article-text" class="text-gray-700 mb-1 block text-sm font-medium">
            {{ $t("projects.submit.field.article_text") }} <span class="text-red-500">*</span>
          </label>
          <textarea
            id="project-article-text"
            v-model="form.articleText"
            rows="9"
            maxlength="10000"
            required
            class="textarea textarea-bordered w-full"
          />
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label for="project-link" class="text-gray-700 mb-1 block text-sm font-medium">
              {{ $t("projects.submit.field.link") }}
            </label>
            <input
              id="project-link"
              v-model="form.link"
              type="url"
              maxlength="255"
              class="input input-bordered w-full"
            />
          </div>
          <div>
            <label for="project-instagram" class="text-gray-700 mb-1 block text-sm font-medium">
              {{ $t("projects.submit.field.instagram") }}
            </label>
            <input
              id="project-instagram"
              v-model="form.instagram"
              type="url"
              maxlength="255"
              class="input input-bordered w-full"
            />
          </div>
          <div>
            <label for="project-linkedin" class="text-gray-700 mb-1 block text-sm font-medium">
              {{ $t("projects.submit.field.linkedin") }}
            </label>
            <input
              id="project-linkedin"
              v-model="form.linkedin"
              type="url"
              maxlength="255"
              class="input input-bordered w-full"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label for="project-image" class="text-gray-700 mb-1 block text-sm font-medium">
              {{ $t("projects.submit.field.image") }} <span class="text-red-500">*</span>
            </label>
            <input
              id="project-image"
              ref="imageInputRef"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              class="file-input file-input-bordered w-full"
              @change="onImageChange"
            />
          </div>

          <div>
            <label for="project-image-credits" class="text-gray-700 mb-1 block text-sm font-medium">
              {{ $t("projects.submit.field.image_credits") }} <span class="text-red-500">*</span>
            </label>
            <input
              id="project-image-credits"
              v-model="form.imageCredits"
              type="text"
              maxlength="255"
              required
              class="input input-bordered w-full"
            />
          </div>
        </div>

        <label class="border-gray-200 bg-gray-50 flex items-start gap-3 rounded-sm border p-3 text-sm">
          <input
            v-model="form.imageRightsConfirmed"
            type="checkbox"
            required
            class="border-gray-300 checkbox checkbox-sm mt-0.5 shrink-0"
          />
          <span class="text-gray-700">
            {{ $t("projects.submit.field.image_rights_confirmed") }} <span class="text-red-500">*</span>
          </span>
        </label>
      </section>

      <section class="border-gray-100 space-y-4 border-t pt-6">
        <h2 class="text-gray-800 font-heading text-h3 font-bold">{{ $t("projects.submit.section.contact") }}</h2>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label for="project-author" class="text-gray-700 mb-1 block text-sm font-medium">
              {{ $t("projects.submit.field.author") }} <span class="text-red-500">*</span>
            </label>
            <input
              id="project-author"
              v-model="form.author"
              type="text"
              autocomplete="name"
              maxlength="120"
              required
              class="input input-bordered w-full"
            />
          </div>

          <div>
            <label for="project-email" class="text-gray-700 mb-1 block text-sm font-medium">
              {{ $t("projects.submit.field.email") }} <span class="text-red-500">*</span>
            </label>
            <input
              id="project-email"
              v-model="form.submitterEmail"
              type="email"
              autocomplete="email"
              maxlength="255"
              required
              class="input input-bordered w-full"
            />
          </div>
        </div>

        <div>
          <label class="text-gray-700 mb-2 block text-sm font-medium">
            {{ $t("captcha.title") }} <span class="text-red-500">*</span>
          </label>
          <ClientOnly>
            <altcha-widget
              ref="altchaRef"
              challenge="/api/altcha"
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
          <p v-if="captchaError" class="text-red-500 mt-1 text-xs">{{ captchaError }}</p>
        </div>

        <p v-if="errorMessage" class="text-red-600 text-sm">{{ errorMessage }}</p>

        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-gray-400 text-xs">{{ $t("generic.privacy.disclaimer") }}</p>
          <button
            type="submit"
            class="btn bg-green px-6 font-semibold text-white hover:bg-green hover:opacity-90"
            :disabled="loading"
          >
            <span v-if="loading">{{ $t("feedback.form.submit.loading") }}</span>
            <span v-else>{{ $t("projects.submit.form.submit") }}</span>
          </button>
        </div>
      </section>
    </form>
  </div>
</template>

<script setup lang="ts">
type ArticleSubmissionForm = {
  title: string;
  subtitle: string;
  municipalityName: string;
  state: string;
  sectors: string[];
  abstract: string;
  articleText: string;
  link: string;
  instagram: string;
  linkedin: string;
  imageCredits: string;
  imageRightsConfirmed: boolean;
  author: string;
  submitterEmail: string;
};

const { $t, $locale } = useNuxtApp();

useHead({ title: $t("projects.submit.title") });

const stateOptions = [
  "Baden-Württemberg",
  "Bayern",
  "Berlin",
  "Brandenburg",
  "Bremen",
  "Hamburg",
  "Hessen",
  "Mecklenburg-Vorpommern",
  "Niedersachsen",
  "Nordrhein-Westfalen",
  "Rheinland-Pfalz",
  "Saarland",
  "Sachsen",
  "Sachsen-Anhalt",
  "Schleswig-Holstein",
  "Thüringen",
];

const sectorValues = [
  "Abfallwirtschaft",
  "Finanzierung",
  "Gebäude",
  "Governance",
  "Industrie",
  "Kraftstoffe",
  "LULUCF",
  "Landwirtschaft",
  "Sonstiges",
  "Strom",
  "Verkehr",
  "Wärme",
];

const sectorKeyMap: Record<string, string> = {
  Abfallwirtschaft: "waste_management",
  Finanzierung: "financing",
  Gebäude: "buildings",
  Governance: "governance",
  Industrie: "industry",
  Kraftstoffe: "fuels",
  LULUCF: "lulucf",
  Landwirtschaft: "agriculture",
  Sonstiges: "other",
  Strom: "electricity",
  Verkehr: "transport",
  Wärme: "heating",
};

const sectorOptions = computed(() =>
  sectorValues.map((value) => ({
    label: $t(`projects.sector.${sectorKeyMap[value]}`),
    value,
  })),
);

const emptyForm = (): ArticleSubmissionForm => ({
  title: "",
  subtitle: "",
  municipalityName: "",
  state: "",
  sectors: [],
  abstract: "",
  articleText: "",
  link: "",
  instagram: "",
  linkedin: "",
  imageCredits: "",
  imageRightsConfirmed: false,
  author: "",
  submitterEmail: "",
});

const form = reactive<ArticleSubmissionForm>(emptyForm());
const altchaRef = ref<(HTMLElement & { value?: string }) | null>(null);
const imageInputRef = ref<HTMLInputElement | null>(null);
const selectedImage = ref<File | null>(null);
const altchaPayload = ref("");
const captchaError = ref("");
const errorMessage = ref("");
const successMessage = ref("");
const loading = ref(false);

function onAltchaStateChange(e: Event) {
  const { state, payload } = (e as CustomEvent).detail ?? {};
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

function onImageChange(event: Event) {
  const input = event.target as HTMLInputElement;
  selectedImage.value = input.files?.[0] ?? null;
}

function resetForm() {
  Object.assign(form, emptyForm());
  selectedImage.value = null;
  altchaPayload.value = "";
  errorMessage.value = "";
  captchaError.value = "";
  if (imageInputRef.value) {
    imageInputRef.value.value = "";
  }
}

async function submitArticle() {
  errorMessage.value = "";
  captchaError.value = "";

  const payload = altchaPayload.value || altchaRef.value?.value;
  if (!payload) {
    captchaError.value = $t("captcha.required");
    return;
  }
  if (!selectedImage.value) {
    errorMessage.value = $t("projects.submit.error.image_required");
    return;
  }
  if (!form.imageRightsConfirmed) {
    errorMessage.value = $t("projects.submit.error.image_rights_required");
    return;
  }
  if (form.sectors.length === 0) {
    errorMessage.value = $t("projects.submit.error.sectors_required");
    return;
  }

  const submitData = new FormData();
  submitData.append("title", form.title);
  submitData.append("subtitle", form.subtitle);
  submitData.append("municipalityName", form.municipalityName);
  submitData.append("state", form.state);
  submitData.append("sectors", JSON.stringify(form.sectors));
  submitData.append("abstract", form.abstract);
  submitData.append("articleText", form.articleText);
  submitData.append("link", form.link);
  submitData.append("instagram", form.instagram);
  submitData.append("linkedin", form.linkedin);
  submitData.append("imageCredits", form.imageCredits);
  submitData.append("imageRightsConfirmed", String(form.imageRightsConfirmed));
  submitData.append("author", form.author);
  submitData.append("submitterEmail", form.submitterEmail);
  submitData.append("image", selectedImage.value);
  submitData.append("altcha", payload);

  loading.value = true;
  try {
    const result = await $fetch<{ success: boolean; status: string }>("/api/submit-article", {
      method: "POST",
      body: submitData,
    });
    if (result.success) {
      successMessage.value = $t("projects.submit.success.body");
      resetForm();
    }
  } catch (err: any) {
    errorMessage.value = err?.data?.message ?? $t("generic.technical_error");
  } finally {
    loading.value = false;
  }
}
</script>
