<template>
  <div class="relative" ref="menuRef">
    <!-- HEADER/DEFAULT VARIANT -->
    <template v-if="variant === 'header' || variant === 'default'">
      <!-- Authenticated User Menu -->
      <template v-if="isAuthenticated">
        <button
          @click="toggleMenu"
          class="group h-10 flex items-center space-x-2 px-4 py-2 text-sm font-bold border-2 border-orange text-orange hover:bg-orange hover:text-white transition-colors"
          :aria-expanded="isMenuOpen"
          aria-haspopup="true"
        >
          <!-- User Avatar or Initials -->
          <div class="w-6 h-6 rounded-full bg-orange text-white group-hover:bg-white group-hover:text-orange flex items-center justify-center text-xs font-bold transition-colors">
            {{ userInitials }}
          </div>
          <span class="hidden sm:inline">{{ userDisplayName }}</span>
          <svg 
            class="w-4 h-4 transition-transform" 
            :class="{ 'rotate-180': isMenuOpen }"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        <!-- Dropdown Menu -->
        <Transition name="dropdown">
          <div 
            v-if="isMenuOpen"
            class="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-[60]"
          >
            <!-- User Info Header -->
            <div class="px-4 py-3 border-b border-gray-100">
              <p class="text-sm font-medium text-gray-900">{{ userDisplayName }}</p>
              <p class="text-xs text-gray-500 truncate">{{ userEmail }}</p>
              <p class="text-xs text-orange mt-1">{{ userRoleDisplayName }}</p>
            </div>
            
            <!-- Menu Items -->
            <div class="py-1">
              <!-- Dashboard Link -->
              <NuxtLink
                to="/admin/dashboard"
                class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                @click="closeMenu"
              >
                <svg class="w-4 h-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                {{ $t('auth.dashboard') }}
              </NuxtLink>
              
              <!-- My Municipalities (if user has local teams) -->
              <template v-if="userLocalTeams.length > 0">
                <div class="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {{ $t('auth.my_municipalities') }}
                </div>
                <NuxtLink
                  v-for="team in userLocalTeams"
                  :key="team.id"
                  :to="getMunicipalityUrl(team)"
                  class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  @click="closeMenu"
                >
                  <svg class="w-4 h-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {{ team.municipality_id?.[0]?.municipality_name || team.municipality_id?.[0]?.name || team.municipality_name || 'Unknown' }}
                </NuxtLink>
              </template>
              
              <!-- Divider -->
              <div class="border-t border-gray-100 my-1" />
              
              <!-- Directus Backend (for users with app_access) -->
              <a
                v-if="canAccessDirectus"
                :href="directusUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                @click="closeMenu"
              >
                <svg class="w-4 h-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {{ $t('auth.directus_backend') }}
                <svg class="w-3 h-3 ml-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              
              <!-- Divider -->
              <div class="border-t border-gray-100 my-1" />
              
              <!-- Logout -->
              <button
                @click="handleLogout"
                class="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {{ $t('auth.logout') }}
              </button>
            </div>
          </div>
        </Transition>
      </template>
      
      <!-- Login Button (not authenticated) -->
      <template v-else>
        <button
          @click="openLogin"
          class="h-10 flex items-center justify-center px-4 py-2 text-sm font-bold border-2 border-orange text-orange hover:bg-orange hover:text-white transition-colors"
        >
          <span>{{ $t('generic.log_in') }}</span>
          <span class="ml-1">→</span>
        </button>
      </template>
    </template>
    
    <!-- FOOTER VARIANT -->
    <template v-else-if="variant === 'footer'">
      <template v-if="isAuthenticated">
        <NuxtLink
          to="/admin/dashboard"
          class="h-10 flex items-center justify-center px-4 py-2 text-sm font-bold bg-orange text-white hover:brightness-110"
        >
          {{ userDisplayName }} <span class="text-lg ml-1">→</span>
        </NuxtLink>
      </template>
      <template v-else>
        <button
          @click="openLogin"
          class="h-10 flex items-center justify-center px-4 py-2 text-sm font-bold bg-orange text-white hover:brightness-110"
        >
          {{ $t('generic.log_in') }} <span class="text-lg ml-1">→</span>
        </button>
      </template>
    </template>
    
    <!-- DRAWER VARIANT (Mobile) -->
    <template v-else-if="variant === 'drawer'">
      <template v-if="isAuthenticated">
        <NuxtLink
          to="/admin/dashboard"
          class="text-md bg-orange w-full flex items-center"
          @click="emitClose"
        >
          <span class="text-lg mr-1">→</span>{{ userDisplayName }}
        </NuxtLink>
      </template>
      <template v-else>
        <button
          @click="openLogin"
          class="text-md bg-orange w-full flex items-center text-left"
        >
          <span class="text-lg mr-1">→</span>{{ $t('generic.log_in') }}
        </button>
      </template>
    </template>
    
    <!-- Login Modal -->
    <AuthLoginModal
      :is-open="isLoginModalOpen"
      @close="isLoginModalOpen = false"
      @success="handleLoginSuccess"
      @switch-to-register="switchToRegister"
    />
    
    <!-- Register Modal -->
    <AuthRegisterModal
      :is-open="isRegisterModalOpen"
      @close="isRegisterModalOpen = false"
      @success="handleRegisterSuccess"
      @switch-to-login="switchToLogin"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { usePermissions } from '~/composables/usePermissions';

