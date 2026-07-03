<template>
  <button
    type="button"
    class="theme-toggle"
    :class="{ 'theme-toggle--dark': isDark }"
    :aria-label="ariaLabel"
    :aria-pressed="isDark"
    :title="title"
    @click="toggleTheme"
  >
    <span class="sr-only">{{ ariaLabel }}</span>
    <span class="theme-toggle__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="4" />
        <path
          d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        />
      </svg>
    </span>
    <span class="theme-toggle__track" aria-hidden="true">
      <span class="theme-toggle__knob"></span>
    </span>
    <span class="theme-toggle__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20.35 15.35A8 8 0 0 1 8.65 3.65A8.5 8.5 0 1 0 20.35 15.35Z" />
      </svg>
    </span>
  </button>
</template>

<script setup lang="ts">
const { $t } = useNuxtApp() as unknown as {
  $t: (key: string) => string;
};
const { isDark, themePreference, toggleTheme } = useTheme();

const ariaLabel = computed(() => (isDark.value ? $t("theme.toggle_to_light") : $t("theme.toggle_to_dark")));
const title = computed(() => {
  const current = isDark.value ? $t("theme.dark") : $t("theme.light");

  if (themePreference.value === "system") {
    return `${current} - ${$t("theme.using_system")}`;
  }

  return current;
});
</script>

<style scoped>
.theme-toggle {
  align-items: center;
  background: var(--slk-surface);
  border: 2px solid var(--slk-border);
  border-radius: 9999px;
  color: var(--slk-text-muted);
  display: inline-flex;
  flex: none;
  gap: 0.25rem;
  height: 2.25rem;
  justify-content: center;
  padding: 0 0.375rem;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    color 160ms ease;
}

.theme-toggle:hover {
  border-color: var(--slk-accent-green);
  color: var(--slk-text-strong);
}

.theme-toggle__icon {
  display: inline-flex;
  height: 1rem;
  width: 1rem;
}

.theme-toggle__track {
  align-items: center;
  background: var(--slk-surface-subdued);
  border: 1px solid var(--slk-border);
  border-radius: 9999px;
  display: inline-flex;
  height: 1.125rem;
  padding: 0.125rem;
  width: 2rem;
}

.theme-toggle__knob {
  background: var(--slk-accent-green);
  border-radius: 9999px;
  display: block;
  height: 0.75rem;
  transform: translateX(0);
  transition: transform 160ms ease;
  width: 0.75rem;
}

.theme-toggle--dark .theme-toggle__knob {
  transform: translateX(0.875rem);
}
</style>
