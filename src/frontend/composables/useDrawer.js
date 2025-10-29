import { ref } from 'vue'

// Global reactive state for drawer
const isDrawerOpen = ref(false)

export const useDrawer = () => {
  const closeDrawer = () => {
    const drawerToggle = document.getElementById('page-drawer')
    if (drawerToggle) {
      drawerToggle.checked = false
    }
    isDrawerOpen.value = false
  }

  const openDrawer = () => {
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

  // Sync with actual checkbox state
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