const { $t } = useNuxtApp();
const config = useRuntimeConfig();

// Props
const props = defineProps({
  variant: {
    type: String,
    default: 'default', // 'default', 'header', 'footer', 'drawer'
    validator: (value) => ['default', 'header', 'footer', 'drawer'].includes(value)
  }
});

// Emits
const emit = defineEmits(['close']);

const { logout, initialize, isAuthenticated, user } = useAuth();
const { canAccessDirectus, userDisplayName, userRoleDisplayName, userLocalTeams } = usePermissions();

// State
const isMenuOpen = ref(false);
const isLoginModalOpen = ref(false);
const isRegisterModalOpen = ref(false);
const menuRef = ref(null);

// Directus URL for backend link
const directusUrl = computed(() => {
  return config.public.clientDirectusUrl || '/backend';
});

// User initials for avatar
const userInitials = computed(() => {
  const u = user.value;
  if (!u) return '?';
  
  const first = u.first_name?.[0] || '';
  const last = u.last_name?.[0] || '';
  
  if (first || last) {
    return (first + last).toUpperCase();
  }
  
  return u.email?.[0]?.toUpperCase() || '?';
});

// User email
const userEmail = computed(() => user.value?.email || '');

// Toggle menu
function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value;
}

// Close menu
function closeMenu() {
  isMenuOpen.value = false;
}

// Emit close event (for drawer variant)
function emitClose() {
  emit('close');
}

// Open login modal
function openLogin() {
  isLoginModalOpen.value = true;
}

// Handle login success
function handleLoginSuccess(loggedInUser) {
  isLoginModalOpen.value = false;
  // Redirect to dashboard after successful login
  navigateTo('/admin/dashboard');
}

// Get municipality URL from team data
function getMunicipalityUrl(team) {
  // municipality_id is an O2M relation, so it's an array - get the first one
  const municipality = team.municipality_id?.[0];
  
  // Use the slug from the related municipality object
  if (municipality?.slug) {
    return `/municipalities/${municipality.slug}`;
  }
  // Fallback: if municipality has a municipality_name field, slugify it
  if (municipality?.municipality_name) {
    const slug = municipality.municipality_name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-äöüß]/g, '')
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss');
    return `/municipalities/${slug}`;
  }
  // Last resort fallback - this shouldn't happen if data is properly linked
  return '/municipalities';
}

// Handle register success
function handleRegisterSuccess() {
  isRegisterModalOpen.value = false;
}

// Switch between login and register modals
function switchToRegister() {
  isLoginModalOpen.value = false;
  isRegisterModalOpen.value = true;
}

function switchToLogin() {
  isRegisterModalOpen.value = false;
  isLoginModalOpen.value = true;
}

// Handle logout
async function handleLogout() {
  closeMenu();
  await logout();
  // Optionally redirect to home
}

// Close menu when clicking outside
function handleClickOutside(event) {
  if (menuRef.value && !menuRef.value.contains(event.target)) {
    closeMenu();
  }
}

// Initialize auth on mount
onMounted(async () => {
  document.addEventListener('click', handleClickOutside);
  
  // Initialize auth state from storage
  await initialize();
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
/* Dropdown transitions */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
