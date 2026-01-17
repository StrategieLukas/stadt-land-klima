<template>
  <Teleport to="body">
    <div 
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <!-- Backdrop -->
      <div 
        class="absolute inset-0 bg-black bg-opacity-50"
        @click="close"
      />
      
      <!-- Modal -->
      <div class="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b">
          <h3 class="text-lg font-semibold">
            {{ $t('rating.source.add_title') }}
          </h3>
          <button class="btn btn-ghost btn-sm btn-circle" @click="close">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <!-- Body -->
        <div class="p-4 overflow-y-auto flex-1">
          <!-- Tabs: New vs Existing -->
          <div class="tabs tabs-boxed mb-4">
            <a 
              class="tab" 
              :class="{ 'tab-active': mode === 'new' }"
              @click="mode = 'new'"
            >
              {{ $t('rating.source.new') }}
            </a>
            <a 
              class="tab" 
              :class="{ 'tab-active': mode === 'existing' }"
              @click="mode = 'existing'"
            >
              {{ $t('rating.source.existing') }}
            </a>
          </div>
          
          <!-- New source form -->
          <div v-if="mode === 'new'" class="space-y-4">
            <div class="form-control">
              <label class="label">
                <span class="label-text">{{ $t('rating.source.title') }} *</span>
              </label>
              <input 
                v-model="newSource.title"
                type="text" 
                class="input input-bordered"
                :placeholder="$t('rating.source.title_placeholder')"
              />
            </div>
            
            <div class="form-control">
              <label class="label">
                <span class="label-text">{{ $t('rating.source.type') }}</span>
              </label>
              <select v-model="newSource.source_type" class="select select-bordered">
                <option value="url">URL / Webseite</option>
                <option value="document">Dokument</option>
                <option value="file">Datei</option>
                <option value="citation">Zitat</option>
              </select>
            </div>
            
            <div v-if="newSource.source_type === 'url'" class="form-control">
              <label class="label">
                <span class="label-text">URL</span>
              </label>
              <input 
                v-model="newSource.url"
                type="url" 
                class="input input-bordered"
                placeholder="https://..."
              />
            </div>
            
            <div class="form-control">
              <label class="label">
                <span class="label-text">{{ $t('rating.source.author') }}</span>
              </label>
              <input 
                v-model="newSource.author"
                type="text" 
                class="input input-bordered"
              />
            </div>
            
            <div class="form-control">
              <label class="label">
                <span class="label-text">{{ $t('rating.source.publication_date') }}</span>
              </label>
              <input 
                v-model="newSource.publication_date"
                type="date" 
                class="input input-bordered"
              />
            </div>
            
            <div class="form-control">
              <label class="label">
                <span class="label-text">{{ $t('rating.source.page_reference') }}</span>
              </label>
              <input 
                v-model="newSource.page_reference"
                type="text" 
                class="input input-bordered"
                :placeholder="$t('rating.source.page_reference_placeholder')"
              />
            </div>
            
            <div class="form-control">
              <label class="label">
                <span class="label-text">{{ $t('rating.source.relevance_note') }}</span>
              </label>
              <textarea 
                v-model="newSource.relevance_note"
                class="textarea textarea-bordered"
                rows="2"
                :placeholder="$t('rating.source.relevance_note_placeholder')"
              />
            </div>
            
            <div class="form-control">
              <label class="label cursor-pointer justify-start gap-2">
                <input 
                  v-model="newSource.is_reusable"
                  type="checkbox" 
                  class="checkbox checkbox-primary"
                />
                <span class="label-text">{{ $t('rating.source.is_reusable') }}</span>
              </label>
            </div>
          </div>
          
          <!-- Existing source selection -->
          <div v-else class="space-y-4">
            <div class="form-control">
              <label class="label">
                <span class="label-text">{{ $t('rating.source.search') }}</span>
              </label>
              <input 
                v-model="searchQuery"
                type="text" 
                class="input input-bordered"
                :placeholder="$t('rating.source.search_placeholder')"
                @input="handleSearch"
              />
            </div>
            
            <div v-if="searching" class="flex justify-center py-4">
              <span class="loading loading-spinner" />
            </div>
            
            <div v-else-if="searchResults.length > 0" class="space-y-2 max-h-60 overflow-y-auto">
              <div 
                v-for="source in searchResults" 
                :key="source.id"
                class="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                :class="{ 'border-primary bg-primary/5': selectedSource?.id === source.id }"
                @click="selectSource(source)"
              >
                <div class="font-medium">{{ source.title }}</div>
                <div v-if="source.url" class="text-sm text-gray-500 truncate">
                  {{ source.url }}
                </div>
                <div v-if="source.author" class="text-sm text-gray-500">
                  {{ source.author }}
                </div>
              </div>
            </div>
            
            <div v-else-if="searchQuery.length > 0" class="text-center py-4 text-gray-500">
              {{ $t('rating.source.no_results') }}
            </div>
            
            <!-- Additional fields for selected source -->
            <div v-if="selectedSource" class="pt-4 border-t space-y-4">
              <div class="form-control">
                <label class="label">
                  <span class="label-text">{{ $t('rating.source.page_reference') }}</span>
                </label>
                <input 
                  v-model="newSource.page_reference"
                  type="text" 
                  class="input input-bordered"
                  :placeholder="$t('rating.source.page_reference_placeholder')"
                />
              </div>
              
              <div class="form-control">
                <label class="label">
                  <span class="label-text">{{ $t('rating.source.relevance_note') }}</span>
                </label>
                <textarea 
                  v-model="newSource.relevance_note"
                  class="textarea textarea-bordered"
                  rows="2"
                  :placeholder="$t('rating.source.relevance_note_placeholder')"
                />
              </div>
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="flex justify-end gap-2 p-4 border-t bg-gray-50">
          <button class="btn btn-ghost" @click="close">
            {{ $t('common.cancel') }}
          </button>
          <button 
            class="btn btn-primary"
            :disabled="!canSave || saving"
            @click="handleSave"
          >
            <span v-if="saving" class="loading loading-spinner loading-xs" />
            {{ $t('common.add') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useCriteriaValues } from '~/composables/useCriteriaValues';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  criterionValueId: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['update:visible', 'source-added']);

