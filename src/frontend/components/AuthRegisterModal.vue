<template>
  <Teleport to="body">
    <Transition name="modal">
      <div 
        v-if="isOpen" 
        class="fixed inset-0 z-[100] overflow-y-auto"
        aria-labelledby="register-modal-title"
        role="dialog"
        aria-modal="true"
      >
        <!-- Backdrop -->
        <div 
          class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          @click="closeModal"
        />
        
        <!-- Modal Panel -->
        <div class="flex min-h-full items-center justify-center p-4 pb-24 lg:pb-4">
          <div 
            class="relative bg-white rounded-lg shadow-xl w-full max-w-lg transform transition-all"
            @click.stop
          >
            <!-- Close button -->
            <button
              type="button"
              class="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              @click="closeModal"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <!-- Header -->
            <div class="px-6 pt-6 pb-4 border-b border-gray-100">
              <h2 id="register-modal-title" class="text-xl font-bold text-gray-900">
                {{ $t('auth.register_title') }}
              </h2>
              <p class="mt-1 text-sm text-gray-500">
                {{ $t('auth.register_subtitle') }}
              </p>
            </div>
            
            <!-- Success State -->
            <div v-if="registrationSuccess" class="px-6 py-8 text-center">
              <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                <svg class="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 class="text-xl font-bold text-gray-900 mb-3">
                {{ $t('auth.register_success_title') }}
              </h3>
              <p class="text-base text-gray-600 mb-6 leading-relaxed">
                {{ $t('auth.register_success_message') }}
              </p>
              <div class="flex flex-col gap-3">
                <a
                  href="https://cal.com/stadt-land-klima/onboarding"
                  target="_blank"
                  class="w-full px-4 py-3 bg-orange text-white font-medium rounded hover:brightness-110 inline-flex items-center justify-center gap-2"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {{ $t('auth.book_onboarding') }}
                </a>
                <button
                  type="button"
                  @click="closeModal"
                  class="w-full px-4 py-2 text-gray-600 font-medium rounded border border-gray-300 hover:bg-gray-50"
                >
                  {{ $t('auth.close') }}
                </button>
              </div>
            </div>
            
            <!-- Form -->
            <form v-else @submit.prevent="handleSubmit" class="px-6 py-4 space-y-4">
              <!-- Error Message -->
              <div 
                v-if="error" 
                class="p-4 bg-red-50 border-2 border-red-500 rounded-lg text-sm text-red-700 flex items-start gap-3"
              >
                <svg class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{{ error }}</span>
              </div>
              
              <!-- Name Fields -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label for="register-first-name" class="block text-sm font-medium text-gray-700 mb-1">
                    {{ $t('auth.first_name') }} *
                  </label>
                  <input
                    id="register-first-name"
                    v-model="form.firstName"
                    type="text"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent"
                    :placeholder="$t('auth.first_name_placeholder')"
                  />
                </div>
                <div>
                  <label for="register-last-name" class="block text-sm font-medium text-gray-700 mb-1">
                    {{ $t('auth.last_name') }} *
                  </label>
                  <input
                    id="register-last-name"
                    v-model="form.lastName"
                    type="text"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent"
                    :placeholder="$t('auth.last_name_placeholder')"
                  />
                </div>
              </div>
              
              <!-- Email -->
              <div>
                <label for="register-email" class="block text-sm font-medium text-gray-700 mb-1">
                  {{ $t('auth.email') }} *
                </label>
                <input
                  id="register-email"
                  v-model="form.email"
                  type="email"
                  required
                  autocomplete="email"
                  class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent"
                  :placeholder="$t('auth.email_placeholder')"
                />
              </div>
              
              <!-- Municipality Selection -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  {{ $t('auth.select_municipalities') }} *
                </label>
                <p class="text-xs text-gray-500 mb-2">
                  {{ $t('auth.select_municipalities_hint') }}
                </p>
                
                <!-- Selected Municipalities -->
                <div v-if="form.municipalities.length > 0" class="flex flex-wrap gap-2 mb-2">
                  <span
                    v-for="muni in form.municipalities"
                    :key="muni.ars"
                    class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-orange/10 text-orange"
                  >
                    {{ muni.name }}
                    <button
                      type="button"
                      @click="removeMunicipality(muni.ars)"
                      class="ml-2 text-orange hover:text-orange/80"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                </div>
                
                <!-- Search Input -->
                <div class="relative">
                  <input
                    ref="municipalitySearchInput"
                    v-model="municipalitySearch"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent"
                    :placeholder="$t('auth.search_municipality_placeholder')"
                    @input="debouncedSearch"
                    @focus="showMunicipalityDropdown = true"
                  />
                  
                  <!-- Loading indicator -->
                  <div v-if="isSearching" class="absolute right-3 top-1/2 -translate-y-1/2">
                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-orange"></div>
                  </div>
                  
                  <!-- Dropdown -->
                  <div
                    v-if="showMunicipalityDropdown && (municipalityResults.length > 0 || isSearching)"
                    class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto"
                  >
                    <div v-if="isSearching" class="px-4 py-3 text-sm text-gray-500">
                      {{ $t('generic.loading') }}
                    </div>
                    <div
                      v-else
                      v-for="result in municipalityResults"
                      :key="result.ars"
                      @click="selectMunicipality(result)"
                      class="px-4 py-2 cursor-pointer hover:bg-gray-50"
                      :class="{ 'opacity-50': isMunicipalitySelected(result.ars) }"
                    >
                      <div class="font-medium text-sm">{{ result.name }}</div>
                      <div class="text-xs text-gray-500">{{ result.prefix }} · {{ result.population?.toLocaleString('de-DE') }} Einwohner</div>
                      <div v-if="result.hasExistingTeam" class="text-xs text-orange mt-1">
                        {{ $t('auth.existing_team_notice') }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Motivation (optional) -->
              <div>
                <label for="register-motivation" class="block text-sm font-medium text-gray-700 mb-1">
                  {{ $t('auth.motivation') }}
                </label>
                <textarea
                  id="register-motivation"
                  v-model="form.motivation"
                  rows="3"
                  class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent resize-none"
                  :placeholder="$t('auth.motivation_placeholder')"
                />
              </div>
              
              <!-- Privacy Agreement -->
              <div class="flex items-start">
                <input
                  id="register-privacy"
                  v-model="form.privacyAccepted"
                  type="checkbox"
                  required
                  class="mt-1 h-4 w-4 text-orange focus:ring-orange border-gray-300 rounded"
                />
                <label for="register-privacy" class="ml-2 text-sm text-gray-600">
                  {{ $t('auth.privacy_agreement') }}
                  <a href="/datenschutz" target="_blank" class="text-orange hover:underline">
                    {{ $t('auth.privacy_policy') }}
                  </a>
                  *
                </label>
              </div>
              
              <!-- Submit Button -->
              <div class="pt-2">
                <button
                  type="submit"
                  :disabled="isSubmitting || !isFormValid"
                  class="w-full py-2 px-4 bg-orange text-white font-bold rounded hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <span v-if="isSubmitting" class="flex items-center justify-center">
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {{ $t('auth.submitting') }}
                  </span>
                  <span v-else>{{ $t('auth.register_button') }}</span>
                </button>
              </div>
              
              <!-- Login Link -->
              <div class="text-center text-sm text-gray-500 pt-2">
                {{ $t('auth.already_have_account') }}
                <button 
                  type="button"
                  @click="switchToLogin"
                  class="text-orange hover:underline font-medium"
                >
                  {{ $t('generic.log_in') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import lodash from 'lodash';
const { debounce } = lodash;

const { $t, $stadtlandzahlAPI, $directus, $readItems } = useNuxtApp();
const config = useRuntimeConfig();

// Props
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  prefilledMunicipality: {
    type: Object,
    default: null
    // Expected: { ars: string, name: string, prefix?: string, population?: number }
  }
});

// Emits
const emit = defineEmits(['close', 'success', 'switch-to-login']);

// Form state
const form = ref({
  firstName: '',
  lastName: '',
  email: '',
  municipalities: [],
  motivation: '',
  privacyAccepted: false
});

// UI state
const error = ref('');
const isSubmitting = ref(false);
const registrationSuccess = ref(false);

// Municipality search state
const municipalitySearch = ref('');
const municipalityResults = ref([]);
const showMunicipalityDropdown = ref(false);
const isSearching = ref(false);
const municipalitySearchInput = ref(null);

// Existing local teams (to show notice)
const existingLocalTeams = ref([]);

// Form validation
const isFormValid = computed(() => {
  return (
    form.value.firstName.trim() &&
    form.value.lastName.trim() &&
    form.value.email.trim() &&
    form.value.municipalities.length > 0 &&
    form.value.privacyAccepted
  );
});

// Check if municipality is already selected
function isMunicipalitySelected(ars) {
  return form.value.municipalities.some(m => m.ars === ars);
}

// Search municipalities via Stadt Land Zahl API
async function searchMunicipalities() {
  const query = municipalitySearch.value.trim();
  if (query.length < 2) {
    municipalityResults.value = [];
    return;
  }
  
  isSearching.value = true;
  
  try {
    const result = await $stadtlandzahlAPI.searchThroughAdministrativeAreasByName(
      query,
      { isReasonableForMunicipalRating: true }
    );
    
    if (result?.allAdministrativeAreas?.edges) {
      municipalityResults.value = result.allAdministrativeAreas.edges.map(edge => {
        const node = edge.node;
        // Check if there's an existing local team for this municipality
        const hasExistingTeam = existingLocalTeams.value.some(
          team => team.municipality_ars === node.ars
        );
        
        return {
          ars: node.ars,
          name: node.name,
          prefix: node.prefix,
          population: node.population,
          hasExistingTeam
        };
      });
    } else {
      municipalityResults.value = [];
    }
  } catch (err) {
    console.error('Municipality search failed:', err);
    municipalityResults.value = [];
  } finally {
    isSearching.value = false;
  }
}

// Debounced search
const debouncedSearch = debounce(searchMunicipalities, 300);

// Select a municipality
function selectMunicipality(municipality) {
  if (isMunicipalitySelected(municipality.ars)) {
    return;
  }
  
  form.value.municipalities.push({
    ars: municipality.ars,
    name: municipality.name,
    prefix: municipality.prefix,
    hasExistingTeam: municipality.hasExistingTeam
  });
  
  // Clear search
  municipalitySearch.value = '';
  municipalityResults.value = [];
  showMunicipalityDropdown.value = false;
}

// Remove a municipality
function removeMunicipality(ars) {
  form.value.municipalities = form.value.municipalities.filter(m => m.ars !== ars);
}

// Fetch existing local teams
async function fetchExistingLocalTeams() {
  try {
    const teams = await $directus.request(
      $readItems('localteams', {
        fields: ['id', 'municipality_ars', 'municipality_name'],
        filter: { status: { _eq: 'published' } }
      })
    );
    existingLocalTeams.value = teams || [];
  } catch (err) {
    console.error('Failed to fetch local teams:', err);
    existingLocalTeams.value = [];
  }
}

// Handle form submission
async function handleSubmit() {
  if (!isFormValid.value) return;
  
  error.value = '';
  isSubmitting.value = true;
  
  try {
    // Determine if any selected municipality has an existing team
    const hasExistingTeamMunis = form.value.municipalities.filter(m => m.hasExistingTeam);
    const newTeamMunis = form.value.municipalities.filter(m => !m.hasExistingTeam);
    
    // Create registration request via Directus
    // The registration will be stored in user_registrations collection
    // Note: status is set via presets in Directus permissions, not sent from frontend
    const registrationData = {
      first_name: form.value.firstName.trim(),
      last_name: form.value.lastName.trim(),
      email: form.value.email.trim().toLowerCase(),
      municipalities: form.value.municipalities.map(m => ({
        ars: m.ars,
        name: m.name,
        has_existing_team: m.hasExistingTeam
      })),
      motivation: form.value.motivation.trim() || null,
      // Approval type depends on whether joining existing team or creating new
      requires_admin_approval: newTeamMunis.length > 0,
      requires_localteam_approval: hasExistingTeamMunis.length > 0
    };
    
    // Submit to Directus via the SDK
    // The user_registrations collection should be set up with public create access
    // or use a Directus Flow to handle registrations
    try {
      const { createItem } = await import('@directus/sdk');
      
      await $directus.request(
        createItem('user_registrations', registrationData)
      );
    } catch (apiError) {
      console.error('Registration API error:', apiError);
      
      // Check for specific error types
      const errorMessage = apiError?.errors?.[0]?.message || apiError?.message || '';
      
      if (errorMessage.includes('unique') || errorMessage.includes('duplicate')) {
        throw new Error('auth.email_already_registered');
      }
      
      if (errorMessage.includes('permission') || errorMessage.includes('forbidden') || apiError.status === 403) {
        // Collection might not exist or have proper permissions
        console.error('Permission error - ensure user_registrations collection exists with public create access');
        throw new Error('auth.registration_error');
      }
      
      throw new Error('auth.registration_error');
    }
    
    registrationSuccess.value = true;
    emit('success');
    
  } catch (err) {
    console.error('Registration failed:', err);
    error.value = $t(err.message) || $t('auth.registration_error');
  } finally {
    isSubmitting.value = false;
  }
}

// Close modal
function closeModal() {
  emit('close');
  // Reset form after animation
  setTimeout(resetForm, 300);
}

// Reset form
function resetForm() {
  form.value = {
    firstName: '',
    lastName: '',
    email: '',
    municipalities: props.prefilledMunicipality ? [props.prefilledMunicipality] : [],
    motivation: '',
    privacyAccepted: false
  };
  error.value = '';
  registrationSuccess.value = false;
  municipalitySearch.value = '';
  municipalityResults.value = [];
}

// Switch to login
function switchToLogin() {
  emit('switch-to-login');
}

// Close dropdown when clicking outside
function handleClickOutside(event) {
  if (municipalitySearchInput.value && !municipalitySearchInput.value.contains(event.target)) {
    showMunicipalityDropdown.value = false;
  }
}

// Watch for prefilled municipality
watch(() => props.prefilledMunicipality, (newVal) => {
  if (newVal && !isMunicipalitySelected(newVal.ars)) {
    form.value.municipalities = [newVal];
  }
}, { immediate: true });

// Watch for modal open
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    await fetchExistingLocalTeams();
    
    // If prefilled municipality, add it
    if (props.prefilledMunicipality && !isMunicipalitySelected(props.prefilledMunicipality.ars)) {
      // Check if it has an existing team
      const hasExistingTeam = existingLocalTeams.value.some(
        team => team.municipality_ars === props.prefilledMunicipality.ars
      );
      
      form.value.municipalities = [{
        ...props.prefilledMunicipality,
        hasExistingTeam
      }];
    }
  }
});

// Lifecycle
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
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
  transform: scale(0.95);
}
</style>
