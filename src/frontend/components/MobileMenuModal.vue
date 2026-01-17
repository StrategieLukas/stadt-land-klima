<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-start justify-center pt-12 pb-24"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black bg-opacity-50"
          @click="$emit('close')"
        />
        
        <!-- Modal Content -->
        <div 
          class="relative w-full max-w-md mx-4 bg-light-green rounded-lg shadow-xl overflow-y-auto"
          style="max-height: calc(100vh - 9rem);"
        >
          <!-- Close Button -->
          <button
            @click="$emit('close')"
            class="absolute top-4 right-4 text-white hover:text-orange transition-colors z-10"
            aria-label="Close menu"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <!-- Menu Content -->
          <ul class="mobile-menu menu menu-lg w-full bg-light-green text-white font-semibold p-4">
            <!-- Page Links -->
            <li v-for="page in pages" :key="page.id">
              <NuxtLink
                :to="'/' + page.slug"
                class="text-white hover:bg-white hover:bg-opacity-10"
                @click="$emit('close')"
              >
                <span class="text-lg mr-2">→</span>
                {{ page.name }}
              </NuxtLink>
            </li>
            
            <!-- Divider -->
            <div class="border-t border-white/30 my-3" />
            
            <!-- Auth Section with Collapsible Submenu -->
            <li v-if="isAuthenticated">
              <details class="group">
                <summary class="text-white hover:bg-white hover:bg-opacity-10 cursor-pointer">
                  <div class="flex items-center">
                    <!-- User Initials -->
                    <div class="w-8 h-8 rounded-full bg-orange text-white flex items-center justify-center text-sm font-bold mr-3">
                      {{ userInitials }}
                    </div>
                    <span>{{ userDisplayName }}</span>
                  </div>
                </summary>
                <ul class="bg-white bg-opacity-10 rounded-lg mt-2">
                  <!-- Dashboard -->
                  <li>
                    <NuxtLink
                      to="/admin/dashboard"
                      class="text-white hover:bg-white hover:bg-opacity-10"
                      @click="$emit('close')"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                      {{ $t('auth.dashboard') }}
                    </NuxtLink>
                  </li>
                  
                  <!-- My Municipalities (nested collapsible) -->
                  <li v-if="userLocalTeams.length > 0">
                    <details>
                      <summary class="text-white hover:bg-white hover:bg-opacity-10 cursor-pointer">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {{ $t('auth.my_municipalities') }}
                      </summary>
                      <ul class="bg-white bg-opacity-5 rounded-lg mt-1">
                        <li v-for="team in userLocalTeams" :key="team.id">
                          <NuxtLink
                            :to="getMunicipalityUrl(team)"
                            class="text-white hover:bg-white hover:bg-opacity-10 pl-8"
                            @click="$emit('close')"
                          >
                            {{ getMunicipalityDisplayName(team) }}
                          </NuxtLink>
                        </li>
                      </ul>
                    </details>
                  </li>
                  
                  <!-- Directus Backend -->
                  <li v-if="canAccessDirectus">
                    <a
                      :href="directusUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-white hover:bg-white hover:bg-opacity-10"
                      @click="$emit('close')"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {{ $t('auth.directus_backend') }}
                      <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </li>
                  
                  <!-- Divider -->
                  <div class="border-t border-white/20 my-2 mx-4" />
                  
                  <!-- Logout -->
                  <li>
                    <button
                      @click="handleLogout"
                      class="text-red-300 hover:bg-red-500/20 w-full text-left"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      {{ $t('auth.logout') }}
                    </button>
                  </li>
                </ul>
              </details>
            </li>
            
            <!-- Login Button (not authenticated) -->
            <li v-else>
              <button
                @click="openLogin"
                class="text-white bg-orange hover:bg-orange hover:bg-opacity-80 w-full justify-center"
              >
                <span class="text-lg mr-2">→</span>
                {{ $t('generic.log_in') }}
              </button>
            </li>
            
            <!-- Divider -->
            <div class="border-t border-white/30 my-3" />
            
            <!-- Donate Button -->
            <li>
              <a
                href="https://www.betterplace.org/de/projects/157241-stadt-land-klima-bringe-kommunalen-klimaschutz-voran"
                class="text-white bg-orange hover:bg-orange hover:bg-opacity-80"
                @click="$emit('close')"
              >
                <span class="text-lg mr-2">→</span>
                {{ $t('donate.label') }}
                <img src="~/assets/icons/icon_hand_holding_heart.svg" class="w-5 h-5 ml-2"/>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </Transition>
    
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
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { usePermissions } from '~/composables/usePermissions';

const { $t } = useNuxtApp();
const config = useRuntimeConfig();

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  pages: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['close']);

const { logout, isAuthenticated, user } = useAuth();
const { canAccessDirectus, userDisplayName, userLocalTeams } = usePermissions();

// Modal state
const isLoginModalOpen = ref(false);
const isRegisterModalOpen = ref(false);

// Directus URL
const directusUrl = computed(() => {
  return config.public.clientDirectusUrl || '/backend';
});

// User initials
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

// Get municipality URL from team data
function getMunicipalityUrl(team) {
  // municipality_id is an O2M relation, so it's an array - get the first one
  const municipality = team.municipality_id?.[0];
  
  if (municipality?.slug) {
    return `/municipalities/${municipality.slug}`;
  }
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
  return '/municipalities';
}

// Get municipality display name from team's related municipality
function getMunicipalityDisplayName(team) {
  // municipality_id is an O2M relation, so it's an array - get the first one
  const municipality = team.municipality_id?.[0];
  return municipality?.municipality_name || municipality?.name || team.municipality_name || 'Unknown';
}

// Open login modal
function openLogin() {
  emit('close');
  isLoginModalOpen.value = true;
}

// Handle login success
function handleLoginSuccess() {
  isLoginModalOpen.value = false;
  navigateTo('/admin/dashboard');
}

// Handle register success
function handleRegisterSuccess() {
  isRegisterModalOpen.value = false;
}

// Switch between modals
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
  emit('close');
  await logout();
}

// Handle escape key
function handleEscapeKey(event) {
  if (event.key === 'Escape' && props.isOpen) {
    emit('close');
  }
}

// Watch for modal open/close to manage escape key listener
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    document.addEventListener('keydown', handleEscapeKey);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  } else {
    document.removeEventListener('keydown', handleEscapeKey);
    document.body.style.overflow = '';
  }
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscapeKey);
  document.body.style.overflow = '';
});
</script>

<style scoped>
/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.2s ease;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: translateY(-20px);
}

/* DaisyUI menu customization for dark background - white caret */
.mobile-menu :deep(details > summary::after),
.mobile-menu :deep(details[open] > summary::after) {
  filter: brightness(0) invert(1) !important;
}

/* Ensure summary arrow is white */
.mobile-menu :deep(summary::marker),
.mobile-menu :deep(summary::-webkit-details-marker) {
  color: white;
}
</style>