const { addSource, searchSources } = useCriteriaValues();

// State
const mode = ref('new');
const saving = ref(false);
const searching = ref(false);
const searchQuery = ref('');
const searchResults = ref([]);
const selectedSource = ref(null);

const newSource = ref({
  title: '',
  source_type: 'url',
  url: '',
  author: '',
  publication_date: '',
  page_reference: '',
  relevance_note: '',
  is_reusable: false
});

// Computed
const canSave = computed(() => {
  if (mode.value === 'new') {
    return newSource.value.title.trim().length > 0;
  }
  return selectedSource.value !== null;
});

// Methods
function close() {
  emit('update:visible', false);
  resetForm();
}

function resetForm() {
  mode.value = 'new';
  searchQuery.value = '';
  searchResults.value = [];
  selectedSource.value = null;
  newSource.value = {
    title: '',
    source_type: 'url',
    url: '',
    author: '',
    publication_date: '',
    page_reference: '',
    relevance_note: '',
    is_reusable: false
  };
}

let searchTimeout = null;
function handleSearch() {
  if (searchTimeout) clearTimeout(searchTimeout);
  
  if (searchQuery.value.length < 2) {
    searchResults.value = [];
    return;
  }
  
  searchTimeout = setTimeout(async () => {
    searching.value = true;
    try {
      searchResults.value = await searchSources(searchQuery.value);
    } finally {
      searching.value = false;
    }
  }, 300);
}

function selectSource(source) {
  selectedSource.value = source;
}

async function handleSave() {
  if (!props.criterionValueId) return;
  
  saving.value = true;
  
  try {
    const sourceData = mode.value === 'new' 
      ? { ...newSource.value }
      : {
          ...selectedSource.value,
          page_reference: newSource.value.page_reference,
          relevance_note: newSource.value.relevance_note
        };
    
    await addSource(props.criterionValueId, sourceData);
    
    emit('source-added', sourceData);
    close();
  } catch (err) {
    console.error('Failed to add source:', err);
  } finally {
    saving.value = false;
  }
}

// Watch for visibility changes
watch(() => props.visible, (isVisible) => {
  if (!isVisible) {
    resetForm();
  }
});
</script>
