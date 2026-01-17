import { ref } from 'vue'

// Global reactive state for drawer/mobile menu
const isDrawerOpen = ref(false)

export const useDrawer = () => {
  const closeDrawer = () => {
    // For legacy drawer (desktop)
    const drawerToggle = document.getElementById('page-drawer')
    if (drawerToggle) {
      drawerToggle.checked = false
    }
    isDrawerOpen.value = false
  }

  const openDrawer = () => {
    // For legacy drawer (desktop)
    const drawerToggle = document.getElementById('page-drawer')
    if (drawerToggle) {
      drawerToggle.checked = true
    }
    isDrawerOpen.value = true
  }

  const toggleDrawer = () => {
    if (isDrawerOpen.value) {
      closeDrawer()
    } else {
      openDrawer()
    }
  }

  // Sync with actual checkbox state (for desktop drawer)
  const syncDrawerState = () => {
    const drawerToggle = document.getElementById('page-drawer')
    if (drawerToggle) {
      isDrawerOpen.value = drawerToggle.checked
    }
  }

  return {
    isDrawerOpen,
    closeDrawer,
    openDrawer,
    toggleDrawer,
    syncDrawerState
  }
}