// Global reactive state for drawer

export const useDrawer = () => {
  const isDrawerOpen = useState<boolean>("drawer-open", () => false);
  const closeDrawer = () => {
    const drawerToggle = import.meta.client ? document.getElementById("page-drawer") : null;
    if (import.meta.client && drawerToggle instanceof HTMLInputElement) {
      drawerToggle.checked = false;
    }
    isDrawerOpen.value = false;
  };

  const openDrawer = () => {
    const drawerToggle = import.meta.client ? document.getElementById("page-drawer") : null;
    if (import.meta.client && drawerToggle instanceof HTMLInputElement) {
      drawerToggle.checked = true;
    }
    isDrawerOpen.value = true;
  };

  const toggleDrawer = () => {
    if (isDrawerOpen.value) {
      closeDrawer();
    } else {
      openDrawer();
    }
  };

  // Sync with actual checkbox state
  const syncDrawerState = () => {
    const drawerToggle = import.meta.client ? document.getElementById("page-drawer") : null;
    if (import.meta.client && drawerToggle instanceof HTMLInputElement) {
      isDrawerOpen.value = drawerToggle.checked;
    }
  };

  return {
    isDrawerOpen,
    closeDrawer,
    openDrawer,
    toggleDrawer,
    syncDrawerState,
  };
};
