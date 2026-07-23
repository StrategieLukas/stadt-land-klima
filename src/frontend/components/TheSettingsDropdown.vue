<template>
  <div class="relative" ref="containerRef">
    <!-- Trigger button: styled like ThemeToggle -->
    <button
      type="button"
      class="settings-trigger"
      :class="{ 'settings-trigger--open': isOpen }"
      :aria-expanded="isOpen"
      :aria-label="$t('settings.label')"
      @click="toggle"
    >
      <!-- Theme icon: ClientOnly to avoid SSR/client hydration mismatch
           (server always renders light, client may have dark from localStorage) -->
      <ClientOnly>
        <!-- Sun icon (light mode) -->
        <svg
          v-if="!isDark"
          class="settings-trigger__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          />
        </svg>
        <!-- Moon icon (dark mode) -->
        <svg
          v-else
          class="settings-trigger__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path d="M20.35 15.35A8 8 0 0 1 8.65 3.65A8.5 8.5 0 1 0 20.35 15.35Z" />
        </svg>
        <!-- Fallback: sun icon shown during SSR and initial hydration (matches server render) -->
        <template #fallback>
          <svg
            class="settings-trigger__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" />
            <path
              d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
            />
          </svg>
        </template>
      </ClientOnly>
      <!-- Divider line -->
      <span class="settings-trigger__divider" aria-hidden="true" />
      <!-- Current language code -->
      <span class="settings-trigger__lang" aria-hidden="true">{{ currentLocaleShort }}</span>
    </button>

    <!-- Dropdown panel -->
    <Transition name="settings-panel">
      <div
        v-if="isOpen"
        class="settings-panel"
        role="dialog"
        :aria-label="$t('settings.label')"
      >
        <!-- Theme section -->
        <div class="settings-panel__section">
          <ThemeToggle />
        </div>
        <!-- Divider -->
        <div class="settings-panel__divider" aria-hidden="true" />
        <!-- Language section -->
        <div class="settings-panel__section">
          <LanguageSelector variant="header" size="compact" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
const { $t } = useNuxtApp() as unknown as {
  $t: (key: string) => string;
};
const { isDark } = useTheme();

const containerRef = ref<HTMLElement | null>(null);
const isOpen = ref(false);

const localeShortMap: Record<string, string> = {
  "de-DE": "DE",
  "en-GB": "EN",
  "it-IT": "IT",
};

// $locale is provided by the client-only directus plugin — access it lazily after mount
const currentLocaleShort = ref("DE");
onMounted(() => {
  try {
    const nuxt = useNuxtApp() as unknown as { $locale?: string };
    const locale = nuxt.$locale ?? "";
    currentLocaleShort.value = localeShortMap[locale] ?? (locale.slice(0, 2).toUpperCase() || "DE");
  } catch {
    // noop — keep default "DE"
  }
});

function toggle() {
  isOpen.value = !isOpen.value;
}

function handleOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
}

onMounted(() => document.addEventListener("click", handleOutside, true));
onUnmounted(() => document.removeEventListener("click", handleOutside, true));
</script>

<style scoped>
.settings-trigger {
  align-items: center;
  background: var(--slk-surface);
  border: 2px solid var(--slk-border);
  border-radius: 9999px;
  color: var(--slk-text-muted);
  cursor: pointer;
  display: inline-flex;
  flex: none;
  gap: 0.25rem;
  height: 2.25rem;
  justify-content: center;
  padding: 0 0.6rem;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    color 160ms ease;
}

.settings-trigger:hover,
.settings-trigger--open {
  border-color: var(--slk-accent-green);
  color: var(--slk-text-strong);
}

.settings-trigger__icon {
  display: inline-flex;
  flex-shrink: 0;
  height: 1rem;
  width: 1rem;
}

.settings-trigger__divider {
  background: var(--slk-border-strong);
  border-radius: 9999px;
  display: inline-block;
  height: 1rem;
  width: 1.5px;
}

.settings-trigger__lang {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  line-height: 1;
}

/* Dropdown panel */
.settings-panel {
  background: var(--slk-surface);
  border: 1.5px solid var(--slk-border);
  border-radius: 0.875rem;
  box-shadow: 0 8px 24px var(--slk-shadow-color);
  min-width: 13rem;
  padding: 0.5rem;
  position: absolute;
  right: 0;
  top: calc(100% + 0.5rem);
  z-index: 10001;
}

.settings-panel__section {
  align-items: center;
  display: flex;
  justify-content: center;
  padding: 0.5rem;
}

.settings-panel__divider {
  background: var(--slk-border);
  height: 1px;
  margin: 0.125rem 0.5rem;
}

/* Transition */
.settings-panel-enter-active,
.settings-panel-leave-active {
  transition:
    opacity 120ms ease,
    transform 120ms ease;
}

.settings-panel-enter-from,
.settings-panel-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}
</style>
