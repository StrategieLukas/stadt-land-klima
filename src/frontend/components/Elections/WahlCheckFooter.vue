<template>
  <component
    :is="inline ? 'div' : 'footer'"
    v-if="showsWahlcheckCooperation(dateCreated)"
    class="wahlcheck-footer"
    :class="inline ? 'hidden min-w-0 py-2 sm:block sm:max-w-sm' : 'px-4 py-4'"
    :data-testid="inline ? 'wahlcheck-desktop-logos' : 'wahlcheck-footer'"
  >
    <div class="mx-auto flex max-w-6xl flex-col items-center gap-3" :class="{ 'sm:items-start': inline }">
      <p
        class="max-w-sm text-center text-sm leading-relaxed text-(--slk-text-muted)"
        :class="{ 'sm:text-left': inline }"
      >
        {{ $t("elections.wahlcheck.footer.cooperation") }}
      </p>
      <div class="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
        <a
          href="https://www.stadt-land-klima.de/"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex rounded-sm outline-offset-4 focus-visible:outline-2 focus-visible:outline-(--slk-text)"
        >
          <img
            :src="useLightArtwork ? slkLogoDark : slkLogo"
            :alt="$t('elections.wahlcheck.footer.slk')"
            width="114"
            height="40"
            class="w-auto"
            :class="inline ? 'h-8' : 'h-10'"
          />
        </a>
        <a
          href="https://localzero.net/"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex rounded-sm outline-offset-4 focus-visible:outline-2 focus-visible:outline-(--slk-text)"
        >
          <img
            :src="localzeroLogo"
            :alt="$t('elections.wahlcheck.footer.localzero')"
            width="112"
            height="40"
            class="w-auto"
            :class="inline ? 'h-8' : 'h-10'"
          />
        </a>
      </div>
    </div>
  </component>
</template>

<script setup lang="ts">
import localzeroLogo from "~/assets/images/LocalZero-logo.svg";
import slkLogo from "~/assets/images/Stadt-Land-Klima-Logo.svg";
import slkLogoDark from "~/assets/images/Stadt-Land-Klima-Logo-dark.svg";
import { showsWahlcheckCooperation } from "~/shared/wahlcheckCooperation";

const { isDark } = useTheme();
const { isLocalzero } = useWahlcheckTheme();
// The server cannot read the browser's theme preference. Match its initial
// artwork during hydration, then select the contrasting dark-surface variant.
const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});
const useLightArtwork = computed(() => mounted.value && isDark.value && !isLocalzero.value);

withDefaults(defineProps<{ inline?: boolean; dateCreated?: string | null | undefined }>(), { inline: false });
</script>
