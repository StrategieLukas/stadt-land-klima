<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Dashboard Header -->
    <header class="bg-white shadow">
      <div class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between">
          <h1 class="text-3xl font-bold text-gray-900">
            {{ $t('auth.dashboard') }}
          </h1>
          <div class="flex items-center space-x-4">
            <span class="text-sm text-gray-500">{{ userEmail }}</span>
            <span class="px-2 py-1 text-xs font-medium rounded-full bg-orange text-white">
              {{ userRoleDisplayName }}
            </span>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange"></div>
      </div>

      <!-- Not Authenticated -->
      <div v-else-if="!isAuthenticated" class="text-center py-12">
        <p class="text-gray-500 mb-4">{{ $t('auth.login_required') || 'Please log in to access the dashboard.' }}</p>
        <button 
          @click="openLoginModal"
          class="px-4 py-2 bg-orange text-white rounded hover:brightness-110"
        >
          {{ $t('generic.log_in') }}
        </button>
      </div>

      <!-- Dashboard Content -->
      <div v-else class="space-y-6">
        <!-- Quick Stats for Local Team Members -->
        <div v-if="canRateMunicipality" class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <!-- My Teams Card -->
          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg class="h-6 w-6 text-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 truncate">
                      {{ $t('auth.my_teams') }}
                    </dt>
                    <dd class="text-lg font-medium text-gray-900">
                      {{ userLocalTeams.length }}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div class="bg-gray-50 px-5 py-3">
              <div class="text-sm">
                <NuxtLink 
                  v-for="team in userLocalTeams" 
                  :key="team.id"
                  :to="`/municipalities/${team.slug || team.municipality_name}`"
                  class="font-medium text-orange hover:text-orange/80 block"
                >
                  {{ team.municipality_name || team.name }} →
                </NuxtLink>
              </div>
            </div>
          </div>

          <!-- Pending Ratings Card (placeholder) -->
          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg class="h-6 w-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 truncate">
                      Pending Ratings
                    </dt>
                    <dd class="text-lg font-medium text-gray-900">
                      -
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div class="bg-gray-50 px-5 py-3">
              <div class="text-sm text-gray-500">
                Rating features coming soon
              </div>
            </div>
          </div>
        </div>

        <!-- Admin Section -->
        <div v-if="canAccessDirectus" class="bg-white shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-900">
              Administration
            </h3>
            <div class="mt-2 max-w-xl text-sm text-gray-500">
              <p>Access the full Directus backend for advanced administration.</p>
            </div>
            <div class="mt-5">
              <a
                :href="directusUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-orange hover:brightness-110"
              >
                {{ $t('auth.directus_backend') }}
                <svg class="ml-2 -mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <!-- Measure Editor Section -->
        <div v-if="canEditMeasures" class="bg-white shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-900">
              Measure Catalog
            </h3>
            <div class="mt-2 max-w-xl text-sm text-gray-500">
              <p>Manage measures, rating criteria, and decision trees.</p>
            </div>
            <div class="mt-5 space-x-3">
              <NuxtLink
                to="/measures"
                class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                View Measures
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Login Modal (for redirected users) -->
    <AuthLoginModal
      :is-open="showLoginModal"
      @close="showLoginModal = false"
      @success="handleLoginSuccess"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { usePermissions } from '~/composables/usePermissions';

const { $t } = useNuxtApp();
const config = useRuntimeConfig();

const { isAuthenticated, user, initialize } = useAuth();
const { 
  canAccessDirectus, 
  canEditMeasures, 
  canRateMunicipality,
  userDisplayName, 
  userRoleDisplayName, 
  userLocalTeams 
} = usePermissions();

// State
const loading = ref(true);
const showLoginModal = ref(false);

// Computed
const userEmail = computed(() => user.value?.email || '');
const directusUrl = computed(() => config.public.clientDirectusUrl || '/backend');

// Methods
function openLoginModal() {
  showLoginModal.value = true;
}

function handleLoginSuccess() {
  showLoginModal.value = false;
}

// Initialize
onMounted(async () => {
  await initialize();
  loading.value = false;
});
</script>
