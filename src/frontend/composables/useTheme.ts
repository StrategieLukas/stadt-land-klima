type ThemeMode = "light" | "dark";
type ThemePreference = ThemeMode | "system";

const storageKey = "slk_theme_preference";
const lightThemeName = "staedteChallemgeTheme";
const darkThemeName = "staedteChallengeDark";

let initialized = false;
let mediaQuery: MediaQueryList | null = null;

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function getSystemTheme(): ThemeMode {
  if (!import.meta.client) {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(preference: ThemePreference): ThemeMode {
  return preference === "system" ? getSystemTheme() : preference;
}

function applyTheme(theme: ThemeMode) {
  if (!import.meta.client) {
    return;
  }

  const root = document.documentElement;
  root.dataset.theme = theme === "dark" ? darkThemeName : lightThemeName;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function useTheme() {
  const themePreference = useState<ThemePreference>("slk-theme-preference", () => "system");
  const activeTheme = useState<ThemeMode>("slk-active-theme", () => "light");
  const isDark = computed(() => activeTheme.value === "dark");

  function syncTheme() {
    activeTheme.value = resolveTheme(themePreference.value);
    applyTheme(activeTheme.value);
  }

  function setThemePreference(preference: ThemePreference) {
    themePreference.value = preference;

    if (import.meta.client) {
      if (preference === "system") {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, preference);
      }
    }

    syncTheme();
  }

  function toggleTheme() {
    setThemePreference(activeTheme.value === "dark" ? "light" : "dark");
  }

  function initializeTheme() {
    if (!import.meta.client || initialized) {
      return;
    }

    initialized = true;
    const storedPreference = localStorage.getItem(storageKey);
    themePreference.value = isThemePreference(storedPreference) ? storedPreference : "system";
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    mediaQuery.addEventListener("change", () => {
      if (themePreference.value === "system") {
        syncTheme();
      }
    });

    syncTheme();
  }

  return {
    activeTheme,
    initializeTheme,
    isDark,
    setThemePreference,
    themePreference,
    toggleTheme,
  };
}
